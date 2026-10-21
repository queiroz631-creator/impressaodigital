import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./whatsapp/testes/banco-falso";

/**
 * Testes de CARACTERIZAÇÃO do webhook atual (formato Z-API).
 *
 * Fixam o comportamento existente ANTES de qualquer refatoração para o
 * pipeline multiprovedor: o resultado do webhook Z-API deve permanecer
 * idêntico. Os testes marcados "(risco documentado)" descrevem
 * comportamentos atuais que a migração multiprovedor vai tratar — não são
 * aprovação desses comportamentos.
 */

const ref = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (nome: string) => ref.banco.from(nome),
    rpc: (nome: string, args: Record<string, unknown>) => ref.banco.rpc(nome, args),
  },
}));

// Pré-carrega o módulo mockado: evita que dois `import()` dinâmicos simultâneos
// (teste de concorrência) resolvam o módulo real.
import "@/integrations/supabase/client.server";
import { processarWebhookWhatsapp } from "./whatsapp-webhook.server";
import { CABECALHO_SEGREDO_WEBHOOK, derivarSegredoWebhook } from "./whatsapp/providers/evolution-adapter.server";

const TEL = "5511999990000";

function recebida(extra: Record<string, unknown> = {}) {
  return {
    type: "ReceivedCallback",
    phone: TEL,
    messageId: "M1",
    senderName: "Maria",
    fromMe: false,
    isGroup: false,
    text: { message: "Olá" },
    ...extra,
  };
}

/** Payload de mensagem recebida no formato Evolution (v2). */
function evolutionRecebida(instancia: string | undefined = "instancia-teste", idExterno = "EVO1") {
  return {
    event: "messages.upsert",
    instance: instancia,
    data: {
      key: { remoteJid: `${TEL}@s.whatsapp.net`, fromMe: false, id: idExterno },
      pushName: "Maria",
      // `message` precisa existir para o normalizador: sem ele, o evento é
      // descartado ("sem_conteudo") antes de qualquer outra regra.
      message: { conversation: "Olá" },
    },
  };
}

async function chamar(corpo: unknown, token = "tok1", cabecalhos: Record<string, string> = {}) {
  const req = new Request("https://site.test/api/public/whatsapp/webhook/" + token, {
    method: "POST",
    headers: cabecalhos,
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
  const res = await processarWebhookWhatsapp(req, token);
  const texto = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* texto puro */
  }
  return { status: res.status, texto, json };
}

const conversas = () => ref.banco.tabela("whatsapp_conversas");
const chamadasDoAgente = () => ref.banco.chamadasRpc.filter((c) => c.nome === "agente_enfileirar_tarefa");
const mensagens = () => ref.banco.tabela("whatsapp_mensagens");

beforeEach(() => {
  ref.banco = new BancoFalso();
  ref.banco.semear("whatsapp_conexoes", [
    { id: "c1", ativo: true, webhook_token: "tok1", ordem: 0 },
    { id: "c2", ativo: true, webhook_token: "tok2", ordem: 1 },
  ]);
  ref.banco.semear("whatsapp_config", [
    { conexao_id: "c1", webhook_token: "cfg1", modo_numeros: "todos", ignorar_agradecimentos: null, agente_atendimento_ativo: false, agente_atendimento_id: null },
    { conexao_id: "c2", webhook_token: "cfg2", modo_numeros: "todos", ignorar_agradecimentos: null, agente_atendimento_ativo: false, agente_atendimento_id: null },
  ]);
});

describe("autenticação e identificação da conexão", () => {
  it("sem token → 401", async () => {
    const r = await chamar(recebida(), "");
    expect(r.status).toBe(401);
    expect(r.texto).toBe("Token ausente");
  });

  it("token desconhecido → 401 e nada é gravado", async () => {
    const r = await chamar(recebida(), "invalido");
    expect(r.status).toBe(401);
    expect(r.texto).toBe("Token inválido");
    expect(mensagens()).toHaveLength(0);
  });

  it("conexão inativa → ignorado (conexao_inativa), sem gravar", async () => {
    ref.banco.tabela("whatsapp_conexoes")[0]!["ativo"] = false;
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "conexao_inativa" });
    expect(conversas()).toHaveLength(0);
  });

  it("token legado da whatsapp_config sem conexão vinculada → cai na primeira conexão", async () => {
    ref.banco.tabela("whatsapp_config")[0]!["conexao_id"] = null;
    ref.banco.tabela("whatsapp_config")[0]!["webhook_token"] = "legado";
    const r = await chamar(recebida(), "legado");
    expect(r.json).toEqual({ ok: true });
    expect(conversas()[0]).toMatchObject({ conexao_id: "c1" });
  });

  it("JSON inválido → 400", async () => {
    const r = await chamar("{nao-json");
    expect(r.status).toBe(400);
    expect(r.texto).toBe("Payload inválido");
  });

  it("evento Evolution em conexão Evolution sem instância divergente é processado", async () => {
    Object.assign(ref.banco.tabela("whatsapp_conexoes")[0]!, {
      provedor: "evolution",
      id_externo: "instancia-teste",
    });
    process.env["WHATSAPP_WEBHOOK_SEGREDO"] = "segredo-de-webhook-com-mais-de-16";
    const r = await chamar(evolutionRecebida(), "tok1", {
      [CABECALHO_SEGREDO_WEBHOOK]: derivarSegredoWebhook("tok1")!,
    });
    expect(r.status).toBe(200);
    expect(mensagens()).toHaveLength(1);
  });
});

