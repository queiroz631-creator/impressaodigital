DROP POLICY IF EXISTS whatsapp_config_conexao_select ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_conexao_insert ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_conexao_update ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_conexao_delete ON public.whatsapp_config;
CREATE POLICY whatsapp_config_conexao ON public.whatsapp_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = whatsapp_config.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = whatsapp_config.conexao_id));

DROP POLICY IF EXISTS bot_horarios_conexao ON public.bot_horarios;
CREATE POLICY bot_horarios_conexao ON public.bot_horarios
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_horarios.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_horarios.conexao_id));

DROP POLICY IF EXISTS bot_fluxos_conexao ON public.bot_fluxos;
CREATE POLICY bot_fluxos_conexao ON public.bot_fluxos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_fluxos.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_fluxos.conexao_id));

DROP POLICY IF EXISTS bot_fluxo_etapas_conexao ON public.bot_fluxo_etapas;
CREATE POLICY bot_fluxo_etapas_conexao ON public.bot_fluxo_etapas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bot_fluxos f WHERE f.id = bot_fluxo_etapas.fluxo_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_fluxos f WHERE f.id = bot_fluxo_etapas.fluxo_id));

DROP POLICY IF EXISTS bot_fluxo_opcoes_conexao ON public.bot_fluxo_opcoes;
CREATE POLICY bot_fluxo_opcoes_conexao ON public.bot_fluxo_opcoes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bot_fluxo_etapas e WHERE e.id = bot_fluxo_opcoes.etapa_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_fluxo_etapas e WHERE e.id = bot_fluxo_opcoes.etapa_id));

DROP POLICY IF EXISTS bot_primeiro_contato_conexao ON public.bot_primeiro_contato;
CREATE POLICY bot_primeiro_contato_conexao ON public.bot_primeiro_contato
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_primeiro_contato.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_primeiro_contato.conexao_id));

DROP POLICY IF EXISTS bot_respostas_conexao ON public.bot_respostas;
CREATE POLICY bot_respostas_conexao ON public.bot_respostas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_respostas.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_respostas.conexao_id));

DROP POLICY IF EXISTS bot_palavras_chave_conexao ON public.bot_palavras_chave;
CREATE POLICY bot_palavras_chave_conexao ON public.bot_palavras_chave
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bot_respostas r WHERE r.id = bot_palavras_chave.resposta_id) OR EXISTS (SELECT 1 FROM public.bot_menu_opcoes o WHERE o.id = bot_palavras_chave.opcao_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_respostas r WHERE r.id = bot_palavras_chave.resposta_id) OR EXISTS (SELECT 1 FROM public.bot_menu_opcoes o WHERE o.id = bot_palavras_chave.opcao_id));

DROP POLICY IF EXISTS bot_numeros_conexao ON public.bot_numeros;
CREATE POLICY bot_numeros_conexao ON public.bot_numeros
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_numeros.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_numeros.conexao_id));

DROP POLICY IF EXISTS bot_status_whatsapp_conexao ON public.bot_status_whatsapp;
CREATE POLICY bot_status_whatsapp_conexao ON public.bot_status_whatsapp
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_status_whatsapp.conexao_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo AND p.conexao_id = bot_status_whatsapp.conexao_id));

REVOKE ALL ON FUNCTION public.pode_acessar_conexao(uuid, uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.pode_acessar_conexao(uuid, uuid);