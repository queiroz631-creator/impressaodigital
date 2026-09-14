-- =====================================================================
-- Módulo Sorteios — Etapa 1 (fundação): tabelas, relacionamentos, RLS.
-- Não altera nenhuma tabela de outros módulos. `public.clientes` continua
-- sendo o cadastro mestre; aqui só há referência a clientes.id.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.pode_sorteios()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.tem_permissao(auth.uid(), 'sorteios.visualizar')
$$;
REVOKE ALL ON FUNCTION public.pode_sorteios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_sorteios() TO authenticated, service_role;

-- ------------------------------------------------------------- sorteios
CREATE TABLE public.sorteios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  numero_sorteio integer NOT NULL,
  status text NOT NULL DEFAULT 'RASCUNHO'
    CHECK (status IN ('RASCUNHO','ATIVO','ENCERRADO','CANCELADO','SORTEADO')),
  data_inicio timestamptz,
  data_fim timestamptz,
  data_sorteio timestamptz,
  valor_por_cupom_centavos integer NOT NULL DEFAULT 0 CHECK (valor_por_cupom_centavos >= 0),
  quantidade_maxima_cupons integer CHECK (quantidade_maxima_cupons IS NULL OR quantidade_maxima_cupons > 0),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteios_numero_unico UNIQUE (numero_sorteio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteios TO authenticated;
GRANT ALL ON public.sorteios TO service_role;
ALTER TABLE public.sorteios ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteios_acesso ON public.sorteios FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- -------------------------------------------------------- sorteio_termos
CREATE TABLE public.sorteio_termos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  regras text NOT NULL DEFAULT '',
  informacoes text NOT NULL DEFAULT '',
  premios text NOT NULL DEFAULT '',
  como_participar text NOT NULL DEFAULT '',
  validade text NOT NULL DEFAULT '',
  como_sera_realizado text NOT NULL DEFAULT '',
  outras_condicoes text NOT NULL DEFAULT '',
  publicado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteio_termos_versao_unica UNIQUE (sorteio_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_termos TO authenticated;
GRANT ALL ON public.sorteio_termos TO service_role;
ALTER TABLE public.sorteio_termos ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_termos_acesso ON public.sorteio_termos FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- ------------------------------------------------- sorteio_participantes
CREATE TABLE public.sorteio_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  saldo_centavos integer NOT NULL DEFAULT 0 CHECK (saldo_centavos >= 0),
  sincronizacao_status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (sincronizacao_status IN ('PENDENTE','SINCRONIZADO','ERRO')),
  sincronizado_em timestamptz,
  aceite_termos_em timestamptz,
  aceite_termos_versao integer,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteio_participantes_unico UNIQUE (sorteio_id, cliente_id)
);
CREATE INDEX sorteio_participantes_cliente_idx ON public.sorteio_participantes (cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_participantes TO authenticated;
GRANT ALL ON public.sorteio_participantes TO service_role;
ALTER TABLE public.sorteio_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_participantes_acesso ON public.sorteio_participantes FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- ---------------------------------------------------- sorteio_notas_base
CREATE TABLE public.sorteio_notas_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  valor_centavos integer NOT NULL CHECK (valor_centavos >= 0),
  data_nota timestamptz,
  origem_id text,
  sincronizado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sorteio_notas_base_busca_idx ON public.sorteio_notas_base (numero, valor_centavos);
CREATE INDEX sorteio_notas_base_data_idx ON public.sorteio_notas_base (data_nota);
CREATE UNIQUE INDEX sorteio_notas_base_origem_unico ON public.sorteio_notas_base (origem_id)
  WHERE origem_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_notas_base TO authenticated;
GRANT ALL ON public.sorteio_notas_base TO service_role;
ALTER TABLE public.sorteio_notas_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_notas_base_acesso ON public.sorteio_notas_base FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());
COMMENT ON COLUMN public.sorteio_notas_base.data_nota IS
  'Somente sincronização/auditoria. NUNCA usada para validar a nota do participante (validação = número + valor).';

-- --------------------------------------------------------- sorteio_notas
CREATE TABLE public.sorteio_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE RESTRICT,
  participante_id uuid NOT NULL REFERENCES public.sorteio_participantes(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  valor_centavos integer NOT NULL CHECK (valor_centavos >= 0),
  status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','VALIDA','INVALIDA','CANCELADA')),
  motivo_invalidez text,
  cadastrado_em timestamptz NOT NULL DEFAULT now(),
  validado_em timestamptz,
  invalidado_em timestamptz,
  cancelado_em timestamptz,
  nota_base_id uuid REFERENCES public.sorteio_notas_base(id) ON DELETE SET NULL,
  cupons_gerados integer NOT NULL DEFAULT 0 CHECK (cupons_gerados >= 0),
  saldo_gerado_centavos integer NOT NULL DEFAULT 0 CHECK (saldo_gerado_centavos >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteio_notas_numero_unico UNIQUE (sorteio_id, numero)
);
CREATE INDEX sorteio_notas_participante_idx ON public.sorteio_notas (participante_id);
CREATE INDEX sorteio_notas_status_idx ON public.sorteio_notas (sorteio_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_notas TO authenticated;
GRANT ALL ON public.sorteio_notas TO service_role;
ALTER TABLE public.sorteio_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_notas_acesso ON public.sorteio_notas FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- -------------------------------------------------------- sorteio_cupons
CREATE TABLE public.sorteio_cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE RESTRICT,
  participante_id uuid NOT NULL REFERENCES public.sorteio_participantes(id) ON DELETE RESTRICT,
  nota_id uuid NOT NULL REFERENCES public.sorteio_notas(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  valor_base_centavos integer NOT NULL DEFAULT 0 CHECK (valor_base_centavos >= 0),
  gerado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO','CANCELADO','UTILIZADO')),
  cancelado_em timestamptz,
  CONSTRAINT sorteio_cupons_numero_unico UNIQUE (sorteio_id, numero)
);
CREATE INDEX sorteio_cupons_nota_idx ON public.sorteio_cupons (nota_id);
CREATE INDEX sorteio_cupons_participante_idx ON public.sorteio_cupons (participante_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_cupons TO authenticated;
GRANT ALL ON public.sorteio_cupons TO service_role;
ALTER TABLE public.sorteio_cupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_cupons_acesso ON public.sorteio_cupons FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());
COMMENT ON COLUMN public.sorteio_cupons.numero IS
  'Número aleatório do cupom (geração implementada em etapa posterior). Único dentro do sorteio.';

-- ----------------------------------------------------- sorteio_historico
CREATE TABLE public.sorteio_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE RESTRICT,
  numero_sorteio integer NOT NULL,
  saldo_final_centavos integer NOT NULL DEFAULT 0 CHECK (saldo_final_centavos >= 0),
  quantidade_notas integer NOT NULL DEFAULT 0 CHECK (quantidade_notas >= 0),
  quantidade_cupons integer NOT NULL DEFAULT 0 CHECK (quantidade_cupons >= 0),
  data_inicio timestamptz,
  data_fim timestamptz,
  encerrado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sorteio_historico_unico UNIQUE (cliente_id, sorteio_id)
);
CREATE INDEX sorteio_historico_cliente_idx ON public.sorteio_historico (cliente_id, criado_em DESC);
GRANT SELECT, INSERT, UPDATE ON public.sorteio_historico TO authenticated;
GRANT ALL ON public.sorteio_historico TO service_role;
ALTER TABLE public.sorteio_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_historico_leitura ON public.sorteio_historico FOR SELECT TO authenticated
  USING (public.pode_sorteios());
CREATE POLICY sorteio_historico_insercao ON public.sorteio_historico FOR INSERT TO authenticated
  WITH CHECK (public.pode_sorteios());
CREATE POLICY sorteio_historico_atualizacao ON public.sorteio_historico FOR UPDATE TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- ------------------------------------------------------- sorteio_premios
CREATE TABLE public.sorteio_premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sorteio_premios_sorteio_idx ON public.sorteio_premios (sorteio_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_premios TO authenticated;
GRANT ALL ON public.sorteio_premios TO service_role;
ALTER TABLE public.sorteio_premios ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_premios_acesso ON public.sorteio_premios FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- ---------------------------------------------------- sorteio_ganhadores
CREATE TABLE public.sorteio_ganhadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid NOT NULL REFERENCES public.sorteios(id) ON DELETE RESTRICT,
  premio_id uuid REFERENCES public.sorteio_premios(id) ON DELETE SET NULL,
  participante_id uuid NOT NULL REFERENCES public.sorteio_participantes(id) ON DELETE RESTRICT,
  cupom_id uuid NOT NULL REFERENCES public.sorteio_cupons(id) ON DELETE RESTRICT,
  numero_cupom text NOT NULL,
  sorteado_em timestamptz NOT NULL DEFAULT now(),
  observacao text,
  CONSTRAINT sorteio_ganhadores_cupom_unico UNIQUE (sorteio_id, cupom_id)
);
CREATE INDEX sorteio_ganhadores_sorteio_idx ON public.sorteio_ganhadores (sorteio_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorteio_ganhadores TO authenticated;
GRANT ALL ON public.sorteio_ganhadores TO service_role;
ALTER TABLE public.sorteio_ganhadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_ganhadores_acesso ON public.sorteio_ganhadores FOR ALL TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- ----------------------------------------------- sorteio_sincronizacoes
CREATE TABLE public.sorteio_sincronizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('CLIENTES','NOTAS')),
  direcao text NOT NULL CHECK (direcao IN ('SUPABASE_PARA_LOCAL','LOCAL_PARA_SUPABASE')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  status text NOT NULL DEFAULT 'EXECUTANDO'
    CHECK (status IN ('EXECUTANDO','CONCLUIDA','ERRO','PARCIAL')),
  registros_enviados integer NOT NULL DEFAULT 0 CHECK (registros_enviados >= 0),
  registros_recebidos integer NOT NULL DEFAULT 0 CHECK (registros_recebidos >= 0),
  registros_processados integer NOT NULL DEFAULT 0 CHECK (registros_processados >= 0),
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sorteio_sincronizacoes_idx ON public.sorteio_sincronizacoes (tipo, iniciado_em DESC);
GRANT SELECT, INSERT, UPDATE ON public.sorteio_sincronizacoes TO authenticated;
GRANT ALL ON public.sorteio_sincronizacoes TO service_role;
ALTER TABLE public.sorteio_sincronizacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_sincronizacoes_leitura ON public.sorteio_sincronizacoes FOR SELECT TO authenticated
  USING (public.pode_sorteios());
CREATE POLICY sorteio_sincronizacoes_insercao ON public.sorteio_sincronizacoes FOR INSERT TO authenticated
  WITH CHECK (public.pode_sorteios());
CREATE POLICY sorteio_sincronizacoes_atualizacao ON public.sorteio_sincronizacoes FOR UPDATE TO authenticated
  USING (public.pode_sorteios()) WITH CHECK (public.pode_sorteios());

-- -------------------------------------------------------- sorteio_auditoria
CREATE TABLE public.sorteio_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sorteio_id uuid REFERENCES public.sorteios(id) ON DELETE SET NULL,
  participante_id uuid REFERENCES public.sorteio_participantes(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nota_id uuid REFERENCES public.sorteio_notas(id) ON DELETE SET NULL,
  cupom_id uuid REFERENCES public.sorteio_cupons(id) ON DELETE SET NULL,
  evento text NOT NULL,
  origem text NOT NULL DEFAULT 'sistema',
  usuario_id uuid,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sorteio_auditoria_sorteio_idx ON public.sorteio_auditoria (sorteio_id, criado_em DESC);
CREATE INDEX sorteio_auditoria_nota_idx ON public.sorteio_auditoria (nota_id);
GRANT SELECT, INSERT ON public.sorteio_auditoria TO authenticated;
GRANT ALL ON public.sorteio_auditoria TO service_role;
ALTER TABLE public.sorteio_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY sorteio_auditoria_leitura ON public.sorteio_auditoria FOR SELECT TO authenticated
  USING (public.pode_sorteios());
CREATE POLICY sorteio_auditoria_insercao ON public.sorteio_auditoria FOR INSERT TO authenticated
  WITH CHECK (public.pode_sorteios());

-- ------------------------------------------------------------- gatilhos
CREATE OR REPLACE FUNCTION public.sorteio_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE TRIGGER sorteios_atualizado_em BEFORE UPDATE ON public.sorteios
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();
CREATE TRIGGER sorteio_termos_atualizado_em BEFORE UPDATE ON public.sorteio_termos
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();
CREATE TRIGGER sorteio_participantes_atualizado_em BEFORE UPDATE ON public.sorteio_participantes
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();
CREATE TRIGGER sorteio_notas_base_atualizado_em BEFORE UPDATE ON public.sorteio_notas_base
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();
CREATE TRIGGER sorteio_notas_atualizado_em BEFORE UPDATE ON public.sorteio_notas
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();
CREATE TRIGGER sorteio_premios_atualizado_em BEFORE UPDATE ON public.sorteio_premios
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_set_atualizado_em();

-- Nota CANCELADA propaga CANCELADO para seus cupons (nunca o contrário).
-- Nenhum saldo é recalculado e nenhum registro é apagado.
CREATE OR REPLACE FUNCTION public.sorteio_cancelar_cupons_da_nota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CANCELADA' AND OLD.status IS DISTINCT FROM 'CANCELADA' THEN
    IF NEW.cancelado_em IS NULL THEN NEW.cancelado_em := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sorteio_propagar_cancelamento_nota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CANCELADA' AND OLD.status IS DISTINCT FROM 'CANCELADA' THEN
    UPDATE public.sorteio_cupons
       SET status = 'CANCELADO',
           cancelado_em = COALESCE(cancelado_em, now())
     WHERE nota_id = NEW.id
       AND status <> 'CANCELADO';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sorteio_notas_marcar_cancelamento BEFORE UPDATE ON public.sorteio_notas
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_cancelar_cupons_da_nota();
CREATE TRIGGER sorteio_notas_propagar_cancelamento AFTER UPDATE ON public.sorteio_notas
  FOR EACH ROW EXECUTE FUNCTION public.sorteio_propagar_cancelamento_nota();