describe("autenticidade por instância (Evolution)", () => {
  process.env["WHATSAPP_WEBHOOK_SEGREDO"] = "segredo-de-webhook-com-mais-de-16";

  /** Chama o webhook com o cabeçalho secreto correto (como a Evolution envia). */
  function chamarEvolution(corpo: unknown) {
    return chamar(corpo, "tok1", {
      [CABECALHO_SEGREDO_WEBHOOK]: derivarSegredoWebhook("tok1")!,
    });
  }

  beforeAll(async () => {
    // Pré-carrega o adaptador da Evolution: o `import()` dinâmico dentro do
    // webhook precisa achar o MESMO módulo que o teste (senão o `vi.mock` do
    // Supabase não se aplica e o alvo real é consultado).
    await import("./whatsapp/providers/evolution-adapter.server");
    await import("./whatsapp/providers/registro.server");
  });

  /** Instância que o corpo do evento declara (para conferência de autenticidade). */
  function instanciaDoCorpo(corpo: unknown): string | null {
    const i = (corpo as { instance?: { instanceName?: unknown } } | null)?.instance?.instanceName;
    return typeof i === "string" ? i : null;
  }

  function prepararEvolution() {
    Object.assign(ref.banco.tabela("whatsapp_conexoes")[0]!, {
      provedor: "evolution",
      id_externo: "instancia-teste",
    });
  }

  it("evento da instância da conexão é aceito", async () => {
    prepararEvolution();
    const r = await chamarEvolution(evolutionRecebida());
    expect(r.status).toBe(200);
    expect(mensagens()).toHaveLength(1);
  });

  it("evento de OUTRA instância → descartado e nada é gravado", async () => {
    prepararEvolution();
    // Corpo com a instância no envelope (formato Evolution). A conexão espera
    // `instancia-teste`; a mensagem abaixo vem de outra instância.
    const corpo = evolutionRecebida("instancia-intrusa");
    const r = await chamarEvolution(corpo);
    // A conexão espera `instancia-teste`, mas o corpo diz outra instância.
    expect(r.texto).toBe("instancia_divergente");
    expect(mensagens()).toHaveLength(0);
    expect(conversas()).toHaveLength(0);
  });

  it("sem segredo no cabeçalho → 401 (falha fechada)", async () => {
    prepararEvolution();
    const r = await chamar(evolutionRecebida());
    expect(r.status).toBe(401);
    expect(mensagens()).toHaveLength(0);
  });

  it("sem instância no corpo segue aceito (o segredo do cabeçalho já autentica)", async () => {
    prepararEvolution();
    const r = await chamarEvolution(evolutionRecebida(undefined));
    expect(r.status).toBe(200);
    expect(mensagens()).toHaveLength(1);
  });

  it("conexão Z-API não passa pela checagem de instância", async () => {
    // sem provedor/id_externo: tudo é Z-API
    const r = await chamar(recebida({ instance: { instanceName: "qualquer" } }));
    expect(r.status).toBe(200);
    expect(mensagens()).toHaveLength(1);
  });
});

