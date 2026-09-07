import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Regrava o arquivo de controle após qualquer mudança nos agendamentos. */
export const sincronizarAgendaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { regravarAgenda } = await import("@/lib/status-whatsapp.server");
    const agenda = await regravarAgenda();
    return { ok: true as const, proximo_em: agenda.proximo_em, versao: agenda.versao };
  });

/** Publica agora um agendamento (teste manual). */
export const publicarStatusAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: reg } = await context.supabase
      .from("bot_status_whatsapp")
      .select(
        "id, tipo, texto, cor_fundo, imagem_url, legenda, modo, agendado_em, dias_semana, hora, ativo, ultima_publicacao_em",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (!reg) return { ok: false as const, erro: "Publicação não encontrada." };

    const { publicarERegistrar, regravarAgenda } = await import("@/lib/status-whatsapp.server");
    const r = await publicarERegistrar(reg as never);
    await regravarAgenda();
    return { ok: r.ok, erro: r.erro };
  });
