CREATE OR REPLACE FUNCTION public.sorteio_totais_por_elegibilidade(
  _sorteio_id uuid,
  _apenas_concorrentes boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _totais jsonb;
BEGIN
  IF NOT public.pode_sorteios() THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sorteios WHERE id = _sorteio_id) THEN
    RAISE EXCEPTION 'SORTEIO_NAO_ENCONTRADO';
  END IF;

  SELECT jsonb_build_object(
    'participantes', (
      SELECT count(*)
      FROM public.sorteio_participantes p
      WHERE p.sorteio_id = _sorteio_id
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'notas_validas', (
      SELECT count(*)
      FROM public.sorteio_notas n
      JOIN public.sorteio_participantes p ON p.id = n.participante_id
      WHERE n.sorteio_id = _sorteio_id AND n.status = 'VALIDA'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'notas_canceladas', (
      SELECT count(*)
      FROM public.sorteio_notas n
      JOIN public.sorteio_participantes p ON p.id = n.participante_id
      WHERE n.sorteio_id = _sorteio_id AND n.status = 'CANCELADA'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'notas_pendentes', (
      SELECT count(*)
      FROM public.sorteio_notas n
      JOIN public.sorteio_participantes p ON p.id = n.participante_id
      WHERE n.sorteio_id = _sorteio_id AND n.status = 'PENDENTE'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'notas_invalidas', (
      SELECT count(*)
      FROM public.sorteio_notas n
      JOIN public.sorteio_participantes p ON p.id = n.participante_id
      WHERE n.sorteio_id = _sorteio_id AND n.status = 'INVALIDA'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'valor_notas_validas_centavos', (
      SELECT coalesce(sum(n.valor_centavos), 0)
      FROM public.sorteio_notas n
      JOIN public.sorteio_participantes p ON p.id = n.participante_id
      WHERE n.sorteio_id = _sorteio_id AND n.status = 'VALIDA'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'cupons_ativos', (
      SELECT count(*)
      FROM public.sorteio_cupons c
      JOIN public.sorteio_participantes p ON p.id = c.participante_id
      WHERE c.sorteio_id = _sorteio_id AND c.status = 'ATIVO'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'cupons_cancelados', (
      SELECT count(*)
      FROM public.sorteio_cupons c
      JOIN public.sorteio_participantes p ON p.id = c.participante_id
      WHERE c.sorteio_id = _sorteio_id AND c.status = 'CANCELADO'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'cupons_utilizados', (
      SELECT count(*)
      FROM public.sorteio_cupons c
      JOIN public.sorteio_participantes p ON p.id = c.participante_id
      WHERE c.sorteio_id = _sorteio_id AND c.status = 'UTILIZADO'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'saldo_acumulado_centavos', (
      SELECT coalesce(sum(p.saldo_centavos), 0)
      FROM public.sorteio_participantes p
      WHERE p.sorteio_id = _sorteio_id
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'fontes_pendentes', (
      SELECT count(*)
      FROM public.sorteio_saldo_fontes f
      JOIN public.sorteio_participantes p ON p.id = f.participante_id
      WHERE f.sorteio_id = _sorteio_id AND f.status = 'PENDENTE'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'fontes_pendentes_centavos', (
      SELECT coalesce(sum(f.valor_pendente_centavos), 0)
      FROM public.sorteio_saldo_fontes f
      JOIN public.sorteio_participantes p ON p.id = f.participante_id
      WHERE f.sorteio_id = _sorteio_id AND f.status = 'PENDENTE'
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'contribuicoes', (
      SELECT count(*)
      FROM public.sorteio_cupom_contribuicoes x
      JOIN public.sorteio_participantes p ON p.id = x.participante_id
      WHERE x.sorteio_id = _sorteio_id
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    ),
    'contribuicoes_centavos', (
      SELECT coalesce(sum(x.valor_centavos), 0)
      FROM public.sorteio_cupom_contribuicoes x
      JOIN public.sorteio_participantes p ON p.id = x.participante_id
      WHERE x.sorteio_id = _sorteio_id
        AND (NOT _apenas_concorrentes OR p.concorre_sorteio)
    )
  ) INTO _totais;

  RETURN _totais;
END;
$$;

REVOKE ALL ON FUNCTION public.sorteio_totais_por_elegibilidade(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sorteio_totais_por_elegibilidade(uuid, boolean) TO authenticated, service_role;