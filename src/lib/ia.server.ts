/**
 * Interpretação de intenção via IA (Lovable ou Gemini — ver ia-chave.server.ts).
 * Somente servidor.
 *
 * A IA é usada APENAS para entender o que o cliente quis dizer (mapear a
 * resposta livre para uma das opções cadastradas). Nenhum valor financeiro é
 * calculado ou sugerido pela IA — o preço vem sempre de src/lib/calc.ts.
 */

import { gerarTextoIA } from "@/lib/ia-chave.server";

interface RespostaIA {
  ok: boolean;
  conteudo: string;
}

async function chamarIA(sistema: string, usuario: string): Promise<RespostaIA> {
  const r = await gerarTextoIA(sistema, usuario);
  const conteudo = r.conteudo ?? "";
  return { ok: Boolean(conteudo), conteudo };
}

/**
 * Mapeia a resposta livre do cliente para uma das opções.
 * Retorna o índice (0-based) ou null quando não houver correspondência clara.
 */
export async function interpretarOpcao(
  pergunta: string,
  respostaCliente: string,
  opcoes: string[],
): Promise<number | null> {
  if (opcoes.length === 0) return null;

  const lista = opcoes.map((o, i) => `${i + 1}. ${o}`).join("\n");

  const r = await chamarIA(
    "Você interpreta respostas de clientes de uma gráfica em português do Brasil. " +
      "Responda SOMENTE com o número da opção escolhida, ou 0 se não for possível identificar. " +
      "Nunca escreva mais nada além do número.",
    `Pergunta feita ao cliente: ${pergunta}\nOpções:\n${lista}\n\nResposta do cliente: "${respostaCliente}"\n\nNúmero da opção:`,
  );

  if (!r.ok) return null;

  const n = Number((/\d+/.exec(r.conteudo) ?? ["0"])[0]);
  if (!Number.isFinite(n) || n < 1 || n > opcoes.length) return null;
  return n - 1;
}

/** Interpreta uma resposta de sim/não em linguagem natural. */
export async function interpretarSimNao(pergunta: string, respostaCliente: string): Promise<boolean | null> {
  const i = await interpretarOpcao(pergunta, respostaCliente, ["Sim", "Não"]);
  if (i === null) return null;
  return i === 0;
}

/** Interpreta uma quantidade informada em texto livre ("duas cópias" → 2). */
export async function interpretarQuantidade(pergunta: string, respostaCliente: string): Promise<number | null> {
  const r = await chamarIA(
    "Você extrai quantidades numéricas de respostas de clientes em português do Brasil. " +
      "Responda SOMENTE com o número inteiro, ou -1 se não for possível identificar.",
    `Pergunta: ${pergunta}\nResposta do cliente: "${respostaCliente}"\n\nNúmero:`,
  );

  if (!r.ok) return null;
  const n = Number((/-?\d+/.exec(r.conteudo) ?? ["-1"])[0]);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
