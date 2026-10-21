/**
 * Ordem da lista de conversas do WhatsApp.
 *
 * Regra: o botão ao lado da pesquisa alterna entre "mais novas primeiro"
 * (padrão) e "mais antigas primeiro". O momento considerado é o da última
 * mensagem; quando não há última mensagem, vale a data de criação da conversa.
 * Um momento ausente ou inválido é tratado como o mais antigo possível.
 */
export interface ConversaParaOrdem {
  ultima_mensagem_em: string | null;
  created_at: string;
}

function momento(conversa: ConversaParaOrdem): number {
  const valor = new Date(conversa.ultima_mensagem_em ?? conversa.created_at).getTime();
  return Number.isFinite(valor) ? valor : 0;
}

/** Ordena as conversas sem alterar a lista recebida. */
export function ordenarConversas<T extends ConversaParaOrdem>(
  conversas: readonly T[],
  recentesPrimeiro: boolean,
): T[] {
  return [...conversas].sort((a, b) =>
    recentesPrimeiro ? momento(b) - momento(a) : momento(a) - momento(b),
  );
}
