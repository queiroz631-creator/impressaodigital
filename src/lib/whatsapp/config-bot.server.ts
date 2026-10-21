/**
 * Garante a configuração de bot de uma conexão (somente servidor).
 *
 * Uma conexão de WhatsApp precisa de uma linha em `whatsapp_config` e de sete
 * linhas em `bot_horarios` (uma por dia da semana). Conexões criadas por telas
 * antigas — ou manualmente, como a instância de teste da Evolution — podem não
 * ter essas linhas. Sem elas, a tela "Configurar Bot" não tem o que exibir e
 * ficava presa no esqueleto de carregamento.
 *
 * As linhas são criadas com os MESMOS padrões da criação de conexão: bot
 * desligado e domingo fechado. Nada é copiado de outra conexão.
 */

const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6];

/**
 * Cliente administrativo. A promessa é guardada: o `import()` acontece uma
 * única vez, mesmo com chamadas simultâneas (evita corrida de resolução).
 */
let promessaCliente: Promise<(typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"]> | null = null;

function cliente() {
  if (!promessaCliente) {
    promessaCliente = import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
  }
  return promessaCliente;
}

/** Padrão de horário de um dia (domingo fechado, demais abertos). */
export function horarioPadrao(conexaoId: string, dia: number) {
  return { conexao_id: conexaoId, dia_semana: dia, fechado: dia === 0 };
}

/**
 * Cria a configuração da conexão quando ela ainda não existe.
 * Idempotente: chamadas simultâneas não geram linha duplicada (o índice único
 * de `whatsapp_config.conexao_id` é a proteção definitiva).
 * Devolve `true` quando criou a configuração agora.
 */
export async function garantirConfiguracaoDaConexao(conexaoId: string, nome: string): Promise<boolean> {
  const supabaseAdmin = await cliente();

  const { data: existente } = await supabaseAdmin
    .from("whatsapp_config")
    .select("id")
    .eq("conexao_id", conexaoId)
    .maybeSingle();
  if (existente) return false;

  const { error } = await supabaseAdmin.from("whatsapp_config").insert({
    conexao_id: conexaoId,
    conexao_nome: nome,
    bot_ativo: false,
    webhook_token: crypto.randomUUID().replace(/-/g, ""),
  });

  // 23505 = outra requisição criou a configuração ao mesmo tempo: o índice
  // único garantiu uma só linha. Quem perdeu a corrida NÃO criou nada.
  if (error && error.code !== "23505") {
    throw new Error(`Não foi possível criar a configuração do bot: ${error.message}`);
  }
  const criouAgora = !error;

  // Horários padrão só quando a conexão ainda não tem nenhum dia cadastrado.
  const { data: horarios } = await supabaseAdmin
    .from("bot_horarios")
    .select("id")
    .eq("conexao_id", conexaoId)
    .limit(1);
  if (!horarios?.length) {
    await supabaseAdmin.from("bot_horarios").insert(DIAS_SEMANA.map((dia) => horarioPadrao(conexaoId, dia)));
  }

  return criouAgora;
}
