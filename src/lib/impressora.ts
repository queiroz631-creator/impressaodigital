/**
 * Camada de abstração de impressão (printerService).
 *
 * Impressão direta: QZ Tray (agente local instalado na máquina), carregado
 * dinamicamente no navegador via pacote `qz-tray`.
 * Fallback: impressão pelo navegador (window.print) com layout 80mm.
 */

export type MetodoImpressao = "navegador" | "qz";

export interface ResultadoImpressao {
  metodo: MetodoImpressao;
  impressora: string | null;
  mensagem?: string;
}

export type StatusQz = "conectado" | "agente_ausente" | "script_indisponivel";

/* eslint-disable @typescript-eslint/no-explicit-any */

function qz(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).qz ?? null;
}

let carregamentoQz: Promise<any | null> | null = null;

/**
 * Carrega o script do QZ Tray (somente no navegador) e expõe em window.qz.
 * Retorna null quando o pacote não puder ser carregado.
 */
export function carregarQz(): Promise<any | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existente = qz();
  if (existente) return Promise.resolve(existente);

  if (!carregamentoQz) {
    carregamentoQz = import("qz-tray")
      .then((mod) => {
        const api = (mod as any).default ?? mod;
        (window as any).qz = api;
        return api;
      })
      .catch(() => null);
  }
  return carregamentoQz;
}

/**
 * Conecta ao agente local do QZ Tray.
 *
 * Sem certificado configurado, o QZ Tray exibe um aviso de "site não
 * confiável" na primeira conexão — basta o usuário clicar em "Allow" e
 * marcar "Remember this decision" (ou habilitar "Allow unsigned requests"
 * nas opções avançadas do QZ Tray).
 */
export async function conectarQz(): Promise<boolean> {
  const api = await carregarQz();
  if (!api?.websocket) return false;
  try {
    if (api.websocket.isActive?.()) return true;
    await api.websocket.connect({ retries: 2, delay: 1 });
    return true;
  } catch {
    return false;
  }
}

/** Diagnóstico da integração QZ Tray (para a tela de Configurações). */
export async function statusQz(): Promise<StatusQz> {
  const api = await carregarQz();
  if (!api?.websocket || !api?.printers) return "script_indisponivel";
  return (await conectarQz()) ? "conectado" : "agente_ausente";
}

/** Síncrono: verdadeiro apenas quando o agente já está carregado e conectado. */
export function qzDisponivel(): boolean {
  const api = qz();
  return !!api?.printers && !!api?.websocket?.isActive?.();
}

/** Lista as impressoras instaladas (somente com agente local disponível). */
export async function listarImpressoras(): Promise<string[]> {
  if (!(await conectarQz())) return [];
  try {
    const lista = await qz().printers.find();
    return Array.isArray(lista) ? lista.map(String) : [String(lista)];
  } catch {
    return [];
  }
}

/** Primeira impressora configurada que estiver realmente disponível. */
export async function obterImpressoraPadrao(configuradas: string[]): Promise<string | null> {
  const validas = configuradas.map((n) => n.trim()).filter(Boolean);
  if (validas.length === 0) return null;
  const disponiveis = await listarImpressoras();
  if (disponiveis.length === 0) return validas[0] ?? null;
  const achada = validas.find((nome) =>
    disponiveis.some((d) => d.toLowerCase() === nome.toLowerCase()),
  );
  return achada ?? validas[0] ?? null;
}

/**
 * Texto plano da etiqueta exibida no diálogo (#etiqueta-print).
 * Usado para a impressão direta (raw) via QZ Tray.
 */
function textoDaEtiqueta(): string {
  if (typeof document === "undefined") return "";
  const origem = document.getElementById("etiqueta-print");
  return (origem?.innerText ?? "").replace(/ /g, " ").trim();
}

/** Alimenta o papel e aciona a guilhotina (ESC/POS: GS V 0). */
const DADOS_CORTE = [{ type: "raw", format: "hex", data: "0A0A0A1D5600" }];