describe("mensagem recebida (texto)", () => {
  it("cria cliente, conversa e mensagem; deixa o bot pendente", async () => {
    const r = await chamar(recebida());
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });

    expect(ref.banco.tabela("clientes")).toHaveLength(1);
    expect(ref.banco.tabela("clientes")[0]).toMatchObject({ telefone_normalizado: TEL, nome: "Maria" });

    expect(conversas()).toHaveLength(1);
    expect(conversas()[0]).toMatchObject({
      telefone: TEL,
      conexao_id: "c1",
      status: "automatico",
      etapa: "inicio",
      nome_contato: "Maria",
      total_mensagens: 1,
      nao_lidas: 1,
      ultima_mensagem: "Olá",
      bot_pendente: true,
    });

    expect(mensagens()).toHaveLength(1);
    expect(mensagens()[0]).toMatchObject({
      direcao: "entrada",
      tipo: "texto",
      texto: "Olá",
      whatsapp_message_id: "M1",
      status: "recebida",
      autor: "Maria",
    });
  });

  it("segunda mensagem do mesmo cliente reaproveita a conversa e acumula contadores", async () => {
    await chamar(recebida());
    await chamar(recebida({ messageId: "M2", text: { message: "Tudo bem?" } }));
    expect(conversas()).toHaveLength(1);
    expect(conversas()[0]).toMatchObject({ total_mensagens: 2, nao_lidas: 2, ultima_mensagem: "Tudo bem?" });
    expect(mensagens()).toHaveLength(2);
  });

  it("callback repetido (mesmo messageId) é ignorado como duplicada", async () => {
    await chamar(recebida());
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "duplicada" });
    expect(mensagens()).toHaveLength(1);
    expect(conversas()[0]).toMatchObject({ total_mensagens: 1 });
  });

  it("corrida: se a checagem de duplicada não enxerga a mensagem, o índice único ainda impede a cópia", async () => {
    await chamar(recebida());
    // Segundo callback chega "ao mesmo tempo": a consulta prévia não vê a
    // mensagem recém-gravada pelo primeiro; a proteção definitiva é o índice único.
    ref.banco.leiturasCegas["whatsapp_mensagens"] = 1;
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "duplicada" });
    expect(mensagens()).toHaveLength(1);
    expect(conversas()).toHaveLength(1);
    expect(conversas()[0]).toMatchObject({ total_mensagens: 1 });
  });
});

describe("múltiplas conexões", () => {
  it("o mesmo telefone em conexões diferentes gera conversas independentes", async () => {
    await chamar(recebida({ messageId: "A1" }), "tok1");
    await chamar(recebida({ messageId: "B1" }), "tok2");
    expect(conversas()).toHaveLength(2);
    expect(conversas().map((c) => c["conexao_id"]).sort()).toEqual(["c1", "c2"]);
    // Cliente é global por telefone.
    expect(ref.banco.tabela("clientes")).toHaveLength(1);
  });

  it("(risco documentado) o MESMO messageId em outra conexão é tratado como duplicada", async () => {
    await chamar(recebida({ messageId: "IGUAL" }), "tok1");
    const r = await chamar(recebida({ messageId: "IGUAL" }), "tok2");
    // Índice único GLOBAL em `whatsapp_message_id`: ids de provedores diferentes
    // precisam ser prefixados (a Evolution já é; a Z-API segue sem prefixo).
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "duplicada_em_curso" });
    expect(conversas()).toHaveLength(1);
  });

  it("regra de número (bot_numeros) vale só para a conexão dela", async () => {
    ref.banco.semear("bot_numeros", [{ telefone: TEL, conexao_id: "c1", permitido: false, ativo: true }]);
    const c1 = await chamar(recebida({ messageId: "A1" }), "tok1");
    const c2 = await chamar(recebida({ messageId: "B1" }), "tok2");
    expect(c1.json).toEqual({ ok: true, bot: false, motivo: "numero_desativado" });
    expect(c2.json).toEqual({ ok: true });
  });
});

