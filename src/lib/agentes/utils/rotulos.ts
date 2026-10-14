/**
 * Rótulos e chaves de estado da Central de Agentes.
 *
 * Apenas apresentação: os valores persistidos são exatamente os mesmos das
 * restrições CHECK no banco (migrations `agente*`). Nenhuma lógica de negócio
 * deve depender dos textos aqui.
 */

export const ROTULOS_TIPO_AGENTE: Record<string, string> = {
  atendimento: "Atendimento",
  operacional: "Operacional",
  operador_computador: "Operador de computador",
  personalizado: "Personalizado",
};

export const ROTULOS_STATUS_EXECUCAO: Record<string, string> = {
  pendente: "Pendente",
  executando: "Executando",
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_reconciliacao: "Aguardando reconciliação",
  concluida: "Concluída",
  falha: "Falha",
  cancelada: "Cancelada",
  indeterminado: "Indeterminado",
};

export const ROTULOS_STATUS_PASSO: Record<string, string> = {
  pendente: "Pendente",
  executando: "Executando",
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_reconciliacao: "Aguardando reconciliação",
  concluido: "Concluído",
  falha: "Falha",
  cancelado: "Cancelado",
};

export const ROTULOS_STATUS_APROVACAO: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
};

export const ROTULOS_STATUS_TAREFA: Record<string, string> = {
  aguardando: "Aguardando",
  em_execucao: "Em execução",
  concluida: "Concluída",
  falha: "Falha",
  cancelada: "Cancelada",
  aguardando_reconciliacao: "Aguardando reconciliação",
};

export const ROTULOS_ORIGEM: Record<string, string> = {
  usuario: "Usuário",
  whatsapp: "WhatsApp",
  automacao: "Automação",
  agente: "Outro agente",
  api: "API",
  manual: "Manual",
};

export const ROTULOS_RISCO: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export const ROTULOS_SITUACAO_DISPOSITIVO: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  inativo: "Inativo",
};

export function rotulo(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "—";
  return mapa[valor] ?? valor;
}

/** Variação visual (classes de badge) por status de execução. */
export function corStatusExecucao(status: string): string {
  switch (status) {
    case "concluida":
      return "bg-emerald-600 hover:bg-emerald-600 text-white";
    case "falha":
    case "indeterminado":
      return "bg-destructive text-destructive-foreground";
    case "executando":
      return "bg-sky-600 hover:bg-sky-600 text-white";
    case "aguardando_aprovacao":
      return "bg-amber-500 hover:bg-amber-500 text-white";
    case "aguardando_reconciliacao":
      return "bg-violet-600 hover:bg-violet-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}
