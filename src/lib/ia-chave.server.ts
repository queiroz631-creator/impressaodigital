/**
 * Camada de acesso à IA. Somente servidor (arquivo *.server.ts).
 *
 * O provedor é escolhido na aba "IA" das Configurações e gravado no banco:
 * - `lovable_openai`  → gateway do Lovable, modelo OpenAI (padrão)
 * - `lovable_gemini`  → gateway do Lovable, modelo Google Gemini
 * - `openai_proprio`  → API da OpenAI com a chave do administrador
 * - `gemini_proprio`  → API do Google Gemini com a chave do administrador
 *
 * Sem nenhuma configuração gravada, mantém o comportamento antigo:
 * `GEMINI_API_KEY` do servidor quando existir, senão o gateway do Lovable.
 *
 * Nenhuma chave é exposta ao frontend: este módulo só roda no servidor.
 */

export type ProvedorIA =
  | "lovable_openai"
  | "lovable_gemini"
  | "openai_proprio"
  | "gemini_proprio";

export const PROVEDORES_IA: ProvedorIA[] = [
  "lovable_openai",
  "lovable_gemini",
  "openai_proprio",
  "gemini_proprio",
];

/** Modelos sugeridos por provedor (texto e áudio). */
export const MODELOS_PADRAO: Record<ProvedorIA, { texto: string; audio: string }> = {
  lovable_openai: { texto: "openai/gpt-6-astra", audio: "google/gemini-3.7-flash" },
  lovable_gemini: { texto: "google/gemini-3.6-flash", audio: "google/gemini-3.7-flash" },
  openai_proprio: { texto: "gpt-4o-mini", audio: "whisper-1" },
  gemini_proprio: { texto: "gemini-3.6-flash", audio: "gemini-3.6-flash" },
};

const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

export interface ResultadoIA {
  /** HTTP status do provedor (0 = sem chave configurada ou falha de rede). */
  status: number;
  /** Texto retornado pelo modelo (null em erro). */
  conteudo: string | null;
  /** Corpo de erro do provedor (para extrair mensagens), quando houver. */
  erroBruto?: string;
  /** Motivo de parada do modelo (ex.: MAX_TOKENS = resposta cortada). */
  motivoParada?: string;
}

/** Log de diagnóstico da IA. Nunca registra chaves. */
function registrarFalhaIA(onde: string, r: ResultadoIA) {
  const detalhe = (r.erroBruto ?? "").slice(0, 600);
  console.error(
    `[IA] ${onde} falhou status=${r.status} motivo=${r.motivoParada ?? "-"} detalhe=${detalhe}`,
  );
}

/** Falhas temporárias do provedor: vale tentar de novo. */
function falhaTemporaria(r: ResultadoIA): boolean {
  if (r.status === 0) return true; // rede
  if (r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504)
    return true;
  // Resposta cortada ou vazia com status 200 também é tratada como temporária.
  if (r.status === 200 && (r.motivoParada === "MAX_TOKENS" || !r.conteudo)) return true;
  return false;
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

interface ConfigIA {
  provedor: ProvedorIA;
  modeloTexto: string;
  modeloAudio: string;
  /** Chave própria do provedor escolhido (null quando usa o gateway Lovable). */
  chavePropria: string | null;
}

function chaveGeminiEnv(): string | null {
  const k = process.env["GEMINI_API_KEY"];
  return k && k.trim() ? k.trim() : null;
}

function provedorValido(v: unknown): ProvedorIA | null {
  return typeof v === "string" && (PROVEDORES_IA as string[]).includes(v)
    ? (v as ProvedorIA)
    : null;
}

let cache: { valor: ConfigIA; expira: number } | null = null;

/** Limpa o cache (usado ao salvar a configuração na tela). */
export function limparCacheIA() {
  cache = null;
}

/** Lê a chave própria gravada no cofre (tabela acessível só por service_role). */
export async function lerChavePropria(provedor: ProvedorIA): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ia_credenciais")
      .select("chave")
      .eq("provedor", provedor)
      .maybeSingle();
    const chave = data?.chave?.trim();
    return chave ? chave : null;
  } catch {
    return null;
  }
}

