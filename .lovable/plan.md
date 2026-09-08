# Exportar o banco atual para migrar para a VPS

## Como fazer
1. No Lovable, abra **Cloud → Configurações avançadas → Exportar dados** e baixe o backup do banco (essa tela só exporta; não há importação por ela).
2. Na VPS, restaure o backup no Postgres do Supabase auto-hospedado (porta 5432, usuário `postgres`, senha definida no `/opt/supabase/supabase/docker/.env`), com `pg_restore` ou `psql` conforme o formato do arquivo.
3. Recrie no novo Supabase os buckets de armazenamento (todos privados): **bot-midia**, **orcamento-arquivos**, **sistema** e **whatsapp**, e copie os arquivos, se houver.
4. Ative as extensões e recrie os agendamentos do bot apontando para o novo domínio:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```
   Os agendamentos atuais chamam endereços `*.lovable.app` — recrie-os com a URL da VPS (`https://seudominio.com/api/public/whatsapp/...`).
5. Atualize a função `disparar_fila_bot()` no banco da VPS com a URL nova (ela hoje chama um endereço fixo do Lovable).
6. Preencha o `.env` da aplicação na VPS com as chaves do novo Supabase e o `SITE_URL` novo.

## Pontos de atenção
- Depois da migração, os dois bancos ficam separados — dados novos não sincronizam entre Lovable e VPS.
- O passo a passo completo já está documentado em `deploy/README.md` (seção 4).
- Recomendo fazer a exportação no dia da migração, para o backup estar o mais atualizado possível.

## O que eu faço quando a VPS estiver pronta
- Adaptar a transcrição de áudio/IA (a chave atual só funciona no ambiente Lovable) para uma chave própria.
- Ajustar a função `disparar_fila_bot()` e revisar os agendamentos no novo banco.
