DROP POLICY IF EXISTS whatsapp_conversas_conexao ON public.whatsapp_conversas;
CREATE POLICY whatsapp_conversas_conexao ON public.whatsapp_conversas
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR conexao_id IS NULL
  OR public.conexao_do_usuario(auth.uid()) IS NULL
  OR conexao_id = public.conexao_do_usuario(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR conexao_id IS NULL
  OR public.conexao_do_usuario(auth.uid()) IS NULL
  OR conexao_id = public.conexao_do_usuario(auth.uid())
);

DROP POLICY IF EXISTS whatsapp_mensagens_conexao ON public.whatsapp_mensagens;
CREATE POLICY whatsapp_mensagens_conexao ON public.whatsapp_mensagens
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.whatsapp_conversas c
    WHERE c.id = whatsapp_mensagens.conversa_id
      AND (c.conexao_id IS NULL
           OR public.conexao_do_usuario(auth.uid()) IS NULL
           OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.whatsapp_conversas c
    WHERE c.id = whatsapp_mensagens.conversa_id
      AND (c.conexao_id IS NULL
           OR public.conexao_do_usuario(auth.uid()) IS NULL
           OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
  )
);

DROP POLICY IF EXISTS whatsapp_arquivos_conexao ON public.whatsapp_arquivos;
CREATE POLICY whatsapp_arquivos_conexao ON public.whatsapp_arquivos
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.whatsapp_conversas c
    WHERE c.id = whatsapp_arquivos.conversa_id
      AND (c.conexao_id IS NULL
           OR public.conexao_do_usuario(auth.uid()) IS NULL
           OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.whatsapp_conversas c
    WHERE c.id = whatsapp_arquivos.conversa_id
      AND (c.conexao_id IS NULL
           OR public.conexao_do_usuario(auth.uid()) IS NULL
           OR c.conexao_id = public.conexao_do_usuario(auth.uid()))
  )
);
