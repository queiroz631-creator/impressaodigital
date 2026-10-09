import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizarTelefone } from "./whatsapp-comum";
import { identificarClienteCurriculo } from "./whatsapp-curriculo-associacao";
import { carregarDadosCurriculo } from "./curriculo-dados";

export const consultarCurriculosConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid(), curriculoId: z.string().uuid().optional(), carregarPdf: z.boolean().default(false) }))
  .handler(async ({ data, context }) => {
    for (const chave of ["whatsapp.visualizar", "curriculos.visualizar"]) {
      const { data: permitido, error } = await context.supabase.rpc("tem_permissao", { _user_id: context.userId, _chave: chave });
      if (error || !permitido) throw new Error("Você não tem permissão para acessar os currículos neste atendimento.");
    }
    const { data: conversa, error } = await context.supabase.from("whatsapp_conversas").select("cliente_id, telefone, nome_contato").eq("id", data.conversaId).single();
    if (error || !conversa) throw new Error("Conversa não encontrada.");
    let candidatos: { id: string; nome: string }[] = [];
    if (!conversa.cliente_id) {
      const { data: clientes, error: erroClientes } = await context.supabase.from("clientes").select("id,nome").eq("telefone_normalizado", normalizarTelefone(conversa.telefone)).limit(2);
      if (erroClientes) throw new Error("Não foi possível identificar o cliente.");
      candidatos = clientes ?? [];
    }
    const { clienteId, ambiguo } = identificarClienteCurriculo(conversa.cliente_id, candidatos);
    const { data: curriculos, error: erroCurriculos } = clienteId
      ? await context.supabase.from("curriculos").select("id,nome_completo,status,updated_at").eq("cliente_id", clienteId).order("updated_at", { ascending: false })
      : { data: [], error: null };
    if (erroCurriculos) throw new Error("Não foi possível consultar os currículos.");
    if (data.curriculoId && !(curriculos ?? []).some((c) => c.id === data.curriculoId)) throw new Error("Este currículo não está associado ao cliente da conversa.");
    const dadosPdf = data.carregarPdf && data.curriculoId ? await carregarDadosCurriculo(context.supabase, data.curriculoId) : null;
    return { nome: conversa.nome_contato || candidatos[0]?.nome || "Cliente", telefone: conversa.telefone, ambiguo, curriculos: curriculos ?? [], dadosPdf };
  });