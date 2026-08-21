/**
 * Interpretação de intenção com a Lovable AI. Somente servidor.
 *
 * A IA é usada APENAS para entender o que o cliente quis dizer (mapear a
 * resposta livre para uma das opções cadastradas). Nenhum valor financeiro é
 * calculado ou sugerido pela IA — o preço vem sempre de src/lib/calc.ts.
 */

const MODELO = "google/gemini-2.5-flash";

interface RespostaIA {
  ok: boolean;
  conteudo: string;
}

async function chamarIA(sistema: string, usuario: string): Promise<RespostaIA> {
  const chaveApi = process.env["LOVABLE_API_KEY"];
  if (!chaveApi) return { ok: false, conteudo: "" };

  try {
    const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chaveApi}` },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
    });

    if (!resposta.ok) return { ok: false, conteudo: "" };

    const dados = (await resposta.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const conteudo = dados.choices?.[0]?.message?.content ?? "";
    return { ok: Boolean(conteudo), conteudo: conteudo.trim() };
  } catch {
    return { ok: false, conteudo: "" };
  }
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
