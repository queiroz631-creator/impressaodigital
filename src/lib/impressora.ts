/**
 * Camada de abstração de impressão (printerService).
 *
 * Hoje: impressão pelo navegador (window.print) com layout 80mm.
 * Futuro: impressão direta via QZ Tray — basta o agente local estar
 * disponível em window.qz; nenhuma tela precisa ser refeita.
 */

export type MetodoImpressao = "navegador" | "qz";

export interface ResultadoImpressao {
  metodo: MetodoImpressao;
  impressora: string | null;
  mensagem?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function qz(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).qz ?? null;
}

export function qzDisponivel(): boolean {
  const api = qz();
  return !!api?.printers && !!api?.websocket;
}

async function garantirConexao(): Promise<boolean> {
  const api = qz();
  if (!api?.websocket) return false;
  try {
    if (api.websocket.isActive?.()) return true;
    await api.websocket.connect();
    return true;
  } catch {
    return false;
  }
}

/** Lista as impressoras instaladas (somente com agente local disponível). */
export async function listarImpressoras(): Promise<string[]> {
  if (!qzDisponivel()) return [];
  if (!(await garantirConexao())) return [];
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

async function imprimirViaQz(texto: string, impressora: string): Promise<boolean> {
  if (!qzDisponivel()) return false;
  if (!(await garantirConexao())) return false;
  try {
    const api = qz();
    const config = api.configs.create(impressora);
    await api.print(config, [{ type: "raw", format: "plain", data: `${texto}\n\n\n` }]);
    return true;
  } catch {
    return false;
  }
}

/** Imprime pelo navegador usando o elemento #etiqueta-print já renderizado. */
function imprimirPeloNavegador(texto?: string) {
  if (typeof window === "undefined") return;
  let temporario: HTMLElement | null = null;
  if (texto !== undefined && !document.getElementById("etiqueta-print")) {
    temporario = document.createElement("div");
    temporario.id = "etiqueta-print";
    temporario.className = "etiqueta-80mm";
    temporario.textContent = texto;
    document.body.appendChild(temporario);
  }
  window.print();
  if (temporario) temporario.remove();
}

/**
 * Imprime a etiqueta: tenta o agente local (impressão direta) e,
 * quando indisponível, usa a caixa de impressão do navegador em 80mm.
 */
export async function imprimirEtiqueta(
  texto: string,
  impressora?: string | null,
): Promise<ResultadoImpressao> {
  if (impressora && (await imprimirViaQz(texto, impressora))) {
    return { metodo: "qz", impressora };
  }
  imprimirPeloNavegador();
  return {
    metodo: "navegador",
    impressora: impressora ?? null,
    ...(impressora
      ? {
          mensagem:
            "A seleção automática da impressora não está disponível neste navegador. Selecione a impressora configurada na janela de impressão.",
        }
      : {}),
  };
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