describe("tipos de conteúdo", () => {
  it("documento: registra a mensagem e o arquivo com metadados", async () => {
    await chamar(
      recebida({
        text: undefined,
        document: { documentUrl: "https://z/arq.pdf", fileName: "arq.pdf", mimeType: "application/pdf", pageCount: 3 },
      }),
    );
    expect(mensagens()[0]).toMatchObject({ tipo: "documento", arquivo_nome: "arq.pdf", arquivo_url: "https://z/arq.pdf" });
    expect(ref.banco.tabela("whatsapp_arquivos")[0]).toMatchObject({ nome: "arq.pdf", tipo: "PDF", paginas: 3 });
    expect(conversas()[0]).toMatchObject({ ultima_mensagem: "📄 arq.pdf" });
  });

  it("legenda igual ao nome do documento não conta como texto do cliente", async () => {
    await chamar(
      recebida({
        text: undefined,
        document: { documentUrl: "https://z/a.pdf", fileName: "a.pdf", caption: "A.PDF" },
      }),
    );
    expect(mensagens()[0]).toMatchObject({ tipo: "documento", texto: "" });
  });

  it("imagem: nome padrão imagem.jpg e legenda como texto", async () => {
    await chamar(recebida({ text: undefined, image: { imageUrl: "https://z/i.jpg", caption: "foto" } }));
    expect(mensagens()[0]).toMatchObject({ tipo: "imagem", texto: "foto", arquivo_nome: "imagem.jpg", mime_type: "image/jpeg" });
    expect(ref.banco.tabela("whatsapp_arquivos")[0]).toMatchObject({ nome: "imagem.jpg" });
  });

  it("áudio: grava a mensagem sem criar arquivo", async () => {
    await chamar(recebida({ text: undefined, audio: { audioUrl: "https://z/a.ogg" } }));
    expect(mensagens()[0]).toMatchObject({ tipo: "audio", arquivo_nome: "audio.ogg" });
    expect(ref.banco.tabela("whatsapp_arquivos")).toHaveLength(0);
  });

  it("resposta de botão vira tipo `botao` com o texto escolhido", async () => {
    await chamar(recebida({ text: undefined, buttonsResponseMessage: { message: "Sim" } }));
    expect(mensagens()[0]).toMatchObject({ tipo: "botao", texto: "Sim" });
  });
});

describe("callbacks que não são mensagem de cliente", () => {
  it.each([
    ["grupo (isGroup)", { isGroup: true }, { ok: true, ignorado: true, motivo: "grupo" }],
    ["grupo (phone @g.us)", { phone: "123456-group@g.us" }, { ok: true, ignorado: true, motivo: "grupo" }],
    ["resposta a status", { isStatusReply: true }, { ok: true, ignorado: true }],
    ["callback de entrega", { type: "DeliveryCallback" }, { ok: true, ignorado: true, motivo: "DeliveryCallback" }],
    ["sem conteúdo", { text: undefined }, { ok: true, ignorado: true, motivo: "sem_conteudo" }],
    ["telefone ausente", { phone: "" }, { ok: true, ignorado: true }],
  ])("%s → ignorado e nada gravado", async (_nome, extra, esperado) => {
    const r = await chamar(recebida(extra));
    expect(r.json).toEqual(esperado);
    expect(conversas()).toHaveLength(0);
    expect(mensagens()).toHaveLength(0);
  });
});

describe("revogação e edição", () => {
  it("REVOKE marca a mensagem como apagada e atualiza o resumo da conversa", async () => {
    await chamar(recebida());
    const r = await chamar({ ...recebida({ messageId: "R1" }), text: undefined, notification: "REVOKE", referencedMessage: { messageId: "M1" } });
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "revogacao" });
    expect(mensagens()[0]).toMatchObject({ apagada: true });
    expect(mensagens()[0]!["apagada_em"]).toBeTruthy();
    expect(conversas()[0]).toMatchObject({ ultima_mensagem: "Mensagem apagada" });
  });

  it("edição atualiza o texto e guarda o original", async () => {
    await chamar(recebida());
    const r = await chamar(recebida({ messageId: "E1", isEdit: true, referencedMessage: { messageId: "M1" }, text: { message: "Olá, editado" } }));
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "edicao" });
    expect(mensagens()).toHaveLength(1);
    expect(mensagens()[0]).toMatchObject({ texto: "Olá, editado", texto_original: "Olá", editada: true });
  });
});

