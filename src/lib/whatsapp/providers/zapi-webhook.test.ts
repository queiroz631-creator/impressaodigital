import { describe, expect, it } from "vitest";
import { normalizarWebhookZapi } from "./zapi-webhook";

const base = {
  type: "ReceivedCallback",
  phone: "5511999990000",
  messageId: "M1",
  senderName: "Maria",
  fromMe: false,
  isGroup: false,
  text: { message: "Olá" },
};

describe("normalizarWebhookZapi — mensagens", () => {
  it("texto recebido → mensagem_recebida normalizada", () => {
    expect(normalizarWebhookZapi(base)).toMatchObject({
      tipo: "mensagem_recebida",
      idExterno: "M1",
      telefone: "5511999990000",
      lid: null,
      nomeContato: "Maria",
      edicao: null,
      conteudo: { tipo: "texto", texto: "Olá", url: null, paginas: null },
    });
  });

  it("normaliza o telefone (DDD + número nacional ganha 55)", () => {
    expect(normalizarWebhookZapi({ ...base, phone: "(11) 99999-0000" })).toMatchObject({ telefone: "5511999990000" });
  });

  it("documento: nome, mime, páginas e legenda igual ao nome vira texto vazio", () => {
    const ev = normalizarWebhookZapi({
      ...base,
      text: undefined,
      document: { documentUrl: "https://z/a.pdf", fileName: "a.pdf", caption: "A.PDF", mimeType: "application/pdf", pageCount: 4 },
    });
    expect(ev).toMatchObject({ conteudo: { tipo: "documento", texto: "", nome: "a.pdf", mime: "application/pdf", paginas: 4 } });
  });

  it("imagem e áudio usam nomes/mime padrão", () => {
    expect(normalizarWebhookZapi({ ...base, text: undefined, image: { imageUrl: "https://z/i", caption: "c" } })).toMatchObject({
      conteudo: { tipo: "imagem", texto: "c", nome: "imagem.jpg", mime: "image/jpeg" },
    });
    expect(normalizarWebhookZapi({ ...base, text: undefined, audio: { audioUrl: "https://z/a" } })).toMatchObject({
      conteudo: { tipo: "audio", nome: "audio.ogg", mime: "audio/ogg" },
    });
  });

  it("botão e lista viram tipo `botao`; localização usa o endereço", () => {
    expect(normalizarWebhookZapi({ ...base, text: undefined, buttonsResponseMessage: { message: "Sim" } })).toMatchObject({ conteudo: { tipo: "botao", texto: "Sim" } });
    expect(normalizarWebhookZapi({ ...base, text: undefined, listResponseMessage: { message: "Opção 2" } })).toMatchObject({ conteudo: { tipo: "botao", texto: "Opção 2" } });
    expect(normalizarWebhookZapi({ ...base, text: undefined, location: { address: "Rua A" } })).toMatchObject({ conteudo: { tipo: "localizacao", texto: "Rua A" } });
  });

  it("guarda o payload original (JSON) para o histórico", () => {
    const ev = normalizarWebhookZapi({ ...base, campoNovo: { x: 1 } });
    expect(ev).toMatchObject({ bruto: { messageId: "M1", campoNovo: { x: 1 } } });
  });

  it("nunca lança: corpo inesperado vira evento ignorado", () => {
    expect(normalizarWebhookZapi(null)).toMatchObject({ tipo: "ignorado" });
    expect(normalizarWebhookZapi("texto")).toMatchObject({ tipo: "ignorado" });
    expect(normalizarWebhookZapi({ phone: 123, text: "x" })).toBeTruthy();
  });
});

describe("normalizarWebhookZapi — saída pelo próprio número", () => {
  it("fromMe → mensagem_enviada_fora; o nome do contato é o do chat", () => {
    expect(normalizarWebhookZapi({ ...base, fromMe: true, chatName: "Maria", senderName: "Loja" })).toMatchObject({
      tipo: "mensagem_enviada_fora",
      nomeContato: "Maria",
    });
  });

  it("telefone vem como LID: telefone vazio + lid normalizado (só dígitos)", () => {
    expect(normalizarWebhookZapi({ ...base, fromMe: true, phone: "123456789012345@lid" })).toMatchObject({
      tipo: "mensagem_enviada_fora",
      telefone: "",
      lid: "123456789012345",
    });
  });

  it("chatLid explícito acompanha o telefone real", () => {
    expect(normalizarWebhookZapi({ ...base, fromMe: true, chatLid: "999@lid" })).toMatchObject({ telefone: "5511999990000", lid: "999" });
  });

  it("LID sem ser mensagem própria é ignorado (nunca cria contato)", () => {
    expect(normalizarWebhookZapi({ ...base, phone: "123456789012345@lid" })).toEqual({
      tipo: "ignorado",
      motivo: null,
      idExterno: "M1",
      edicao: null,
    });
  });
});