/** Resolve provedor + modelos + chave, com cache curto. */
export async function resolverConfigIA(): Promise<ConfigIA> {
  if (cache && cache.expira > Date.now()) return cache.valor;

  const legado = (): ConfigIA => {
    const env = chaveGeminiEnv();
    return env
      ? {
          provedor: "gemini_proprio",
          modeloTexto: MODELOS_PADRAO.gemini_proprio.texto,
          modeloAudio: MODELOS_PADRAO.gemini_proprio.audio,
          chavePropria: env,
        }
      : {
          provedor: "lovable_gemini",
          modeloTexto: MODELOS_PADRAO.lovable_gemini.texto,
          modeloAudio: MODELOS_PADRAO.lovable_gemini.audio,
          chavePropria: null,
        };
  };

  let valor: ConfigIA;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("configuracoes")
      .select("ia_provedor, ia_modelo, ia_modelo_audio")
      .limit(1)
      .maybeSingle();

    const provedor = provedorValido(data?.ia_provedor);
    if (!data || !provedor) {
      valor = legado();
    } else {
      const padrao = MODELOS_PADRAO[provedor];
      const proprio = provedor === "openai_proprio" || provedor === "gemini_proprio";
      let chave: string | null = null;
      if (proprio) {
        chave = await lerChavePropria(provedor);
        if (!chave && provedor === "gemini_proprio") chave = chaveGeminiEnv();
      }

      if (proprio && !chave) {
        // Sem chave própria gravada: usa o gateway Lovable do mesmo fabricante.
        const alternativo: ProvedorIA =
          provedor === "openai_proprio" ? "lovable_openai" : "lovable_gemini";
        valor = {
          provedor: alternativo,
          modeloTexto: MODELOS_PADRAO[alternativo].texto,
          modeloAudio: MODELOS_PADRAO[alternativo].audio,
          chavePropria: null,
        };
      } else {
        valor = {
          provedor,
          modeloTexto: data.ia_modelo?.trim() || padrao.texto,
          modeloAudio: data.ia_modelo_audio?.trim() || padrao.audio,
          chavePropria: chave,
        };
      }
    }
  } catch {
    valor = legado();
  }

  cache = { valor, expira: Date.now() + 30_000 };
  return valor;
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

function chaveLovable(): string | null {
  const k = process.env["LOVABLE_API_KEY"];
  return k && k.trim() ? k.trim() : null;
}

/** Texto via API oficial do Google Gemini. */
async function textoGeminiDireto(
  chave: string,
  modelo: string,
  sistema: string,
  usuario: string,
  json: boolean,
): Promise<ResultadoIA> {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: {
            temperature: 0,
            ...(json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
    );
    if (!r.ok)
      return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
    return { status: 200, conteudo: textoGemini(await r.json()) };
  } catch {
    return { status: 0, conteudo: null };
  }
}

/** Texto via /chat/completions (gateway Lovable ou OpenAI própria). */
async function textoChatCompletions(
  url: string,
  headers: Record<string, string>,
  modelo: string,
  sistema: string,
  usuario: string,
  json: boolean,
  openaiProprio: boolean,
): Promise<ResultadoIA> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        model: modelo,
        ...(openaiProprio ? {} : { temperature: 0 }),
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
    });
    if (!r.ok)
      return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return { status: 200, conteudo: (j.choices?.[0]?.message?.content ?? "").trim() };
  } catch {
    return { status: 0, conteudo: null };
  }
}

/**
 * Texto via Responses API do gateway Lovable (modelos OpenAI).
 * A chamada é sempre em streaming — o texto é montado aqui no servidor.
 */