describe("mensagem enviada pelo próprio número (celular/WhatsApp Web)", () => {
  const saidaPropria = (extra: Record<string, unknown> = {}) =>
    recebida({ fromMe: true, messageId: "S1", chatName: "Maria", senderName: "Loja", text: { message: "Resposta do celular" }, ...extra });

  it("grava como saída, não conta como não lida e passa a conversa para atendimento humano", async () => {
    const r = await chamar(saidaPropria());
    expect(r.json).toEqual({ ok: true, bot: false, motivo: "enviada_fora_do_sistema" });
    expect(mensagens()[0]).toMatchObject({ direcao: "saida", autor: "Atendente (WhatsApp)", status: "enviada" });
    expect(conversas()[0]).toMatchObject({ status: "em_atendimento", etapa: "em_atendimento", nao_lidas: 0, nome_contato: "Maria", bot_pendente: false });
  });

  it("eco do próprio sistema (mesmo texto de saída recente) é descartado", async () => {
    await chamar(recebida());
    const conversa = conversas()[0]!;
    ref.banco.semear("whatsapp_mensagens", [
      { conversa_id: conversa["id"], direcao: "saida", tipo: "texto", texto: "Resposta do bot", data_hora: new Date().toISOString() },
    ]);
    const r = await chamar(saidaPropria({ messageId: "ECO1", text: { message: "Resposta do bot" } }));
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "eco_do_sistema" });
  });

  it("chat identificado só por LID, sem conversa existente, é ignorado", async () => {
    const r = await chamar(saidaPropria({ phone: "123456789012345@lid" }));
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "lid_sem_conversa" });
    expect(conversas()).toHaveLength(0);
  });

  it("não aciona o agente de IA nem o bot", async () => {
    ref.banco.tabela("whatsapp_config")[0]!["agente_atendimento_ativo"] = true;
    ref.banco.tabela("whatsapp_config")[0]!["agente_atendimento_id"] = "ag-1";
    await chamar(saidaPropria());
    expect(chamadasDoAgente()).toHaveLength(0);
  });
});

describe("encerramento e cortesia", () => {
  async function conversaFinalizada(dataFinalizacao: string) {
    await chamar(recebida());
    Object.assign(conversas()[0]!, { status: "finalizado", data_finalizacao: dataFinalizacao });
  }

  it("mensagem nova depois de finalizar abre o atendimento seguinte", async () => {
    await conversaFinalizada("2020-01-01T00:00:00.000Z");
    const r = await chamar(recebida({ messageId: "M2", text: { message: "Preciso de um orçamento" } }));
    expect(r.json).toEqual({ ok: true });
    expect(conversas()[0]).toMatchObject({ status: "automatico", etapa: "inicio", atendimento_numero: 2, atendente_id: null });
    expect(mensagens().some((m) => m["tipo"] === "sistema" && m["texto"] === "ATENDIMENTO 2")).toBe(true);
  });

  it("agradecimento logo após finalizar não reabre o atendimento", async () => {
    await conversaFinalizada(new Date(Date.now() - 5 * 60_000).toISOString());
    const r = await chamar(recebida({ messageId: "M2", text: { message: "Obrigado!" } }));
    expect(r.json).toEqual({ ok: true, bot: false, motivo: "cortesia_ignorada" });
    expect(conversas()[0]).toMatchObject({ status: "finalizado" });
    expect(ref.banco.tabela("whatsapp_auditoria")[0]).toMatchObject({ acao: "cortesia_ignorada" });
    expect(mensagens()).toHaveLength(2);
  });
});

describe("bot de número desativado", () => {
  it("registra a mensagem mas não aciona o bot", async () => {
    ref.banco.semear("bot_numeros", [{ telefone: TEL, conexao_id: "c1", permitido: false, ativo: true }]);
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, bot: false, motivo: "numero_desativado" });
    expect(mensagens()).toHaveLength(1);
    expect(conversas()[0]).toMatchObject({ bot_pendente: false });
  });

  it("modo somente_liberados bloqueia número sem regra", async () => {
    ref.banco.tabela("whatsapp_config")[0]!["modo_numeros"] = "somente_liberados";
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, bot: false, motivo: "numero_desativado" });
  });
});