async function imprimirViaQz(texto: string, impressora: string): Promise<boolean> {
  if (!texto.trim()) return false;
  if (!(await conectarQz())) return false;
  try {
    const api = qz();
    const config = api.configs.create(impressora);
    await api.print(config, [
      { type: "raw", format: "plain", data: `${texto}\n` },
      ...DADOS_CORTE,
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Imprime pelo navegador clonando a etiqueta para uma área de impressão
 * anexada ao <body>, fora do diálogo (que recorta e rola o conteúdo).
 */
function imprimirPeloNavegador(texto?: string) {
  if (typeof window === "undefined") return;

  document.getElementById("etiqueta-print-area")?.remove();

  const area = document.createElement("div");
  area.id = "etiqueta-print-area";

  const origem = document.getElementById("etiqueta-print");
  if (origem) {
    const copia = origem.cloneNode(true) as HTMLElement;
    copia.removeAttribute("id");
    copia.classList.add("etiqueta-80mm", "etiqueta-impressao");
    area.appendChild(copia);
  } else {
    const bloco = document.createElement("div");
    bloco.className = "etiqueta-80mm";
    bloco.textContent = texto ?? "";
    area.appendChild(bloco);
  }

  document.body.appendChild(area);

  const limpar = () => {
    area.remove();
    window.removeEventListener("afterprint", limpar);
  };
  window.addEventListener("afterprint", limpar);

  try {
    window.print();
  } finally {
    setTimeout(limpar, 1000);
  }
}

/**
 * Imprime a etiqueta: tenta o agente local (impressão direta) e,
 * quando indisponível, usa a caixa de impressão do navegador em 80mm.
 */
export async function imprimirEtiqueta(
  texto: string,
  impressora?: string | null,
): Promise<ResultadoImpressao> {
  const conteudo = texto.trim() || textoDaEtiqueta();

  if (impressora) {
    if (await imprimirViaQz(conteudo, impressora)) {
      return { metodo: "qz", impressora };
    }
    imprimirPeloNavegador();
    return {
      metodo: "navegador",
      impressora,
      mensagem: await motivoFalhaQz(impressora),
    };
  }

  imprimirPeloNavegador();
  return { metodo: "navegador", impressora: null };
}

/** Explica por que a impressão direta não aconteceu. */
export async function motivoFalhaQz(impressora: string): Promise<string> {
  const status = await statusQz();
  if (status === "script_indisponivel") {
    return "Componente de impressão direta indisponível. Usando a janela do navegador.";
  }
  if (status === "agente_ausente") {
    return "QZ Tray não conectado. Inicie o agente no computador para imprimir direto na térmica.";
  }
  const disponiveis = await listarImpressoras();
  const existe = disponiveis.some((d) => d.toLowerCase() === impressora.toLowerCase());
  return existe
    ? `Falha ao enviar para "${impressora}". Verifique se a impressora está ligada.`
    : `Impressora "${impressora}" não encontrada no computador. Ajuste em Configurações → Impressão.`;
}


/** Força a caixa de diálogo do navegador (permite escolher a impressora). */
export function escolherImpressora(): ResultadoImpressao {
  imprimirPeloNavegador();
  return { metodo: "navegador", impressora: null };
}

export function etiquetaDeTeste(impressora: string | null, largura = 80): string {
  const linha = "================================";
  return [
    linha,
    "TESTE DE IMPRESSÃO",
    linha,
    "",
    "IMPRESSORA:",
    impressora || "Impressora padrão do navegador",
    "",
    "FORMATO:",
    `${largura}mm`,
    "",
    "DATA:",
    new Date().toLocaleString("pt-BR"),
    "",
    "--------------------------------",
    "TESTE REALIZADO COM SUCESSO",
    linha,
  ].join("\n");
}

/** Envia a etiqueta de teste para a impressora configurada. */
export async function testarImpressora(
  impressora: string | null,
  largura = 80,
): Promise<ResultadoImpressao> {
  const texto = etiquetaDeTeste(impressora, largura);
  if (impressora && (await imprimirViaQz(texto, impressora))) {
    return { metodo: "qz", impressora };
  }
  imprimirPeloNavegador(texto);
  return { metodo: "navegador", impressora };
}
