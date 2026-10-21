import { describe, expect, it } from "vitest";
import { idOriginalEvolution, lerUrlMidiaProvedor, montarUrlMidiaProvedor, prefixarIdEvolution } from "./evolution-ids";
import { normalizarWebhookEvolution } from "./evolution-webhook";

const CONEXAO = "11111111-1111-4111-8111-111111111111";
const ctx = { conexaoId: CONEXAO };
const PREF = (id: string) => `evo:${CONEXAO}:${id}`;

function upsert(message: Record<string, unknown>, key: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    event: "messages.upsert",
    instance: "inst-1",
    apikey: "SEGREDO-DO-SERVIDOR",
    server_url: "https://evo.exemplo.com",
    data: {
      key: { remoteJid: "5511999990000@s.whatsapp.net", fromMe: false, id: "3EB0AAA", ...key },
      pushName: "Maria",
      message,
      messageType: "conversation",
      messageTimestamp: 1717689097,
      ...extra,
    },
  };
}

describe("ids da Evolution", () => {
  it("prefixa por conexão e recupera o id original", () => {
    expect(prefixarIdEvolution(CONEXAO, "ABC")).toBe(PREF("ABC"));
    expect(idOriginalEvolution(PREF("ABC"))).toBe("ABC");
    expect(idOriginalEvolution("ABC")).toBe("ABC");
  });

  it("o mesmo id em conexões diferentes gera ids gravados diferentes (evita colisão no índice global)", () => {
    expect(prefixarIdEvolution(CONEXAO, "X")).not.toBe(prefixarIdEvolution("22222222-2222-4222-8222-222222222222", "X"));
  });

  it("referência de mídia: monta, lê e rejeita lixo", () => {
    const url = montarUrlMidiaProvedor(CONEXAO, "3EB0/AAA");
    expect(lerUrlMidiaProvedor(url)).toEqual({ conexaoId: CONEXAO, idMensagem: "3EB0/AAA" });
    for (const ruim of [null, undefined, "", "https://x/y", "provedor-midia://nao-uuid/abc", `provedor-midia://${CONEXAO}/`, `provedor-midia://${CONEXAO}`]) {
      expect(lerUrlMidiaProvedor(ruim)).toBeNull();
    }
  });
});