describe("Agente de Atendimento por conexão", () => {
  beforeEach(() => {
    ref.banco.tabela("whatsapp_config")[0]!["agente_atendimento_ativo"] = true;
    ref.banco.tabela("whatsapp_config")[0]!["agente_atendimento_id"] = "ag-1";
  });

  it("enfileira a tarefa do agente com chave de idempotência e NÃO marca o bot antigo", async () => {
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, agente: true });
    expect(chamadasDoAgente()).toHaveLength(1);
    const { nome, args } = chamadasDoAgente()[0]!;
    expect(nome).toBe("agente_enfileirar_tarefa");
    expect(args).toMatchObject({
      _agente_id: "ag-1",
      _tipo: "whatsapp_mensagem_recebida",
      _prioridade: 10,
      _idempotency_key: `whatsapp:${conversas()[0]!["id"]}:M1`,
    });
    expect(args["_payload"]).toMatchObject({ telefone: TEL, conteudo: "Olá", tipoMensagem: "texto", whatsappMessageId: "M1" });
    expect(conversas()[0]).toMatchObject({ bot_pendente: false });
  });

  it("falha ao enfileirar → cai no bot antigo (bot_pendente)", async () => {
    ref.banco.errosRpc["agente_enfileirar_tarefa"] = { message: "fila indisponível" };
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, agente: true });
    expect(conversas()[0]).toMatchObject({ bot_pendente: true });
  });

  it("a configuração do agente é por conexão: outra conexão continua no bot", async () => {
    const r = await chamar(recebida({ messageId: "B1" }), "tok2");
    expect(r.json).toEqual({ ok: true });
    expect(chamadasDoAgente()).toHaveLength(0);
    expect(conversas()[0]).toMatchObject({ conexao_id: "c2", bot_pendente: true });
  });
});

describe("avisos de entrega/leitura (MessageStatusCallback)", () => {
  /** Semeia uma mensagem de saída já enviada, referenciada pelo provedor. */
  function semearSaida(id: string, status: string) {
    ref.banco.semear("whatsapp_mensagens", [
      { id: `m-${id}`, conversa_id: "conv1", whatsapp_message_id: id, direcao: "saida", status },
    ]);
  }

  const status = (id: string) => mensagens().find((m) => m["whatsapp_message_id"] === id)?.["status"];

  it("READ marca como lida e preenche lida_em; responde com o status", async () => {
    semearSaida("S1", "enviada");
    const r = await chamar({ type: "MessageStatusCallback", status: "READ", ids: ["S1"], momment: 1700000000000 });
    expect(r.json).toEqual({ ok: true, status: "lida" });
    expect(status("S1")).toBe("lida");
    expect(mensagens()[0]?.["lida_em"]).toBe(new Date(1700000000000).toISOString());
  });

  it("RECEIVED marca como entregue", async () => {
    semearSaida("S1", "enviada");
    const r = await chamar({ type: "MessageStatusCallback", status: "RECEIVED", ids: ["S1"] });
    expect(r.json).toEqual({ ok: true, status: "entregue" });
    expect(status("S1")).toBe("entregue");
    expect(mensagens()[0]?.["entregue_em"]).toBeTruthy();
  });

  it("aviso sem ids é ignorado (nunca altera o histórico)", async () => {
    semearSaida("S1", "enviada");
    const r = await chamar({ type: "MessageStatusCallback", status: "RECEIVED" });
    expect(r.json).toMatchObject({ ok: true, ignorado: true, motivo: "MessageStatusCallback" });
    expect(status("S1")).toBe("enviada");
  });

  it("nunca rebaixa: lida não volta a entregue", async () => {
    semearSaida("S1", "lida");
    await chamar({ type: "MessageStatusCallback", status: "RECEIVED", ids: ["S1"] });
    expect(status("S1")).toBe("lida");
  });

  it("erro não é sobrescrito por aviso de status", async () => {
    semearSaida("S1", "erro");
    await chamar({ type: "MessageStatusCallback", status: "READ", ids: ["S1"] });
    expect(status("S1")).toBe("erro");
  });

  it("afeta só mensagens de saída", async () => {
    ref.banco.semear("whatsapp_mensagens", [
      { id: "m-entrada", conversa_id: "conv1", whatsapp_message_id: "S1", direcao: "entrada", status: "recebida" },
    ]);
    await chamar({ type: "MessageStatusCallback", status: "READ", ids: ["S1"] });
    expect(status("S1")).toBe("recebida");
  });

  it("não grava mensagem nem aciona o agente", async () => {
    semearSaida("S1", "enviada");
    const r = await chamar({ type: "MessageStatusCallback", status: "READ", ids: ["S1"] });
    expect(r.json).toEqual({ ok: true, status: "lida" });
    expect(mensagens()).toHaveLength(1);
    expect(chamadasDoAgente()).toHaveLength(0);
  });
});
