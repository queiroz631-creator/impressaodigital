# Nº da Sorte — Etapa 5: auditoria, implantação e reversão

## Situação: NÃO APROVADO PARA PRODUÇÃO (pendências abaixo)

## A. Verificado (somente leitura, banco atual sem gravação)
- Intervalo configurável existe: colunas `sufixo_inicial`/`sufixo_final`, histórico `numero_sorte_intervalo_historico`, função `numero_sorte_ampliar_intervalo`.
- Unicidade no banco: `codigo` único, `(campanha_id, sufixo)` único, `premiacoes.numero_id` único, `premiacoes (campanha_id, cliente_id)` único (um prêmio por cliente por campanha).
- RLS ativa em todas as 12 tabelas `numero_sorte_*`.
- Consulta: limites por cliente/campanha (padrão 10) e janelas de tempo (5/20/120), reserva com `FOR UPDATE SKIP LOCKED`, cliente premiado recebe `ja_premiado`.
- CSV: separador `;`, BOM UTF-8, proteção contra fórmulas. Datas exibidas em America/Sao_Paulo.
- Testes automáticos: 13 arquivos, 90 testes, 90 aprovados.

## C. Riscos
- ALTO: CPF + telefone bastam para entrar e reabrir comprovante. Proposta: código de 6 dígitos via WhatsApp (Z-API) antes de reabrir comprovante. Aguardando aprovação.
- MÉDIO: intervalos que não dividem 100.000 têm viés mínimo na distribuição.

## Pendências (exigem banco isolado — não executadas)
Concorrência (reserva e entrega dupla), carga (1k/10k/100k), permissões por perfil, indicadores com dados controlados, exportação real, telas autenticadas em celular/tablet. Rodar num Supabase local/VPS de testes com dados sintéticos.

## G. Implantação (VPS, PM2, Nginx, Supabase self-hosted)
1. Conferir branch e commit aprovado (`git log -1`).
2. Backup: `pg_dump` completo + cópia dos buckets `numero-sorte-*`.
3. `df -h`; conferir `.env` (URL, chaves).
4. Revisar migrações `supabase/migrations/20261022050000` a `20261022090000` (ordem cronológica) e aplicar com `deploy/aplicar-migracoes.sh`.
5. `bun install`, build, `pm2 reload` do processo.
6. Saúde: página inicial, painel Nº da Sorte, `/numero-da-sorte/<campanha>`, `pm2 logs`, logs do Nginx; monitorar 24 h.

## Reversão
- Código: `git checkout <commit anterior>`, build, `pm2 reload`.
- Banco: migrações são aditivas; não apagar. Desativar campanhas (situação `suspensa`) e, se preciso, restaurar o `pg_dump`.
- Dados: restaurar backup somente das tabelas `numero_sorte_*`.
- Storage: restaurar cópia dos buckets; não apagar objetos.