describe("normalizarWebhookEvolution — mensagens", () => {
  it("texto simples (conversation)", () => {
    expect(normalizarWebhookEvolution(upsert({ conversation: "Olá" }), ctx)).toMatchObject({
      tipo: "mensagem_recebida",
      idExterno: PREF("3EB0AAA"),
      telefone: "5511999990000",
      lid: null,
      nomeContato: "Maria",
      edicao: null,
      conteudo: { tipo: "texto", texto: "Olá", url: null },
    });
  });

  it("texto estendido (extendedTextMessage) e evento em maiúsculas com underline", () => {
    const corpo = { ...upsert({ extendedTextMessage: { text: "com link" } }), event: "MESSAGES_UPSERT" };
    expect(normalizarWebhookEvolution(corpo, ctx)).toMatchObject({ tipo: "mensagem_recebida", conteudo: { texto: "com link" } });
  });

  it("data como lista usa o primeiro item", () => {
    const base = upsert({ conversation: "x" });
    expect(normalizarWebhookEvolution({ ...base, data: [base.data] }, ctx)).toMatchObject({ tipo: "mensagem_recebida" });
  });

  it("fromMe → enviada fora do sistema; pushName (dono da conta) não vira nome do contato", () => {
    expect(normalizarWebhookEvolution(upsert({ conversation: "resposta" }, { fromMe: true }), ctx)).toMatchObject({
      tipo: "mensagem_enviada_fora",
      nomeContato: null,
    });
  });

  it("send.message também é tratado como mensagem", () => {
    expect(normalizarWebhookEvolution({ ...upsert({ conversation: "x" }, { fromMe: true }), event: "send.message" }, ctx)).toMatchObject({
      tipo: "mensagem_enviada_fora",
    });
  });

  it("imagem: legenda, nome por mime e referência de mídia com o id ORIGINAL", () => {
    expect(
      normalizarWebhookEvolution(upsert({ imageMessage: { caption: "foto", mimetype: "image/png", url: "https://mmg.whatsapp.net/x.enc" } }), ctx),
    ).toMatchObject({
      conteudo: { tipo: "imagem", texto: "foto", nome: "imagem.png", mime: "image/png", url: null, midia: { idMensagem: "3EB0AAA" } },
    });
  });

  it("documento: nome, mime, páginas; legenda igual ao nome vira texto vazio", () => {
    expect(
      normalizarWebhookEvolution(
        upsert({ documentMessage: { fileName: "a.pdf", caption: "A.PDF", mimetype: "application/pdf", pageCount: 5 } }),
        ctx,
      ),
    ).toMatchObject({ conteudo: { tipo: "documento", texto: "", nome: "a.pdf", mime: "application/pdf", paginas: 5, midia: { idMensagem: "3EB0AAA" } } });
  });

  it("documento com legenda dentro do invólucro documentWithCaptionMessage", () => {
    const m = { documentWithCaptionMessage: { message: { documentMessage: { fileName: "b.docx", caption: "imprimir 2 cópias" } } } };
    expect(normalizarWebhookEvolution(upsert(m), ctx)).toMatchObject({ conteudo: { tipo: "documento", texto: "imprimir 2 cópias", nome: "b.docx" } });
  });

  it("mensagem temporária (ephemeralMessage) é desembrulhada", () => {
    expect(normalizarWebhookEvolution(upsert({ ephemeralMessage: { message: { conversation: "temporária" } } }), ctx)).toMatchObject({
      conteudo: { tipo: "texto", texto: "temporária" },
    });
  });

  it("áudio, localização e respostas de botão/lista", () => {
    expect(normalizarWebhookEvolution(upsert({ audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true } }), ctx)).toMatchObject({
      conteudo: { tipo: "audio", nome: "audio.ogg", midia: { idMensagem: "3EB0AAA" } },
    });
    expect(normalizarWebhookEvolution(upsert({ locationMessage: { address: "Rua A, 10" } }), ctx)).toMatchObject({ conteudo: { tipo: "localizacao", texto: "Rua A, 10" } });
    expect(normalizarWebhookEvolution(upsert({ buttonsResponseMessage: { selectedDisplayText: "Sim" } }), ctx)).toMatchObject({ conteudo: { tipo: "botao", texto: "Sim" } });
    expect(normalizarWebhookEvolution(upsert({ listResponseMessage: { title: "Opção 2" } }), ctx)).toMatchObject({ conteudo: { tipo: "botao", texto: "Opção 2" } });
  });

  it("vídeo e conteúdo desconhecido são ignorados (como na Z-API)", () => {
    expect(normalizarWebhookEvolution(upsert({ videoMessage: { mimetype: "video/mp4" } }), ctx)).toMatchObject({ tipo: "ignorado", motivo: "sem_conteudo" });
    expect(normalizarWebhookEvolution(upsert({}), ctx)).toMatchObject({ tipo: "ignorado", motivo: "sem_conteudo" });
  });

  it("payload guardado NÃO contém chave do servidor, base64, miniaturas nem URL de CDN", () => {
    const ev = normalizarWebhookEvolution(
      upsert({ imageMessage: { url: "https://mmg.whatsapp.net/x.enc", jpegThumbnail: "AAAA", mediaKey: "K" }, base64: "ZZZZ" }),
      ctx,
    );
    const texto = JSON.stringify((ev as { bruto: unknown }).bruto);
    expect(texto).not.toContain("SEGREDO-DO-SERVIDOR");
    expect(texto).not.toContain("jpegThumbnail");
    expect(texto).not.toContain("mmg.whatsapp.net");
    expect(texto).not.toContain("ZZZZ");
    expect(texto).toContain("3EB0AAA");
  });
});

describe("normalizarWebhookEvolution — o que é ignorado", () => {
  it("grupo e status/difusão", () => {
    expect(normalizarWebhookEvolution(upsert({ conversation: "x" }, { remoteJid: "1203-123@g.us" }), ctx)).toMatchObject({ tipo: "ignorado", motivo: "grupo" });
    expect(normalizarWebhookEvolution(upsert({ conversation: "x" }, { remoteJid: "status@broadcast" }), ctx)).toMatchObject({ tipo: "ignorado", motivo: "status" });
  });

  it("sem id de mensagem ou sem key", () => {
    expect(normalizarWebhookEvolution({ event: "messages.upsert", data: { message: { conversation: "x" } } }, ctx)).toMatchObject({ tipo: "ignorado" });
    expect(normalizarWebhookEvolution(upsert({ conversation: "x" }, { id: "" }), ctx)).toMatchObject({ tipo: "ignorado" });
  });

  it("corpo inesperado nunca lança", () => {
    for (const ruim of [null, undefined, "x", 42, [], {}]) {
      expect(normalizarWebhookEvolution(ruim, ctx)).toMatchObject({ tipo: "ignorado" });
    }
  });

  it("eventos que não são mensagem: motivo = nome do evento", () => {
    expect(normalizarWebhookEvolution({ event: "messages.update", data: {} }, ctx)).toEqual({ tipo: "ignorado", motivo: "messages.update" });
    expect(normalizarWebhookEvolution({ event: "qrcode.updated", data: { qrcode: { base64: "x" } } }, ctx)).toEqual({ tipo: "ignorado", motivo: "qrcode.updated" });
  });
});

