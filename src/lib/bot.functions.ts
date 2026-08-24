import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Simula uma mensagem do cliente usando as configurações já salvas do bot. */
export const simularBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        texto: z.string().max(1000),
        tipo: z.enum(["texto", "documento", "imagem"]).default("texto"),
        etapa: z.string().max(60).default("inicio"),
        pendenteTipo: z.enum(["opcao", "resposta"]).nullish(),
        pendenteId: z.string().nullish(),
        primeiraDoDia: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { carregarDadosBot } = await import("@/lib/bot-dados.server");
    const { processarMenu, dentroDoHorario } = await import("@/lib/bot-motor");

    const dados = await carregarDadosBot();
    if (!dados) return { mensagens: [], etapa: data.etapa, aviso: "Configuração do bot não encontrada." };

    const agora = new Date();
    const mensagens: { texto: string; botoes?: string[] }[] = [];

    if (data.etapa === "inicio" && !dentroDoHorario(dados, agora) && dados.config.msg_fora_horario.trim()) {
      mensagens.push({ texto: dados.config.msg_fora_horario });
    }

    const saida = await processarMenu(
      dados,
      { etapa: data.etapa, pendenteTipo: data.pendenteTipo ?? null, pendenteId: data.pendenteId ?? null },
      {
        texto: data.texto,
        tipo: data.tipo,
        nome: "Cliente",
        telefone: "5500000000000",
        primeiraDoDia: data.primeiraDoDia,
      },
      {},
      agora,
    );

    if (saida.mensagens.length === 0 && data.etapa !== "inicio" && data.texto && dados.config.msg_nao_entendi.trim()) {
      mensagens.push({ texto: dados.config.msg_nao_entendi });
    }
    mensagens.push(...saida.mensagens);

    const descricao: Record<string, string> = {
      orcamento: "➡️ O bot iniciaria a coleta de arquivos para o orçamento.",
      consultar_pedido: "➡️ O bot buscaria os pedidos deste telefone.",
      curriculo: "➡️ O bot enviaria o link para preencher o currículo.",
      atendente: "➡️ A conversa iria para a fila de atendimento humano.",
    };
    if (saida.acao && descricao[saida.acao]) mensagens.push({ texto: descricao[saida.acao]! });

    return {
      mensagens,
      etapa: saida.estado.etapa,
      pendenteTipo: saida.estado.pendenteTipo ?? null,
      pendenteId: saida.estado.pendenteId ?? null,
      aviso: null as string | null,
    };
  });
