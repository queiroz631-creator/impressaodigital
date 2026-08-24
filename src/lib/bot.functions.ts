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

    if (data.etapa === "inicio" && !dentroDoHorario(dados, agora) && dados.config.msg_fora_horario_ativo && dados.config.msg_fora_horario.trim()) {
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

/** Simula um fluxo configurado, sem enviar nada pelo WhatsApp. */
export const simularFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fluxoId: z.string(),
        texto: z.string().max(1000).default(""),
        tipo: z.enum(["texto", "documento", "imagem"]).default("texto"),
        estado: z
          .object({
            fluxoId: z.string(),
            etapaId: z.string(),
            aguardando: z.boolean(),
            respostas: z.record(z.string(), z.string()),
          })
          .nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { carregarFluxos } = await import("@/lib/bot-dados.server");
    const motor = await import("@/lib/bot-fluxos-motor");
    const { ACOES_ETAPA } = await import("@/lib/bot-fluxos");

    const dados = await carregarFluxos();
    const agora = new Date();
    const vars = { nome: "Cliente", telefone: "5500000000000", agora };

    const saida = data.estado
      ? motor.processarFluxo(
          dados,
          data.estado,
          { texto: data.texto, tipo: data.tipo, nome: vars.nome, telefone: vars.telefone },
          agora,
        )
      : motor.iniciar(dados, data.fluxoId, {}, vars);

    const mensagens = saida.mensagens.map((m) => ({ texto: m.texto, botoes: m.botoes ?? [] }));

    if (saida.naoEntendi) mensagens.unshift({ texto: "⚠️ O bot não entendeu esta resposta nesta etapa.", botoes: [] });
    if (saida.acao) {
      const rotulo = ACOES_ETAPA.find((a) => a.valor === saida.acao)?.rotulo ?? saida.acao;
      mensagens.push({ texto: `➡️ Ação do sistema: ${rotulo}.`, botoes: [] });
    }
    if (saida.transferir) mensagens.push({ texto: "➡️ A conversa iria para a fila de atendimento humano.", botoes: [] });
    if (saida.pendente) mensagens.push({ texto: "➡️ A conversa ficaria como atendimento pendente.", botoes: [] });
    if (saida.finalizar) mensagens.push({ texto: "➡️ O atendimento seria finalizado.", botoes: [] });

    return { mensagens, estado: saida.estado, fim: saida.estado === null };
  });
