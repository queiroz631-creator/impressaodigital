import { beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./whatsapp/testes/banco-falso";

/**
 * Webhook no modelo multiprovedor: seleção do provedor pela conexão,
 * idempotência de eventos, compatibilidade com banco SEM a migração e
 * falhas do registro de eventos (que nunca podem parar o atendimento).
 */

const ref = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (n: string) => ref.banco.from(n),
    rpc: (n: string, a: Record<string, unknown>) => ref.banco.rpc(n, a),
  },
}));

import "@/integrations/supabase/client.server";
import { reiniciarEstadoDeEventos } from "./whatsapp/eventos.server";
import { processarWebhookWhatsapp } from "./whatsapp-webhook.server";

const TEL = "5511999990000";
const recebida = (extra: Record<string, unknown> = {}) => ({
  type: "ReceivedCallback",
  phone: TEL,
  messageId: "M1",
  senderName: "Maria",
  fromMe: false,
  isGroup: false,
  text: { message: "Olá" },
  ...extra,
});

async function chamar(corpo: unknown, token = "tok1") {
  const res = await processarWebhookWhatsapp(
    new Request("https://site.test/webhook/" + token, { method: "POST", body: JSON.stringify(corpo) }),
    token,
  );
  const texto = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* texto puro */
  }
  return { status: res.status, texto, json };
}

const mensagens = () => ref.banco.tabela("whatsapp_mensagens");
const conversas = () => ref.banco.tabela("whatsapp_conversas");
const rpcs = (nome: string) => ref.banco.chamadasRpc.filter((c) => c.nome === nome);

function registrarResponde(novo: boolean, status = "recebido", id = "ev-1") {
  ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => ({ data: [{ id, novo, status, tentativas: 0 }], error: null });
}

beforeEach(() => {
  ref.banco = new BancoFalso();
  reiniciarEstadoDeEventos();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  ref.banco.semear("whatsapp_conexoes", [
    { id: "c1", ativo: true, webhook_token: "tok1", ordem: 0, provedor: "zapi" },
    { id: "c2", ativo: true, webhook_token: "tok2", ordem: 1, provedor: "zapi" },
  ]);
  ref.banco.semear("whatsapp_config", [
    { conexao_id: "c1", webhook_token: "cfg1", modo_numeros: "todos", agente_atendimento_ativo: false, agente_atendimento_id: null },
    { conexao_id: "c2", webhook_token: "cfg2", modo_numeros: "todos", agente_atendimento_ativo: false, agente_atendimento_id: null },
  ]);
});

describe("provedor da conexão", () => {
  it("conexão com provedor indisponível neste servidor: 200 ignorado, nada gravado", async () => {
    ref.banco.tabela("whatsapp_conexoes")[0]!["provedor"] = "baileys";
    const r = await chamar(recebida());
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "provedor_indisponivel" });
    expect(conversas()).toHaveLength(0);
    expect(mensagens()).toHaveLength(0);
  });

  it("banco SEM a coluna `provedor` (migração pendente): tudo continua Z-API", async () => {
    ref.banco.colunasInexistentes["whatsapp_conexoes"] = ["provedor"];
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true });
    expect(mensagens()).toHaveLength(1);
  });

  it("coluna `provedor` vazia/nula é tratada como Z-API", async () => {
    ref.banco.tabela("whatsapp_conexoes")[0]!["provedor"] = null;
    expect((await chamar(recebida())).json).toEqual({ ok: true });
  });
});

