import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizarNomePessoa } from "@/lib/nome-pessoa";
import { normalizarTelefone } from "@/lib/whatsapp-comum";

export const prepararClienteImpressao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: permitido, error: erroPermissao } = await context.supabase.rpc("tem_permissao", { _user_id: context.userId, _chave: "whatsapp.visualizar" });
    if (erroPermissao || !permitido) throw new Error("Você não tem permissão para acessar o WhatsApp.");
    const { data: conversa, error } = await context.supabase.from("whatsapp_conversas").select("cliente_id, telefone, nome_contato").eq("id", data.conversaId).single();
    if (error || !conversa) throw new Error("Conversa não encontrada.");
    const telefone = normalizarTelefone(conversa.telefone);
    const consulta = context.supabase.from("clientes").select("id, nome");
    const { data: cliente, error: erroCliente } = conversa.cliente_id
      ? await consulta.eq("id", conversa.cliente_id).maybeSingle()
      : await consulta.eq("telefone_normalizado", telefone).maybeSingle();
    if (erroCliente) throw new Error("Não foi possível consultar o cadastro do cliente.");
    const { data: perfil, error: erroPerfil } = await context.supabase.from("profiles").select("nome, email").eq("id", context.userId).single();
    if (erroPerfil || !perfil) throw new Error("Não foi possível identificar o usuário logado.");
    const usuario = perfil.nome?.trim() || String(context.claims["user_metadata"] && typeof context.claims["user_metadata"] === "object" ? (context.claims["user_metadata"] as Record<string, unknown>)["nome"] ?? "" : "").trim() || perfil.email?.split("@")[0] || "";
    if (!usuario) throw new Error("Preencha o nome do seu usuário antes de imprimir.");
    return { nome: cliente?.nome || conversa.nome_contato || "", telefone: conversa.telefone, usuario };
  });

export const salvarNomeClienteImpressao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid(), nome: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const nome = normalizarNomePessoa(data.nome);
    if (nome.length < 2) throw new Error("Informe o nome do cliente.");
    const { data: permitido, error: erroPermissao } = await context.supabase.rpc("tem_permissao", { _user_id: context.userId, _chave: "whatsapp.visualizar" });
    if (erroPermissao || !permitido) throw new Error("Você não tem permissão para acessar o WhatsApp.");
    const { data: conversa, error } = await context.supabase.from("whatsapp_conversas").select("cliente_id, telefone").eq("id", data.conversaId).single();
    if (error || !conversa) throw new Error("Conversa não encontrada.");
    let clienteId = conversa.cliente_id;
    const telefone = normalizarTelefone(conversa.telefone);
    if (!clienteId) {
      const { data: cliente, error: erroBusca } = await context.supabase.from("clientes").select("id").eq("telefone_normalizado", telefone).maybeSingle();
      if (erroBusca) throw new Error("Não foi possível consultar o cadastro do cliente.");
      clienteId = cliente?.id ?? null;
    }
    if (clienteId) {
      const { data: atualizado, error: erroSalvar } = await context.supabase.from("clientes").update({ nome }).eq("id", clienteId).select("id").single();
      if (erroSalvar || !atualizado) throw new Error("Não foi possível salvar o nome no cadastro do cliente.");
    } else {
      const { data: criado, error: erroCriar } = await context.supabase.from("clientes").insert({ nome, telefone: conversa.telefone, telefone_normalizado: telefone }).select("id").single();
      if (erroCriar || !criado) throw new Error("Não foi possível cadastrar o cliente.");
      clienteId = criado.id;
    }
    const { error: erroConversa } = await context.supabase.from("whatsapp_conversas").update({ nome_contato: nome, nome_manual: true, cliente_id: clienteId }).eq("telefone", conversa.telefone);
    if (erroConversa) throw new Error("Nome salvo no cadastro, mas não foi possível atualizar a conversa. Tente novamente.");
    return { nome };
  });