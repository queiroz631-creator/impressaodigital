export const STATUS_ORCAMENTO = [
  "pendente_envio",
  "pendente_aprovacao",
  "pendente_pagamento",
  "aprovado",
  "recusado",
  "expirado",
  "cancelado",
  "finalizado",
] as const;

export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number];

export const rotuloStatus: Record<string, string> = {
  pendente_envio: "Pendente de envio",
  pendente_aprovacao: "Pendente de aprovação",
  pendente_pagamento: "Pendente de pagamento",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
  // compatibilidade com registros antigos
  rascunho: "Pendente de envio",
  enviado: "Pendente de aprovação",
};

export function normalizarStatus(status: string | null | undefined): StatusOrcamento {
  if (status === "rascunho" || !status) return "pendente_envio";
  if (status === "enviado") return "pendente_aprovacao";
  return (STATUS_ORCAMENTO as readonly string[]).includes(status)
    ? (status as StatusOrcamento)
    : "pendente_envio";
}