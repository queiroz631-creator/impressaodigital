-- lovable-cron-fallback-reviewed: 96 runs/day; rotina de reconciliação já existente e aprovada na Etapa 5 — esta migração apenas reaponta o comando para o endereço interno novo, mantendo a mesma frequência de 15 minutos (rede de segurança contra eventos perdidos; o caminho normal é por evento)
SELECT cron.unschedule('reconciliar-sincronizacao-sorteios');
SELECT cron.schedule(
  'reconciliar-sincronizacao-sorteios',
  '*/15 * * * *',
  $$select public.disparar_rotina_sorteios('reconciliar-interno');$$
);