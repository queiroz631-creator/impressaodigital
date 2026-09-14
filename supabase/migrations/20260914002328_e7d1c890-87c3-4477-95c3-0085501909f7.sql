-- 1) Conexão inicial passa a chamar "Impressão Digital"
UPDATE public.whatsapp_conexoes SET nome = 'Impressão Digital' WHERE ordem = 0 AND nome = 'Principal';

-- 2) Isolamento definitivo por conexão (remove as cláusulas permissivas)
DROP POLICY IF EXISTS whatsapp_conversas_conexao ON public.whatsapp_conversas;
CREATE POLICY whatsapp_conversas_conexao ON public.whatsapp_conversas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (conexao_id IS NOT NULL AND conexao_id = public.conexao_do_usuario(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (conexao_id IS NOT NULL AND conexao_id = public.conexao_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS whatsapp_mensagens_conexao ON public.whatsapp_mensagens;
CREATE POLICY whatsapp_mensagens_conexao ON public.whatsapp_mensagens
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = whatsapp_mensagens.conversa_id
         AND c.conexao_id IS NOT NULL
         AND c.conexao_id = public.conexao_do_usuario(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = whatsapp_mensagens.conversa_id
         AND c.conexao_id IS NOT NULL
         AND c.conexao_id = public.conexao_do_usuario(auth.uid())
    )
  );

DROP POLICY IF EXISTS whatsapp_arquivos_conexao ON public.whatsapp_arquivos;
CREATE POLICY whatsapp_arquivos_conexao ON public.whatsapp_arquivos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = whatsapp_arquivos.conversa_id
         AND c.conexao_id IS NOT NULL
         AND c.conexao_id = public.conexao_do_usuario(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.id = whatsapp_arquivos.conversa_id
         AND c.conexao_id IS NOT NULL
         AND c.conexao_id = public.conexao_do_usuario(auth.uid())
    )
  );

-- 3) Credenciais das conexões nunca vão para o navegador
DROP POLICY IF EXISTS conexoes_select ON public.whatsapp_conexoes;

-- 4) Índices de apoio
CREATE INDEX IF NOT EXISTS whatsapp_conversas_conexao_idx ON public.whatsapp_conversas (conexao_id);
CREATE INDEX IF NOT EXISTS whatsapp_config_conexao_idx ON public.whatsapp_config (conexao_id);
CREATE INDEX IF NOT EXISTS bot_fluxos_conexao_idx ON public.bot_fluxos (conexao_id);
CREATE INDEX IF NOT EXISTS bot_respostas_conexao_idx ON public.bot_respostas (conexao_id);
CREATE INDEX IF NOT EXISTS bot_horarios_conexao_idx ON public.bot_horarios (conexao_id);
CREATE INDEX IF NOT EXISTS bot_menu_opcoes_conexao_idx ON public.bot_menu_opcoes (conexao_id);
CREATE INDEX IF NOT EXISTS bot_primeiro_contato_conexao_idx ON public.bot_primeiro_contato (conexao_id);
CREATE INDEX IF NOT EXISTS bot_numeros_conexao_idx ON public.bot_numeros (conexao_id);
CREATE INDEX IF NOT EXISTS bot_status_whatsapp_conexao_idx ON public.bot_status_whatsapp (conexao_id);