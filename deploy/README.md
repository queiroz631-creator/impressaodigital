# Deploy na VPS Hostinger — passo a passo

Este guia publica a aplicação e o banco de dados (Supabase) numa VPS própria.
Recomendado: VPS com **pelo menos 4 GB de RAM**, Ubuntu 22.04 ou 24.04.

> Importante: depois da mudança, o ambiente Lovable e a VPS terão bancos
> separados. Dados novos não sincronizam entre eles.

---

## 1. Preparar o domínio

No painel de DNS do seu domínio, crie dois registros tipo **A** apontando para o IP da VPS:

- `seudominio.com` (o site)
- `db.seudominio.com` (o Supabase)

## 2. Rodar o setup inicial (uma vez só)

Conecte por SSH e execute:

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git /tmp/app
sudo bash /tmp/app/deploy/setup-vps.sh https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
```

Isso instala Node 20, Docker, Nginx, Certbot e PM2, clona a aplicação em
`/var/www/impressaodigital` e baixa o Supabase em `/opt/supabase`.

## 3. Configurar e subir o Supabase (banco de dados)

1. Gere as chaves do Supabase seguindo o passo oficial:
   <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
   (você vai gerar um `JWT_SECRET`, uma `ANON_KEY` e uma `SERVICE_ROLE_KEY`).
2. Edite o arquivo de configuração:

   ```bash
   nano /opt/supabase/supabase/docker/.env
   ```

   Preencha: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
   `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` e `SITE_URL=https://db.seudominio.com`.
3. Suba os serviços:

   ```bash
   cd /opt/supabase/supabase/docker
   docker compose up -d
   ```

## 4. Migrar os dados do banco atual

1. No Lovable, abra **Cloud → Configurações avançadas → Exportar dados** para
   obter um backup do banco atual.
2. Restaure o backup no Postgres da VPS (porta 5432, usuário `postgres`,
   senha definida no passo anterior), por exemplo com `pg_restore`/`psql`.
3. Recrie os buckets de armazenamento no Studio do novo Supabase
   (`https://db.seudominio.com`): **bot-midia**, **orcamento-arquivos**,
   **sistema** e **whatsapp** (todos privados) e copie os arquivos, se houver.
4. Ative as extensões e recrie os agendamentos do bot (inatividade, fila e
   status do WhatsApp), agora apontando para o novo domínio:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```

   Os agendamentos atuais chamam endereços `*.lovable.app` — recrie-os com a
   URL nova (`https://seudominio.com/api/public/whatsapp/...`). A função
   `disparar_fila_bot()` também precisa ser atualizada com a URL nova.

## 5. Configurar a aplicação

```bash
cd /var/www/impressaodigital
cp deploy/.env.example .env
nano .env
```

Preencha com as chaves do **novo** Supabase (anon e service_role geradas no
passo 3), o `SITE_URL` e as credenciais da Z-API.

## 6. Publicar a aplicação

```bash
cd /var/www/impressaodigital
bash deploy/deploy.sh
pm2 startup   # para iniciar automaticamente ao ligar a VPS
```

## 7. Configurar o Nginx e o HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/impressaodigital
sudo nano /etc/nginx/sites-available/impressaodigital   # troque os domínios
sudo ln -s /etc/nginx/sites-available/impressaodigital /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d seudominio.com -d www.seudominio.com -d db.seudominio.com
```

## 8. Atualizar a Z-API

No painel da Z-API, atualize as URLs de webhook para o novo domínio:

- `https://seudominio.com/api/public/whatsapp/webhook?token=SEU_TOKEN`
- (e os demais endpoints: `status`, `midia`, `fila`, `inatividade`)

O token é o mesmo já configurado no sistema (Configurações → Bot).

---

## Publicando novas versões

Sempre que atualizar o código pelo Lovable (que sincroniza com o GitHub):

```bash
cd /var/www/impressaodigital && bash deploy/deploy.sh
```

## Comandos úteis

| Ação | Comando |
| --- | --- |
| Ver logs da aplicação | `pm2 logs impressaodigital` |
| Ver status | `pm2 status` |
| Reiniciar aplicação | `pm2 restart impressaodigital` |
| Logs do Supabase | `cd /opt/supabase/supabase/docker && docker compose logs -f` |
| Status do Supabase | `docker compose ps` |

## Limitações conhecidas neste momento

- A transcrição de áudio e a interpretação do bot por IA usam a chave do
  ambiente Lovable e **não funcionam na VPS** até adaptarmos o código para
  uma chave própria (ex.: Google Gemini). Avise quando quiser que eu faça
  essa adaptação.
