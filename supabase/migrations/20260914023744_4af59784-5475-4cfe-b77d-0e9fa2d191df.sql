DROP POLICY IF EXISTS bot_menu_opcoes_auth ON public.bot_menu_opcoes;
CREATE POLICY bot_menu_opcoes_conexao ON public.bot_menu_opcoes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ativo
        AND p.conexao_id = bot_menu_opcoes.conexao_id
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.ativo
        AND p.conexao_id = bot_menu_opcoes.conexao_id
    )
  );