describe("registro de eventos e idempotência", () => {
  it("registra o evento antes de processar e o conclui como processado", async () => {
    registrarResponde(true);
    await chamar(recebida());
    expect(rpcs("whatsapp_evento_registrar")[0]!.args).toMatchObject({
      _conexao_id: "c1",
      _provedor: "zapi",
      _tipo: "mensagem_recebida",
      _dedup_key: "mensagem_recebida:M1",
    });
    expect(rpcs("whatsapp_evento_concluir")[0]!.args).toMatchObject({ _id: "ev-1", _status: "processado" });
  });

  it("evento já PROCESSADO é descartado sem tocar no atendimento", async () => {
    registrarResponde(false, "processado");
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "duplicada" });
    expect(conversas()).toHaveLength(0);
    expect(mensagens()).toHaveLength(0);
    expect(rpcs("whatsapp_evento_concluir")).toHaveLength(0);
  });

  it.each(["recebido", "erro"])("evento em `%s` (reenvio após falha) é REPROCESSADO", async (status) => {
    registrarResponde(false, status);
    const r = await chamar(recebida());
    expect(r.json).toEqual({ ok: true });
    expect(mensagens()).toHaveLength(1);
    expect(rpcs("whatsapp_evento_concluir")[0]!.args).toMatchObject({ _status: "processado" });
  });

  it("desfecho `ignorado` é registrado como ignorado", async () => {
    registrarResponde(true);
    ref.banco.tabela("whatsapp_conexoes")[0]!["ativo"] = true;
    await chamar(recebida());
    await chamar(recebida()); // 2ª: duplicada pela proteção de mensagens
    const ultimo = rpcs("whatsapp_evento_concluir").at(-1)!;
    expect(ultimo.args).toMatchObject({ _status: "ignorado" });
  });

  it("falha inesperada no pipeline: conclui o evento como `erro` e propaga a exceção", async () => {
    registrarResponde(true);
    ref.banco.lancarEm["clientes"] = "banco caiu";
    await expect(chamar(recebida())).rejects.toThrow("banco caiu");
    expect(rpcs("whatsapp_evento_concluir")[0]!.args).toMatchObject({ _id: "ev-1", _status: "erro", _erro: "banco caiu" });
  });

  it("eventos sem id de mensagem não são registrados, mas são atendidos", async () => {
    const r = await chamar(recebida({ messageId: undefined }));
    expect(r.json).toEqual({ ok: true });
    expect(rpcs("whatsapp_evento_registrar")).toHaveLength(0);
    expect(mensagens()).toHaveLength(1);
  });

  it("callbacks de ruído (entrega) não geram registro de evento", async () => {
    await chamar(recebida({ type: "DeliveryCallback" }));
    expect(rpcs("whatsapp_evento_registrar")).toHaveLength(0);
  });
});

describe("registro de eventos nunca bloqueia o atendimento", () => {
  it("função/tabela inexistente (migração pendente na VPS): atende normalmente e para de tentar", async () => {
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.whatsapp_evento_registrar" },
    });
    const a = await chamar(recebida({ messageId: "A1" }));
    const b = await chamar(recebida({ messageId: "A2", text: { message: "outra" } }));
    expect(a.json).toEqual({ ok: true });
    expect(b.json).toEqual({ ok: true });
    expect(mensagens()).toHaveLength(2);
    expect(rpcs("whatsapp_evento_registrar")).toHaveLength(1);
  });

  it("exceção ao registrar também não impede o atendimento", async () => {
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => {
      throw new Error("rede");
    };
    expect((await chamar(recebida())).json).toEqual({ ok: true });
    expect(mensagens()).toHaveLength(1);
  });
});

describe("estado da conexão informado pelo provedor", () => {
  it("DisconnectedCallback persiste o estado e continua respondendo como antes", async () => {
    const r = await chamar({ type: "DisconnectedCallback", connected: false });
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "DisconnectedCallback" });
    expect(rpcs("whatsapp_conexao_registrar_status")[0]!.args).toMatchObject({ _conexao_id: "c1", _status: "desconectado" });
  });

  it("ConnectedCallback registra `conectado`", async () => {
    await chamar({ type: "ConnectedCallback", connected: true }, "tok2");
    expect(rpcs("whatsapp_conexao_registrar_status")[0]!.args).toMatchObject({ _conexao_id: "c2", _status: "conectado" });
  });
});

describe("paridade: edição aplicada mesmo em callback ignorado por tipo", () => {
  it("edição com type diferente de ReceivedCallback atualiza a mensagem existente", async () => {
    await chamar(recebida());
    const r = await chamar(recebida({ messageId: "E1", type: "EditCallback", isEdit: true, referencedMessage: { messageId: "M1" }, text: { message: "corrigido" } }));
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "edicao" });
    expect(mensagens()[0]).toMatchObject({ texto: "corrigido", texto_original: "Olá", editada: true });
  });

  it("sem a mensagem alvo, o callback ignorado segue ignorado", async () => {
    const r = await chamar(recebida({ type: "EditCallback", isEdit: true, referencedMessage: { messageId: "NAO-EXISTE" }, text: { message: "x" } }));
    expect(r.json).toEqual({ ok: true, ignorado: true, motivo: "EditCallback" });
  });
});

describe("idempotência do agente sem id de mensagem", () => {
  it("mensagem sem id usa o id interno na chave (não colide entre mensagens)", async () => {
    ref.banco.tabela("whatsapp_config")[0]!["agente_atendimento_ativo"] = true;
    ref.banco.tabela("whatsapp_config")[0]!["agente_atendimento_id"] = "ag-1";
    await chamar(recebida({ messageId: undefined, text: { message: "primeira" } }));
    await chamar(recebida({ messageId: undefined, text: { message: "segunda" } }));
    const chaves = rpcs("agente_enfileirar_tarefa").map((c) => c.args["_idempotency_key"]);
    expect(chaves).toHaveLength(2);
    expect(new Set(chaves).size).toBe(2);
    expect(chaves.every((c) => !String(c).endsWith(":null") && !String(c).endsWith(":undefined"))).toBe(true);
  });
});
