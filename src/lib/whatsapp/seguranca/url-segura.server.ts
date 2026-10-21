/**
 * Proteção contra SSRF para URLs de servidores de provedores (Evolution, ...).
 * Somente servidor.
 *
 * O administrador cadastra a URL de um servidor e o backend passa a chamá-la:
 * sem proteção, isso poderia ser usado para alcançar serviços internos
 * (metadados da nuvem, Supabase local, painéis na rede da VPS...).
 *
 * Regras:
 *  - somente `https` (`http` apenas para hosts liberados explicitamente);
 *  - sem usuário/senha na URL;
 *  - o nome do host é resolvido e TODOS os endereços devem ser públicos
 *    (bloqueia loopback, redes privadas, link-local/metadados, CGNAT, multicast,
 *    reservados e os equivalentes IPv6, inclusive IPv4 mapeado);
 *  - hosts de rede privada só são aceitos se listados em
 *    `WHATSAPP_HOSTS_PERMITIDOS` (decisão explícita do administrador do servidor);
 *  - requisições não seguem redirecionamentos (um redirect poderia apontar para
 *    um endereço interno) e têm limite de tempo.
 *
 * Limitação conhecida: a resolução de DNS é refeita a cada requisição, mas a
 * conexão final é feita pelo `fetch` (não há "pinning" do IP validado), então
 * um DNS malicioso com TTL baixo (DNS rebinding) ainda é um risco residual.
 */

import { isIP } from "node:net";

export type ResultadoUrl = { ok: true; url: URL; ips: string[] } | { ok: false; motivo: string };

export interface OpcoesUrlSegura {
  /** Hosts liberados explicitamente (podem ser privados e/ou usar http). */
  hostsPermitidos?: string[];
  /** Resolve um nome em endereços (injetável nos testes). */
  resolver?: (host: string) => Promise<string[]>;
}

// ---------------------------------------------------------------- endereços IP

function ipv4ParaNumero(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const parte of p) {
    if (!/^\d{1,3}$/.test(parte)) return null;
    const v = Number(parte);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const FAIXAS_IPV4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "esta rede"
  ["10.0.0.0", 8], // privada
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (inclui metadados de nuvem 169.254.169.254)
  ["172.16.0.0", 12], // privada
  ["192.0.0.0", 24], // protocolo IETF
  ["192.0.2.0", 24], // documentação
  ["192.168.0.0", 16], // privada
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentação
  ["203.0.113.0", 24], // documentação
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reservado (inclui 255.255.255.255)
];

function ipv4Reservado(ip: string): boolean {
  const n = ipv4ParaNumero(ip);
  if (n === null) return true; // não parseável: trata como inseguro
  return FAIXAS_IPV4.some(([base, bits]) => {
    const b = ipv4ParaNumero(base)!;
    const tamanho = 2 ** (32 - bits);
    return n >= b && n < b + tamanho;
  });
}

