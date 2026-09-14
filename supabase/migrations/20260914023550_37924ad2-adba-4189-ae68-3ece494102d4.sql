CREATE OR REPLACE FUNCTION public.pode_acessar_conexao(_user_id uuid, _conexao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND _conexao_id IS NOT NULL
     AND (
       public.has_role(_user_id, 'admin'::public.app_role)
       OR EXISTS (
         SELECT 1
         FROM public.profiles p
         WHERE p.id = _user_id
           AND p.ativo
           AND p.conexao_id = _conexao_id
       )
     )
$$;

REVOKE ALL ON FUNCTION public.pode_acessar_conexao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_conexao(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS whatsapp_config_admin ON public.whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_select ON public.whatsapp_config;
CREATE POLICY whatsapp_config_conexao_select ON public.whatsapp_config
  FOR SELECT TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id));
CREATE POLICY whatsapp_config_conexao_insert ON public.whatsapp_config
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));
CREATE POLICY whatsapp_config_conexao_update ON public.whatsapp_config
  FOR UPDATE TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));
CREATE POLICY whatsapp_config_conexao_delete ON public.whatsapp_config
  FOR DELETE TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id));

DROP POLICY IF EXISTS bot_horarios_auth ON public.bot_horarios;
CREATE POLICY bot_horarios_conexao ON public.bot_horarios
  FOR ALL TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));

DROP POLICY IF EXISTS "Autenticados gerenciam fluxos" ON public.bot_fluxos;
CREATE POLICY bot_fluxos_conexao ON public.bot_fluxos
  FOR ALL TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));

DROP POLICY IF EXISTS "Autenticados gerenciam etapas" ON public.bot_fluxo_etapas;
CREATE POLICY bot_fluxo_etapas_conexao ON public.bot_fluxo_etapas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bot_fluxos f
    WHERE f.id = bot_fluxo_etapas.fluxo_id
      AND public.pode_acessar_conexao(auth.uid(), f.conexao_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bot_fluxos f
    WHERE f.id = bot_fluxo_etapas.fluxo_id
      AND public.pode_acessar_conexao(auth.uid(), f.conexao_id)
  ));

DROP POLICY IF EXISTS "Autenticados gerenciam opcoes de fluxo" ON public.bot_fluxo_opcoes;
CREATE POLICY bot_fluxo_opcoes_conexao ON public.bot_fluxo_opcoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bot_fluxo_etapas e
    JOIN public.bot_fluxos f ON f.id = e.fluxo_id
    WHERE e.id = bot_fluxo_opcoes.etapa_id
      AND public.pode_acessar_conexao(auth.uid(), f.conexao_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bot_fluxo_etapas e
    JOIN public.bot_fluxos f ON f.id = e.fluxo_id
    WHERE e.id = bot_fluxo_opcoes.etapa_id
      AND public.pode_acessar_conexao(auth.uid(), f.conexao_id)
  ));

DROP POLICY IF EXISTS bot_primeiro_contato_auth ON public.bot_primeiro_contato;
CREATE POLICY bot_primeiro_contato_conexao ON public.bot_primeiro_contato
  FOR ALL TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));

DROP POLICY IF EXISTS bot_respostas_auth ON public.bot_respostas;
CREATE POLICY bot_respostas_conexao ON public.bot_respostas
  FOR ALL TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));

DROP POLICY IF EXISTS bot_palavras_chave_auth ON public.bot_palavras_chave;
CREATE POLICY bot_palavras_chave_conexao ON public.bot_palavras_chave
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bot_respostas r
      WHERE r.id = bot_palavras_chave.resposta_id
        AND public.pode_acessar_conexao(auth.uid(), r.conexao_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.bot_menu_opcoes o
      WHERE o.id = bot_palavras_chave.opcao_id
        AND public.pode_acessar_conexao(auth.uid(), o.conexao_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bot_respostas r
      WHERE r.id = bot_palavras_chave.resposta_id
        AND public.pode_acessar_conexao(auth.uid(), r.conexao_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.bot_menu_opcoes o
      WHERE o.id = bot_palavras_chave.opcao_id
        AND public.pode_acessar_conexao(auth.uid(), o.conexao_id)
    )
  );

DROP POLICY IF EXISTS "Autenticados gerenciam numeros do bot" ON public.bot_numeros;
CREATE POLICY bot_numeros_conexao ON public.bot_numeros
  FOR ALL TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));

DROP POLICY IF EXISTS "Usuarios autenticados gerenciam status do whatsapp" ON public.bot_status_whatsapp;
CREATE POLICY bot_status_whatsapp_conexao ON public.bot_status_whatsapp
  FOR ALL TO authenticated
  USING (public.pode_acessar_conexao(auth.uid(), conexao_id))
  WITH CHECK (public.pode_acessar_conexao(auth.uid(), conexao_id));