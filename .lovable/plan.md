# Deploy do projeto em VPS Hostinger (npm + Nginx + script automatizado)

## Situação atual
- Repositório GitHub já conectado ao Lovable.
- O banco de dados continua no Lovable Cloud; a VPS hospeda apenas a aplicação.
- A aplicação é full-stack (SSR), então precisa de Node rodando na VPS — não basta subir arquivos estáticos.

## O que será criado no projeto
1. `deploy/setup-vps.sh` — script executado uma única vez na VPS nova: instala Node 20, npm, git, Nginx, Certbot e PM2; cria a pasta da aplicação; clona o repositório.
2. `deploy/deploy.sh` — script de atualização, executado a cada nova versão: faz `git pull`, `npm ci`, `npm run build` e reinicia o processo no PM2.
3. `deploy/nginx.conf` — modelo de configuração do Nginx com proxy reverso para a porta da aplicação, cabeçalhos corretos e suporte a HTTPS.
4. `deploy/ecosystem.config.cjs` — configuração do PM2 (nome do processo, porta, reinício automático, logs).
5. `deploy/.env.example` — lista das variáveis necessárias na VPS.
6. `deploy/README.md` — passo a passo curto, em português, do que rodar e em que ordem.

## Passo a passo que você seguirá na VPS
1. Acessar a VPS por SSH.
2. Baixar e rodar `setup-vps.sh` (instala tudo e clona o projeto).
3. Preencher o arquivo `.env` na pasta do projeto com as chaves listadas.
4. Rodar `deploy.sh` para gerar a versão de produção e subir o serviço.
5. Copiar `nginx.conf` para o Nginx, ajustar o domínio e recarregar.
6. Rodar o Certbot para o certificado HTTPS.
7. Apontar o domínio para o IP da VPS e liberar as portas 80 e 443.

## Variáveis de ambiente necessárias
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` — endereço público novo, usado nos links de currículo e orçamento
- Z-API: `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_BASE_URL`
- `LOVABLE_API_KEY` (usado pelos recursos de inteligência artificial, como transcrição de áudio)

## Pontos de atenção
- A chave de serviço do banco (`SUPABASE_SERVICE_ROLE_KEY`) não fica disponível pelo Lovable Cloud; sem ela, funções administrativas do servidor não funcionarão na VPS. Precisaremos avaliar quais recursos dependem dela.
- Os agendamentos automáticos (status do WhatsApp, inatividade) chamam endereços públicos do sistema. Após o deploy, esses endereços precisam ser atualizados para o domínio da VPS.
- `SITE_URL` deve ser definido na VPS, senão os links públicos continuarão apontando para o endereço Lovable.

## Detalhes técnicos
- Aplicação roda com `node .output/server/index.mjs` (saída do build TanStack Start/Nitro) sob PM2, na porta 3000.
- Nginx escuta em 80/443 e encaminha para 127.0.0.1:3000, preservando `Host`, `X-Forwarded-For` e `X-Forwarded-Proto`.
- O `deploy.sh` usa `npm ci` para instalação determinística e `pm2 reload` para atualização sem derrubar o serviço.