/** Expande um IPv6 para 8 grupos de 16 bits; `null` se inválido. */
function expandirIpv6(ip: string): number[] | null {
  let texto = ip.toLowerCase();
  const zona = texto.indexOf("%");
  if (zona >= 0) texto = texto.slice(0, zona);

  // Sufixo IPv4 (ex.: ::ffff:10.0.0.1)
  const ultimoDoisPontos = texto.lastIndexOf(":");
  const cauda = texto.slice(ultimoDoisPontos + 1);
  if (cauda.includes(".")) {
    const n = ipv4ParaNumero(cauda);
    if (n === null) return null;
    texto = `${texto.slice(0, ultimoDoisPontos + 1)}${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const partes = texto.split("::");
  if (partes.length > 2) return null;
  const esquerda = partes[0] ? partes[0].split(":") : [];
  const direita = partes.length === 2 && partes[1] ? partes[1].split(":") : [];
  const faltam = 8 - esquerda.length - direita.length;
  if (partes.length === 1 ? esquerda.length !== 8 : faltam < 0) return null;

  const grupos = [...esquerda, ...Array(partes.length === 2 ? faltam : 0).fill("0"), ...direita];
  if (grupos.length !== 8) return null;
  const nums = grupos.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function ipv6Reservado(ip: string): boolean {
  const g = expandirIpv6(ip);
  if (!g) return true;
  const [a, b, c, d, e, f, x, y] = g as [number, number, number, number, number, number, number, number];

  // :: (não especificado) e ::1 (loopback)
  if (g.slice(0, 7).every((v) => v === 0) && (y === 0 || y === 1)) return true;
  // IPv4 mapeado (::ffff:a.b.c.d) e compatível: avalia o IPv4 embutido
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && (f === 0xffff || f === 0)) {
    return ipv4Reservado(`${x >> 8}.${x & 255}.${y >> 8}.${y & 255}`);
  }
  // 64:ff9b::/96 (NAT64) — pode alcançar IPv4 internos
  if (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) return true;
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA, privada)
  if ((a & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((a & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
  if (a === 0x2001 && b === 0x0db8) return true; // documentação
  if (a === 0x0100 && b === 0 && c === 0 && d === 0) return true; // 100::/64 (descarte)
  return false;
}

/** `true` se o endereço NÃO é um IP público roteável. */
export function ipNaoPublico(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Reservado(ip);
  if (v === 6) return ipv6Reservado(ip);
  return true;
}

// ------------------------------------------------------------------- URL / host

export function hostsPermitidosDoAmbiente(): string[] {
  return (process.env["WHATSAPP_HOSTS_PERMITIDOS"] ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

async function resolverNome(host: string): Promise<string[]> {
  const { lookup } = await import("node:dns/promises");
  const r = await lookup(host, { all: true, verbatim: true });
  return r.map((x) => x.address);
}

const SUFIXOS_INTERNOS = [".localhost", ".local", ".internal", ".lan", ".intranet", ".home", ".corp"];

export async function validarUrlDoServidor(entrada: string, opcoes: OpcoesUrlSegura = {}): Promise<ResultadoUrl> {
  let url: URL;
  try {
    url = new URL(entrada.trim());
  } catch {
    return { ok: false, motivo: "URL inválida." };
  }

  if (url.username || url.password) {
    return { ok: false, motivo: "A URL não pode conter usuário ou senha." };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, motivo: "URL sem endereço de servidor." };

  const liberados = (opcoes.hostsPermitidos ?? hostsPermitidosDoAmbiente()).map((h) => h.toLowerCase());
  const liberado = liberados.includes(host);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && liberado)) {
    return {
      ok: false,
      motivo:
        url.protocol === "http:"
          ? "Use https. O http só é aceito para hosts liberados em WHATSAPP_HOSTS_PERMITIDOS."
          : "Protocolo não permitido (use https).",
    };
  }

  const ehIp = isIP(host) !== 0;
  if (!ehIp && !liberado) {
    if (!host.includes(".") || host === "localhost" || SUFIXOS_INTERNOS.some((s) => host.endsWith(s))) {
      return { ok: false, motivo: "Endereço interno não permitido." };
    }
  }

  const resolver = opcoes.resolver ?? resolverNome;
  let ips: string[];
  if (ehIp) {
    ips = [host];
  } else {
    try {
      ips = await resolver(host);
    } catch {
      return { ok: false, motivo: "Não foi possível resolver o endereço do servidor." };
    }
    if (ips.length === 0) return { ok: false, motivo: "Não foi possível resolver o endereço do servidor." };
  }

  if (!liberado) {
    const bloqueado = ips.find((ip) => ipNaoPublico(ip));
    if (bloqueado) {
      return { ok: false, motivo: "O endereço aponta para uma rede interna/reservada, que não é permitida." };
    }
  }

  return { ok: true, url, ips };
}

// ------------------------------------------------------------------ requisição

export interface OpcoesFetchSeguro extends OpcoesUrlSegura {
  timeoutMs?: number;
}

export class ErroUrlInsegura extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroUrlInsegura";
  }
}

/**
 * `fetch` para um servidor cadastrado: valida a URL a cada chamada, NÃO segue
 * redirecionamentos e aplica limite de tempo.
 */
export async function fetchSeguro(
  entrada: string,
  init: RequestInit = {},
  opcoes: OpcoesFetchSeguro = {},
): Promise<Response> {
  const v = await validarUrlDoServidor(entrada, opcoes);
  if (!v.ok) throw new ErroUrlInsegura(v.motivo);

  const resposta = await fetch(v.url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? 20_000),
  });

  // Redirecionamento pode levar a um endereço interno: não seguimos.
  if (resposta.status >= 300 && resposta.status < 400) {
    throw new ErroUrlInsegura("O servidor respondeu com redirecionamento, que não é seguido por segurança.");
  }
  return resposta;
}