describe("normalizarWebhookZapi — o que é ignorado", () => {
  it.each([
    ["resposta a status", { isStatusReply: true }, null],
    ["grupo", { isGroup: true }, "grupo"],
    ["grupo por participante", { participantPhone: "5511" }, "grupo"],
    ["grupo por @g.us", { phone: "1-grp@g.us" }, "grupo"],
    ["callback de entrega", { type: "DeliveryCallback" }, "DeliveryCallback"],
    ["sem telefone", { phone: "" }, null],
    ["sem conteúdo", { text: undefined }, "sem_conteudo"],
  ])("%s", (_nome, extra, motivo) => {
    expect(normalizarWebhookZapi({ ...base, ...extra })).toMatchObject({ tipo: "ignorado", motivo });
  });

  it("ConnectedCallback/DisconnectedCallback carregam o estado da conexão", () => {
    expect(normalizarWebhookZapi({ type: "ConnectedCallback", connected: true })).toMatchObject({
      tipo: "ignorado",
      motivo: "ConnectedCallback",
      statusConexao: "conectado",
    });
    expect(normalizarWebhookZapi({ type: "DisconnectedCallback" })).toMatchObject({ statusConexao: "desconectado" });
    expect(normalizarWebhookZapi({ type: "DeliveryCallback" })).not.toHaveProperty("statusConexao");
  });

  it("callback de tipo diferente é aceito quando é saída pelo próprio número (comportamento atual)", () => {
    expect(normalizarWebhookZapi({ ...base, type: "SentByMeCallback", fromMe: true })).toMatchObject({ tipo: "mensagem_enviada_fora" });
  });
});

describe("normalizarWebhookZapi — revogação e edição", () => {
  it("REVOKE → mensagem_revogada com o alvo da mensagem referenciada", () => {
    expect(
      normalizarWebhookZapi({ ...base, messageId: "R1", text: undefined, notification: "revoke", referencedMessage: { messageId: "M1" } }),
    ).toEqual({ tipo: "mensagem_revogada", idExterno: "R1", idAlvo: "M1" });
  });

  it("REVOKE sem referência usa o próprio messageId como alvo", () => {
    expect(normalizarWebhookZapi({ ...base, notification: "REVOKE" })).toMatchObject({ idAlvo: "M1" });
  });

  it("edição carrega alvo + novo texto na própria mensagem", () => {
    expect(
      normalizarWebhookZapi({ ...base, messageId: "E1", isEdit: true, referencedMessage: { messageId: "M1" }, text: { message: "novo" } }),
    ).toMatchObject({ tipo: "mensagem_recebida", edicao: { idAlvo: "M1", novoTexto: "novo" } });
  });

  it("edição sem texto novo segue como mensagem comum (sem `edicao`)", () => {
    expect(normalizarWebhookZapi({ ...base, text: undefined, isEdit: true, image: { imageUrl: "https://z/i" } })).toMatchObject({
      tipo: "mensagem_recebida",
      edicao: null,
    });
  });

  it("a edição acompanha eventos ignorados por tipo/grupo (o pipeline ainda a aplica)", () => {
    expect(
      normalizarWebhookZapi({ ...base, type: "EditCallback", isEdit: true, referencedMessage: { messageId: "M1" }, text: { message: "x" } }),
    ).toMatchObject({ tipo: "ignorado", motivo: "EditCallback", edicao: { idAlvo: "M1", novoTexto: "x" } });
  });
});

describe("normalizarWebhookZapi — avisos de entrega/leitura", () => {
  it("READ → status_mensagem `lida` com os ids e o instante informados", () => {
    expect(
      normalizarWebhookZapi({ type: "MessageStatusCallback", status: "READ", ids: ["S1", "S2"], momment: 1700000000000 }),
    ).toEqual({
      tipo: "status_mensagem",
      ids: ["S1", "S2"],
      status: "lida",
      quando: new Date(1700000000000).toISOString(),
    });
  });

  it("PLAYED também é `lida` e RECEIVED é `entregue`", () => {
    expect(normalizarWebhookZapi({ type: "MessageStatusCallback", status: "PLAYED", ids: ["S1"] })).toMatchObject({ status: "lida" });
    expect(normalizarWebhookZapi({ type: "MessageStatusCallback", status: "RECEIVED", ids: ["S1"] })).toMatchObject({ status: "entregue" });
  });

  it("sem momento informado usa o instante atual (ISO válido)", () => {
    const ev = normalizarWebhookZapi({ type: "MessageStatusCallback", status: "READ", ids: ["S1"] });
    expect(ev).toMatchObject({ tipo: "status_mensagem" });
    if (ev.tipo === "status_mensagem") expect(Number.isNaN(Date.parse(ev.quando))).toBe(false);
  });

  it("status desconhecido ou sem ids é ignorado (não altera histórico)", () => {
    expect(normalizarWebhookZapi({ type: "MessageStatusCallback", status: "SENT", ids: ["S1"] })).toMatchObject({ tipo: "ignorado", motivo: "MessageStatusCallback" });
    expect(normalizarWebhookZapi({ type: "MessageStatusCallback", status: "READ", ids: [] })).toMatchObject({ tipo: "ignorado" });
    expect(normalizarWebhookZapi({ type: "MessageStatusCallback", status: "READ" })).toMatchObject({ tipo: "ignorado" });
  });
});
