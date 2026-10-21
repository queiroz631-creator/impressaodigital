import { beforeEach, describe, expect, it, vi } from "vitest";
import { BancoFalso } from "./testes/banco-falso";
import type { EventoMensagem, EventoNormalizado } from "./providers/tipos";

const ref = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (n: string) => ref.banco.from(n),
    rpc: (n: string, a: Record<string, unknown>) => ref.banco.rpc(n, a),
  },
}));

import "@/integrations/supabase/client.server";
import {
  classificarParaRegistro,
  concluirEvento,
  registrarEvento,
  registrarStatusDaConexao,
  reiniciarEstadoDeEventos,
  resumoParaLog,
} from "./eventos.server";

const msg = (extra: Partial<EventoMensagem> = {}): EventoNormalizado => ({
  tipo: "mensagem_recebida",
  idExterno: "M1",
  telefone: "5511999990000",
  lid: null,
  nomeContato: "Maria Cliente",
  conteudo: { tipo: "texto", texto: "Meu CPF é 123.456.789-00", url: null, nome: null, mime: null, paginas: null },
  edicao: null,
  bruto: {},
  ...extra,
});

beforeEach(() => {
  ref.banco = new BancoFalso();
  reiniciarEstadoDeEventos();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("classificarParaRegistro", () => {
  it("mensagens usam tipo + id externo como chave", () => {
    expect(classificarParaRegistro(msg())).toEqual({ tipo: "mensagem_recebida", chave: "mensagem_recebida:M1" });
    expect(classificarParaRegistro(msg({ tipo: "mensagem_enviada_fora" }))).toEqual({
      tipo: "mensagem_enviada_fora",
      chave: "mensagem_enviada_fora:M1",
    });
  });

  it("mensagem com edição vira mensagem_editada", () => {
    expect(classificarParaRegistro(msg({ edicao: { idAlvo: "M0", novoTexto: "x" } }))).toEqual({
      tipo: "mensagem_editada",
      chave: "mensagem_editada:M1",
    });
  });

  it("sem id externo não há chave de idempotência (não registra)", () => {
    expect(classificarParaRegistro(msg({ idExterno: null }))).toBeNull();
  });

  it("revogação usa o id do evento ou o alvo", () => {
    expect(classificarParaRegistro({ tipo: "mensagem_revogada", idExterno: "R1", idAlvo: "M1" })).toEqual({
      tipo: "mensagem_revogada",
      chave: "mensagem_revogada:R1",
    });
    expect(classificarParaRegistro({ tipo: "mensagem_revogada", idExterno: null, idAlvo: "M1" })?.chave).toBe("mensagem_revogada:M1");
    expect(classificarParaRegistro({ tipo: "mensagem_revogada", idExterno: null, idAlvo: null })).toBeNull();
  });

  it("ruído (entrega, grupo, presença) não é registrado; mudança de estado da conexão é", () => {
    expect(classificarParaRegistro({ tipo: "ignorado", motivo: "DeliveryCallback" })).toBeNull();
    expect(classificarParaRegistro({ tipo: "ignorado", motivo: "grupo" })).toBeNull();
    expect(classificarParaRegistro({ tipo: "ignorado", motivo: "DisconnectedCallback", statusConexao: "desconectado" })?.tipo).toBe("conexao_status");
  });
});

describe("resumoParaLog — sem dados pessoais", () => {
  it("não inclui telefone, nome nem texto da mensagem", () => {
    const resumo = JSON.stringify(resumoParaLog(msg()));
    expect(resumo).not.toContain("5511999990000");
    expect(resumo).not.toContain("Maria");
    expect(resumo).not.toContain("CPF");
    expect(resumoParaLog(msg())).toMatchObject({ tipoConteudo: "texto", tamanhoTexto: 24, temArquivo: false, viaLid: false });
  });
});

describe("registrarEvento", () => {
  it("chama a função atômica com tipo, chave e resumo e devolve o registro", async () => {
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => ({
      data: [{ id: "ev-1", novo: true, status: "recebido", tentativas: 0 }],
      error: null,
    });
    const r = await registrarEvento("c1", "zapi", msg());
    expect(r).toEqual({ id: "ev-1", novo: true, status: "recebido" });
    expect(ref.banco.chamadasRpc[0]).toMatchObject({
      nome: "whatsapp_evento_registrar",
      args: { _conexao_id: "c1", _provedor: "zapi", _tipo: "mensagem_recebida", _dedup_key: "mensagem_recebida:M1" },
    });
  });

  it("não chama o banco para eventos sem chave", async () => {
    expect(await registrarEvento("c1", "zapi", msg({ idExterno: null }))).toBeNull();
    expect(ref.banco.chamadasRpc).toHaveLength(0);
  });

  it("FAIL-OPEN: erro do banco devolve null e nunca lança", async () => {
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => ({ data: null, error: { code: "XX000", message: "falhou" } });
    await expect(registrarEvento("c1", "zapi", msg())).resolves.toBeNull();
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => {
      throw new Error("rede caiu");
    };
    await expect(registrarEvento("c1", "zapi", msg())).resolves.toBeNull();
  });

  it("migração pendente (função inexistente): pausa as tentativas por 60 s", async () => {
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => ({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    expect(await registrarEvento("c1", "zapi", msg())).toBeNull();
    expect(await registrarEvento("c1", "zapi", msg({ idExterno: "M2" }))).toBeNull();
    expect(ref.banco.chamadasRpc).toHaveLength(1); // a 2ª nem tentou
  });

  it("resposta em formato inesperado é tratada como indisponível", async () => {
    ref.banco.rpcRespostas["whatsapp_evento_registrar"] = () => ({ data: [], error: null });
    expect(await registrarEvento("c1", "zapi", msg())).toBeNull();
  });
});

describe("concluirEvento e status da conexão", () => {
  it("conclui com o desfecho e o erro", async () => {
    await concluirEvento({ id: "ev-1", novo: true, status: "recebido" }, "erro", "falhou");
    expect(ref.banco.chamadasRpc[0]).toMatchObject({ nome: "whatsapp_evento_concluir", args: { _id: "ev-1", _status: "erro", _erro: "falhou" } });
  });

  it("sem registro não faz nada; erro não lança", async () => {
    await concluirEvento(null, "processado");
    expect(ref.banco.chamadasRpc).toHaveLength(0);
    ref.banco.rpcRespostas["whatsapp_evento_concluir"] = () => ({ data: null, error: { message: "x" } });
    await expect(concluirEvento({ id: "e", novo: true, status: "recebido" }, "processado")).resolves.toBeUndefined();
  });

  it("registra o estado da conexão", async () => {
    await registrarStatusDaConexao("c1", "desconectado");
    expect(ref.banco.chamadasRpc[0]).toMatchObject({
      nome: "whatsapp_conexao_registrar_status",
      args: { _conexao_id: "c1", _status: "desconectado" },
    });
  });
});
