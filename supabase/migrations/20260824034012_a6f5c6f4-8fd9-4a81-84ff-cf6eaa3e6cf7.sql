-- Fluxos: mensagem de retorno no mesmo dia e fluxo para arquivos
ALTER TABLE public.bot_fluxos
  ADD COLUMN IF NOT EXISTS mensagem_retorno_dia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fluxo_arquivos boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS bot_fluxos_arquivos_unico
  ON public.bot_fluxos (fluxo_arquivos) WHERE fluxo_arquivos;

-- Respostas automáticas: 2º texto do dia e ações de SIM/NÃO
ALTER TABLE public.bot_respostas
  ADD COLUMN IF NOT EXISTS resposta_retorno_dia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS acao_sim text NOT NULL DEFAULT 'aguardar',
  ADD COLUMN IF NOT EXISTS destino_sim_fluxo_id uuid REFERENCES public.bot_fluxos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destino_sim_resposta_id uuid REFERENCES public.bot_respostas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acao_nao text NOT NULL DEFAULT 'aguardar',
  ADD COLUMN IF NOT EXISTS destino_nao_fluxo_id uuid REFERENCES public.bot_fluxos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destino_nao_resposta_id uuid REFERENCES public.bot_respostas(id) ON DELETE SET NULL;

-- Mensagens: ativo/desativado por mensagem + inatividade em duas etapas
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS msg_fora_horario_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_transferencia_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_finalizacao_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_orcamento_gerado_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_revisao_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS msg_orcamento_confirmado_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inatividade1_minutos integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS inatividade2_minutos integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS msg_inatividade1 text NOT NULL DEFAULT 'Ainda está por aí? 😊 Se precisar de algo, é só me chamar.',
  ADD COLUMN IF NOT EXISTS inatividade_status text NOT NULL DEFAULT 'finalizado',
  ADD COLUMN IF NOT EXISTS msg_inatividade_pendente text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS msg_inatividade_aguardando text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS msg_inatividade_em_atendimento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS msg_inatividade_finalizado text NOT NULL DEFAULT 'Vou encerrar por aqui, tudo bem? Quando precisar, é só chamar. 😊';

-- Conversas: qual aviso de inatividade já foi enviado
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS inatividade_etapa smallint NOT NULL DEFAULT 0;