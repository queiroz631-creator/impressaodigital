/**
 * Dados temporários do fluxo de entrada do portal (CPF/telefone) enquanto o
 * participante avança entre as telas. Vivem só no sessionStorage da aba e
 * são apagados assim que a sessão é criada — nunca vão para a URL.
 */

const CHAVE = "sorteios-fluxo";

export interface FluxoPublico {
  cpf?: string;
  telefone?: string;
  lembrar?: boolean;
  faltantes?: ("nome" | "data_nascimento")[];
  /** Somente para exibição na tela de telefone — nunca autoriza nada. */
  cadastroEncontrado?: boolean;
  nomeExibicao?: string | null;
  telefoneFinal?: string | null;
}


export function lerFluxo(): FluxoPublico {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}") as FluxoPublico;
  } catch {
    return {};
  }
}

export function gravarFluxo(dados: FluxoPublico): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    /* armazenamento indisponível: o fluxo recomeça na entrada */
  }
}

export function limparFluxo(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}