describe("normalizarWebhookEvolution — LID", () => {
  it("remoteJid LID com telefone alternativo usa o telefone", () => {
    expect(
      normalizarWebhookEvolution(upsert({ conversation: "oi" }, { remoteJid: "123456789012345@lid", remoteJidAlt: "5511988887777@s.whatsapp.net" }), ctx),
    ).toMatchObject({ tipo: "mensagem_recebida", telefone: "5511988887777", lid: "123456789012345" });
  });

  it("LID sem telefone: ignorado se for do cliente; aceito se for do próprio número", () => {
    const chave = { remoteJid: "123456789012345@lid" };
    expect(normalizarWebhookEvolution(upsert({ conversation: "oi" }, chave), ctx)).toMatchObject({ tipo: "ignorado", motivo: null });
    expect(normalizarWebhookEvolution(upsert({ conversation: "oi" }, { ...chave, fromMe: true }), ctx)).toMatchObject({
      tipo: "mensagem_enviada_fora",
      telefone: "",
      lid: "123456789012345",
    });
  });

  it("número longo demais não é tratado como telefone", () => {
    expect(normalizarWebhookEvolution(upsert({ conversation: "x" }, { remoteJid: "1234567890123456789@s.whatsapp.net" }), ctx)).toMatchObject({ tipo: "ignorado" });
  });
});

describe("normalizarWebhookEvolution — estado, revogação e edição", () => {
  it("connection.update: open/close carregam o estado; connecting não", () => {
    expect(normalizarWebhookEvolution({ event: "connection.update", data: { state: "open" } }, ctx)).toEqual({
      tipo: "ignorado",
      motivo: "connection.update",
      statusConexao: "conectado",
    });
    expect(normalizarWebhookEvolution({ event: "connection.update", data: { state: "close" } }, ctx)).toMatchObject({ statusConexao: "desconectado" });
    expect(normalizarWebhookEvolution({ event: "connection.update", data: { state: "connecting" } }, ctx)).not.toHaveProperty("statusConexao");
  });

  it("messages.delete → revogação com o alvo prefixado", () => {
    expect(normalizarWebhookEvolution({ event: "messages.delete", data: { id: "3EB0AAA", remoteJid: "5511@s.whatsapp.net" } }, ctx)).toEqual({
      tipo: "mensagem_revogada",
      idExterno: PREF("delete:3EB0AAA"),
      idAlvo: PREF("3EB0AAA"),
    });
  });

  it("protocolMessage REVOKE → revogação do alvo", () => {
    const m = { protocolMessage: { type: "REVOKE", key: { id: "ALVO1" } } };
    expect(normalizarWebhookEvolution(upsert(m, { id: "EVT1" }), ctx)).toEqual({
      tipo: "mensagem_revogada",
      idExterno: PREF("EVT1"),
      idAlvo: PREF("ALVO1"),
    });
  });

  it("protocolMessage MESSAGE_EDIT → mensagem com edição (alvo prefixado + novo texto)", () => {
    const m = { protocolMessage: { type: 14, key: { id: "ALVO1" }, editedMessage: { conversation: "texto corrigido" } } };
    expect(normalizarWebhookEvolution(upsert(m, { id: "EVT2" }), ctx)).toMatchObject({
      tipo: "mensagem_recebida",
      idExterno: PREF("EVT2"),
      edicao: { idAlvo: PREF("ALVO1"), novoTexto: "texto corrigido" },
      conteudo: { texto: "texto corrigido" },
    });
  });

  it("edição aninhada em editedMessage (Baileys 6)", () => {
    const m = { editedMessage: { message: { protocolMessage: { type: "MESSAGE_EDIT", key: { id: "ALVO2" }, editedMessage: { conversation: "novo" } } } } };
    expect(normalizarWebhookEvolution(upsert(m), ctx)).toMatchObject({ edicao: { idAlvo: PREF("ALVO2"), novoTexto: "novo" } });
  });

  it("outros protocolMessage (sincronização) não são mensagem de cliente", () => {
    expect(normalizarWebhookEvolution(upsert({ protocolMessage: { type: "HISTORY_SYNC_NOTIFICATION" } }), ctx)).toMatchObject({
      tipo: "ignorado",
      motivo: "protocolMessage",
    });
  });
});