async function textoResponsesLovable(
  chave: string,
  modelo: string,
  sistema: string,
  usuario: string,
  json: boolean,
): Promise<ResultadoIA> {
  try {
    const r = await fetch(`${LOVABLE_BASE}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": chave,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: modelo,
        instructions: sistema,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: json ? `${usuario}\n\nResponda somente com JSON válido.` : usuario,
              },
            ],
          },
        ],
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        store: false,
      }),
    });

    if (!r.ok || !r.body)
      return { status: r.ok ? 0 : r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };

    const leitor = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";

    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split("\n");
      buffer = linhas.pop() ?? "";
      for (const linha of linhas) {
        if (!linha.startsWith("data:")) continue;
        const bruto = linha.slice(5).trim();
        if (!bruto || bruto === "[DONE]") continue;
        try {
          const evento = JSON.parse(bruto) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") {
            texto += evento.delta;
          } else if (
            evento.type === "response.completed" &&
            !texto &&
            typeof evento.response?.output_text === "string"
          ) {
            texto = evento.response.output_text;
          }
        } catch {
          // Evento parcial ou desconhecido: ignora.
        }
      }
    }

    return { status: 200, conteudo: texto.trim() };
  } catch {
    return { status: 0, conteudo: null };
  }
}

/** Chamada de texto: prompt de sistema + prompt do usuário, opcionalmente JSON. */
export async function gerarTextoIA(
  sistema: string,
  usuario: string,
  opcoes: { json?: boolean } = {},
): Promise<ResultadoIA> {
  const cfg = await resolverConfigIA();
  const json = Boolean(opcoes.json);

  if (cfg.provedor === "gemini_proprio" && cfg.chavePropria)
    return textoGeminiDireto(cfg.chavePropria, cfg.modeloTexto, sistema, usuario, json);

  if (cfg.provedor === "openai_proprio" && cfg.chavePropria)
    return textoChatCompletions(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${cfg.chavePropria}` },
      cfg.modeloTexto,
      sistema,
      usuario,
      json,
      true,
    );

  const chave = chaveLovable();
  if (!chave) return { status: 0, conteudo: null };

  if (cfg.provedor === "lovable_openai")
    return textoResponsesLovable(chave, cfg.modeloTexto, sistema, usuario, json);

  return textoChatCompletions(
    `${LOVABLE_BASE}/chat/completions`,
    { Authorization: `Bearer ${chave}` },
    cfg.modeloTexto,
    sistema,
    usuario,
    json,
    false,
  );
}

/** Transcrição de áudio (base64). Aceita OGG/Opus do WhatsApp. */
export async function transcreverAudioIA(
  prompt: string,
  base64: string,
  formato: string,
): Promise<ResultadoIA> {
  const cfg = await resolverConfigIA();

  if (cfg.provedor === "gemini_proprio" && cfg.chavePropria) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cfg.modeloAudio}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.chavePropria },
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
      if (!r.ok)
        return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
      return { status: 200, conteudo: textoGemini(await r.json()) };
    } catch {
      return { status: 0, conteudo: null };
    }
  }

  if (cfg.provedor === "openai_proprio" && cfg.chavePropria) {
    try {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const forma = new FormData();
      forma.append("model", cfg.modeloAudio);
      forma.append(
        "file",
        new Blob([bytes], { type: mimeAudio(formato) }),
        `audio.${formato || "ogg"}`,
      );
      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.chavePropria}` },
        body: forma,
      });
      if (!r.ok)
        return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
      const j = (await r.json()) as { text?: string };
      return { status: 200, conteudo: (j.text ?? "").trim() };
    } catch {
      return { status: 0, conteudo: null };
    }
  }

  const chave = chaveLovable();
  if (!chave) return { status: 0, conteudo: null };

  // Gateway Lovable: modelo com entrada de áudio (Gemini aceita OGG/Opus do WhatsApp).
  const modeloAudio =
    cfg.provedor === "lovable_openai" && !cfg.modeloAudio.startsWith("google/")
      ? MODELOS_PADRAO.lovable_openai.audio
      : cfg.modeloAudio;

  try {
    const r = await fetch(`${LOVABLE_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modeloAudio,
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
    if (!r.ok)
      return { status: r.status, conteudo: null, erroBruto: await r.text().catch(() => "") };
    const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[] };
    const c = j.choices?.[0]?.message?.content;
    return { status: 200, conteudo: (typeof c === "string" ? c : "").trim() };
  } catch {
    return { status: 0, conteudo: null };
  }
}
