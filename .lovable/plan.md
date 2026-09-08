# Deploy do projeto em VPS Hostinger (npm + Nginx + Supabase próprio na VPS)

## Situação atual
- Repositório GitHub já conectado ao Lovable.
- O banco hoje fica na nuvem do Lovable; com sua decisão, **o banco será um Supabase auto-hospedado na própria VPS**.
- A aplicação é full-stack (SSR), então precisa de Node rodando na VPS — não basta subir arquivos estáticos.

## Arquitetura na VPS
```text
Domínio (HTTPS)
   |
 Nginx (porta 80/443)
   |-- / .................. App Node (PM2, porta 3000)
   |-- /supabase/ ......... Supabase Kong/Studio (porta 8000)
   |
 Docker: Supabase self-hosted (Postgres, Auth, Storage, PostgREST, Realtime)
```

## O que será criado no projeto
1. `deploy/setup-vps.sh` — executado uma vez na VPS nova: instala Docker, Docker Compose, Node 20, npm, git, Nginx, Certbot e PM2; cria as pastas da aplicação e do Supabase.
2. `deploy/deploy.sh` — executado a cada nova versão: `git pull`, `npm ci`, `npm run build` e reinício no PM2.
3. `deploy/nginx.conf` — proxy reverso: domínio principal → app (3000); subdomínio/caminho → Supabase (8000).
4. `deploy/ecosystem.config.cjs` — configuração do PM2 (nome, porta 3000, reinício automático, logs).
5. `deploy/.env.example` — lista das variáveis da aplicação.
6. `deploy/README.md` — passo a passo em português, na ordem correta.

## Passo a passo que você seguirá na VPS
1. Acessar a VPS por SSH e rodar `setup-vps.sh` (instala tudo).
2. Instalar o Supabase self-hosted com o repositório oficial (`docker-compose` do Supabase) — o script baixa e prepara os arquivos; você revisa as senhas geradas.
3. Subir os containers do Supabase (`docker compose up -d`) e gerar as chaves (anon e service_role) do novo projeto.
4. Migrar a estrutura e os dados:
   - Exportar do projeto atual (Cloud → Configurações avançadas → Exportar dados) ou via dump.
   - Aplicar as migrações e importar os dados no Supabase da VPS.
   - Recriar os buckets de armazenamento (bot-midia, orcamento-arquivos, sistema, whatsapp) e copiar os arquivos.
   - Ativar as extensões `pg_cron` e `pg_net` (o Supabase oficial já inclui) e recriar os agendamentos do bot.
5. Preencher o `.env` da aplicação com as chaves do **novo** Supabase (URL da VPS, anon, service_role) e definir `SITE_URL` com o domínio da VPS.
6. Rodar `deploy.sh` (build + PM2), configurar o Nginx e o certificado HTTPS com Certbot.
7. Apontar o domínio para o IP da VPS e liberar portas 80 e 443.
8. Na Z-API, atualizar as URLs de webhook para o novo domínio da VPS.

## Variáveis de ambiente da aplicação
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (do Supabase da VPS — aqui você terá acesso à service_role, ao contrário da nuvem Lovable)
- `SITE_URL` — endereço público novo, usado nos links de currículo e orçamento
- Z-API: `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_BASE_URL`
- **Atenção:** `LOVABLE_API_KEY` (transcrição de áudio e interpretação do bot) funciona apenas dentro do ambiente Lovable. Fora dele, será preciso trocar por uma chave própria (ex.: Google AI/Gemini) — posso adaptar o código depois.

## Pontos de atenção
- Auto-hospedar Supabase exige manutenção: backups, atualizações e monitoramento ficam por sua conta. Recomendo VPS com pelo menos 4 GB de RAM.
- Os agendamentos do bot (inatividade, fila, status) apontam hoje para endereços Lovable e usam `pg_cron`/`pg_net`; precisarão ser recriados apontando para o domínio da VPS.
- O gatilho `disparar_fila_bot()` chama uma URL fixa do Lovable — será preciso atualizar essa função no banco da VPS.
- Os dois ambientes (Lovable e VPS) ficarão com bancos separados; dados novos não sincronizam entre eles.

## Detalhes técnicos
- App roda com `node .output/server/index.mjs` (build TanStack Start/Nitro) sob PM2, porta 3000.
- Supabase self-hosted oficial (docker-compose): Postgres na 5432 (só interna), Kong na 8000.
- Nginx: 80/443 → app; `db.seudominio.com` ou `/supabase` → Kong 8000.
- `deploy.sh` usa `npm ci` e `pm2 reload` para atualizar sem derrubar o serviço.
