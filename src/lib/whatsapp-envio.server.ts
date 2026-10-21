/**
 * Envio de mensagens de texto pelo WhatsApp. Somente servidor.
 *
 * Centraliza o envio de texto de agentes/worker: identifica a conexão pelo
 * `conexao_id` da conversa, envia pelo provedor dessa conexão (camada
 * multiprovedor) e registra a saída no histórico (`whatsapp_mensagens`).
 * Nunca lança: devolve o resultado para o chamador decidir o fallback.
 *
 * Para conexões Z-API, as credenciais ficam em `whatsapp_conexoes` e são
 * resolvidas por `chamarZapi`, que aplica o fallback para as variáveis de
 * ambiente da conexão principal (comportamento preservado pelo adaptador).
 */

import { enviarTextoPelaConexao } from "@/lib/whatsapp/provedor.server";

export interface ResultadoEnvioTexto {
  ok: boolean;
  mensagemId: string | null;
  erro: string | null;
}

/**
 * Envia um texto para a conversa indicada e registra a saída no histórico.
 *
 * @param opcoes.conversaId Conversa de destino (define telefone + conexão).
 * @param opcoes.texto Texto a enviar (vazio é recusado, não envia em branco).
 * @param opcoes.autor Autor exibido no histórico (padrão: "Agente IA").
 * @param opcoes.registrar Quando `false`, não grava em `whatsapp_mensagens`.
 */
export async function enviarTextoDaConversa(opcoes: {
  conversaId: string;
  texto: string;
  autor?: string;
  registrar?: boolean;
}): Promise<ResultadoEnvioTexto> {
  const texto = opcoes.texto?.trim();
  if (!texto) return { ok: false, mensagemId: null, erro: "Mensagem vazia" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: conversa } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select("id, telefone, conexao_id")
    .eq("id", opcoes.conversaId)
    .maybeSingle();

  if (!conversa?.telefone) {
    return { ok: false, mensagemId: null, erro: "Conversa sem telefone" };
  }

  // Envio pelo provedor da conexão (Z-API hoje; outros provedores via adaptador).
  const r = await enviarTextoPelaConexao(conversa.conexao_id ?? null, {
    telefone: conversa.telefone,
    texto,
  });

  const mensagemId = r.ok ? r.dados.mensagemId : null;
  const erro = r.ok ? null : r.erro.mensagem;

  if (opcoes.registrar !== false) {
    await supabaseAdmin.from("whatsapp_mensagens").insert({
      conversa_id: conversa.id,
      direcao: "saida",
      tipo: "texto",
      texto,
      autor: opcoes.autor ?? "Agente IA",
      whatsapp_message_id: mensagemId ? String(mensagemId) : null,
      status: r.ok ? "enviada" : "erro",
      erro,
      data_hora: new Date().toISOString(),
    });
  }

  return {
    ok: r.ok,
    mensagemId: mensagemId ? String(mensagemId) : null,
    erro,
  };
}
