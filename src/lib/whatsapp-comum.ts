/** Helpers do atendimento via WhatsApp usados no cliente e no servidor. */

export type StatusConversa =
  | "automatico"
  | "aguardando"
  | "em_atendimento"
  | "pendente"
  | "aguardando_finalizacao"
  | "finalizado";

export const STATUS_CONVERSA: { valor: StatusConversa; rotulo: string }[] = [
  { valor: "automatico", rotulo: "Automático" },
  { valor: "aguardando", rotulo: "Aguardando Resposta" },
  { valor: "em_atendimento", rotulo: "Em Atendimento" },
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "aguardando_finalizacao", rotulo: "Aguardando Finalização" },
  { valor: "finalizado", rotulo: "Finalizado" },
];

export const rotuloStatusConversa: Record<string, string> = {
  automatico: "Automático",
  aguardando: "Aguardando Resposta",
  em_atendimento: "Em Atendimento",
  pendente: "Pendente",
  aguardando_finalizacao: "Aguardando Finalização",
  finalizado: "Finalizado",
};

export const rotuloEtapa: Record<string, string> = {
  inicio: "Início",
  aguardando_nome: "Aguardando nome",
  aguardando_arquivos: "Aguardando arquivos",
  analisando_arquivos: "Analisando arquivos",
  aguardando_tipo: "Aguardando tipo de impressão",
  aguardando_formato: "Aguardando formato",
  aguardando_material: "Aguardando material",
  aguardando_copias: "Aguardando cópias",
  aguardando_frente_verso: "Aguardando frente e verso",
  aguardando_acabamento: "Aguardando acabamento",
  calculando: "Calculando",
  aguardando_confirmacao: "Aguardando confirmação",
  aguardando_revisao: "Aguardando revisão",
  aguardando_atendente: "Aguardando atendente",
  finalizado: "Finalizado",
};

/**
 * Normaliza um telefone para o padrão 55DDDNUMERO.
 * Retorna string vazia quando não for possível normalizar.
 */
export function normalizarTelefone(valor: string | null | undefined): string {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return "";

  let numero = digitos;

  // Remove zeros de discagem no início.
  numero = numero.replace(/^0+/, "");

  if (!numero.startsWith("55")) {
    // Número nacional (10 ou 11 dígitos) recebe o DDI do Brasil.
    if (numero.length === 10 || numero.length === 11) numero = `55${numero}`;
  }

  if (numero.length < 12 || numero.length > 13) return numero.length >= 10 ? numero : "";

  return numero;
}

/** Formata o telefone normalizado para exibição: (11) 99999-9999. */
export function formatarTelefone(valor: string | null | undefined): string {
  const n = normalizarTelefone(valor);
  if (!n) return String(valor ?? "");
  const semDdi = n.startsWith("55") ? n.slice(2) : n;
  const ddd = semDdi.slice(0, 2);
  const resto = semDdi.slice(2);
  if (resto.length === 9) return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
  if (resto.length === 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return String(valor ?? "");
}

export function dataHoraCurta(valor: string | null | undefined) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
