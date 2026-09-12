/**
 * Camada de acesso à IA. Somente servidor (arquivo *.server.ts).
 *
 * Dois provedores, escolhidos por variável de ambiente:
 * - `GEMINI_API_KEY` definida (ex.: VPS) → API oficial do Google Gemini
 *   (`generativelanguage.googleapis.com`, modelo gemini-2.5-flash).
 * - Caso contrário (ambiente Lovable) → gateway do Lovable
 *   (`ai.gateway.lovable.dev`) com `LOVABLE_API_KEY` — comportamento original.
 *
 * Nenhuma chave é exposta ao frontend: este módulo só roda no servidor.
 */

const GEMINI_MODELO = "gemini-2.5-flash";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODELO = "google/gemini-2.5-flash";
/** Modelo com entrada de áudio usado no gateway Lovable (transcrição). */
const LOVABLE_MODELO_AUDIO = "google/gemini-3.7-flash";

export interface ResultadoIA {
  /** HTTP status do provedor (0 = sem chave configurada ou falha de rede). */
  status: number;
  /** Texto retornado pelo modelo (null em erro). */
  conteudo: string | null;
  /** Corpo de erro do provedor (para extrair mensagens), quando houver. */
  erroBruto?: string;
}

function chaveGemini(): string | null {
  const k = process.env["GEMINI_API_KEY"];
  return k && k.trim() ? k.trim() : null;
}

/** Converte o formato de áudio do WhatsApp (ogg/opus) para o MIME aceito. */
function mimeAudio(formato: string): string {
  const f = formato.toLowerCase();
  if (f === "opus" || f === "oga") return "audio/ogg";
  if (f === "mp3" || f === "mpeg") return "audio/mp3";
  if (f === "m4a" || f === "mp4") return "audio/mp4";
  if (f === "wav") return "audio/wav";
  if (f === "webm") return "audio/webm";
  if (f === "flac") return "audio/flac";
  if (f === "aac") return "audio/aac";
  return `audio/${f || "ogg"}`;
}

/** Extrai o texto da resposta do Gemini (generateContent). */
function textoGemini(json: unknown): string {
  const partes =
    (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts ?? [];
  return partes
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

/** Chamada de texto: prompt de sistema + prompt do usuário, opcionalmente JSON. */
export async function gerarTextoIA(
  sistema: string,
  usuario: string,
  opcoes: { json?: boolean } = {},
): Promise<ResultadoIA> {
  const gemini = chaveGemini();

  if (gemini) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": gemini },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistema }] },
            contents: [{ role: "user", parts: [{ text: usuario }] }],
            generationConfig: {
              temperature: 0,
              ...(opcoes.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      if (!r.ok) return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
      return { status: 200, conteudo: textoGemini(await r.json()) };
    } catch {
      return { status: 0, conteudo: null };
    }
  }

  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave) return { status: 0, conteudo: null };

  try {
    const r = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: LOVABLE_MODELO,
        temperature: 0,
        ...(opcoes.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
    });
    if (!r.ok) return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return { status: 200, conteudo: (j.choices?.[0]?.message?.content ?? "").trim() };
  } catch {
    return { status: 0, conteudo: null };
  }
}

/** Transcrição de áudio (base64). Aceita OGG/Opus do WhatsApp. */
export async function transcreverAudioIA(
  prompt: string,
  base64: string,
  formato: string,
): Promise<ResultadoIA> {
  const gemini = chaveGemini();

  if (gemini) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": gemini },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeAudio(formato), data: base64 } },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        },
      );
      if (!r.ok) return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
      return { status: 200, conteudo: textoGemini(await r.json()) };
    } catch {
      return { status: 0, conteudo: null };
    }
  }

  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave) return { status: 0, conteudo: null };

  try {
    const r = await fetch(LOVABLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        // Modelo que aceita áudio OGG/Opus (formato dos áudios do WhatsApp).
        model: LOVABLE_MODELO_AUDIO,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "input_audio", input_audio: { data: base64, format: formato } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
    const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[] };
    const c = j.choices?.[0]?.message?.content;
    return { status: 200, conteudo: (typeof c === "string" ? c : "").trim() };
  } catch {
    return { status: 0, conteudo: null };
  }
}
