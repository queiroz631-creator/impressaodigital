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
4. Ative as extensões usadas pelas rotinas automáticas do bot:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```

   Os agendamentos (fila, inatividade e status do WhatsApp) vêm no backup e já
   leem o endereço configurado no sistema. Depois de subir a aplicação, abra
   **Configurações → WhatsApp** e preencha **Endereço do sistema** com o
   domínio da VPS (ex.: `https://seudominio.com`). Sem isso, o bot continua
   avisando o endereço antigo e não responde.


## 5. Configurar a aplicação

O arquivo `deploy/.env.example` fica versionado como modelo. O `.env` real
é ignorado pelo Git (`# Variáveis de ambiente` no `.gitignore`) e deve ser
criado apenas na VPS:

```bash
cd /var/www/impressaodigital
cp deploy/.env.example .env
nano .env
```

> **Atenção:** nunca commitar `deploy/.env`, `.env.production` ou qualquer
> arquivo que contenha senhas, chaves de API ou tokens reais.

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

## Migrar o Storage (arquivos) para a VPS

Os arquivos dos buckets **não** vêm no backup do banco de dados. Use o script abaixo para copiá-los do Lovable Cloud para o Supabase da VPS, preservando nomes e pastas.

> Importante: nada é apagado na origem. Os arquivos antigos permanecem no Lovable como backup.

### Opção A (recomendada): subir a partir do backup baixado do Lovable

A chave `service_role` do Lovable Cloud não é acessível, portanto a cópia direta de servidor a servidor não funciona nesse caso. Use o backup gerado no chat (um `.zip` por bucket + `storage-backup-relatorio.txt`):

```bash
# na VPS
mkdir -p /root/storage-backup && cd /root/storage-backup
# envie os .zip para esta pasta (scp/sftp) e descompacte:
unzip -o '*.zip' -d /root/storage-backup

cd /var/www/impressaodigital
export LOCAL_DIR=/root/storage-backup
# Opcional: export DEST_SERVICE_ROLE_KEY=<chave-da-vps>
bash deploy/migrar-storage.sh
```

A pasta precisa conter uma subpasta por bucket (`whatsapp/`, `orcamento-arquivos/`, etc.), exatamente como os zips descompactam.

### Opção B: copiar direto de outro Supabase

```bash
cd /var/www/impressaodigital

export SOURCE_SERVICE_ROLE_KEY=<chave-service-role-da-origem>
# Opcional: export DEST_SERVICE_ROLE_KEY=<chave-da-vps>
# (se não informada, o script lê de /root/supabase-project/.env)

bash deploy/migrar-storage.sh
```

### Pré-requisitos
- Supabase self-hosted já rodando na VPS.
- Banco de dados já restaurado (ex.: `impressaodigital_260909`).

O script cria os buckets que não existem no destino (sempre privados) e envia cada arquivo mantendo o caminho original. Arquivos que já existem no destino com o **mesmo tamanho** são pulados, então o comando pode ser executado várias vezes. Se o arquivo existe no destino mas o tamanho diverge da origem (ou está zerado), ele é **reenviado por completo**, sobrescrevendo a versão incompleta — o resumo final mostra esses casos em "Reenviados (tamanho diferente)".

### Configuração opcional

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `LOCAL_DIR` | — | Pasta do backup descompactado (ativa a Opção A). |
| `SOURCE_URL` | `https://qmnienngwksbeiyczrka.supabase.co` | URL do Supabase de origem. |
| `SOURCE_SERVICE_ROLE_KEY` | — | Chave de serviço da origem (obrigatória na Opção B). |
| `DEST_URL` | `https://supabase.queiroztecno.com.br` | URL do Supabase de destino (VPS). |
| `DEST_SERVICE_ROLE_KEY` | lida do `.env` do Supabase | Chave de serviço do destino. |
| `BUCKETS` | todos os buckets do projeto | Lista separada por espaço dos buckets a migrar. |
| `LOG_FILE` | `/root/migrar-storage.log` | Arquivo com falhas para reprocessamento. |

### Reprocessar falhas

Se aparecerem falhas no resumo final, corrija a causa (geralmente permissão ou rede) e rode o mesmo comando novamente. Arquivos já copiados com sucesso serão pulados automaticamente.

### Validação

Após a migração, teste:
- Abrir uma conversa antiga no WhatsApp e visualizar imagens.
- Baixar um arquivo anexo a um orçamento antigo.
- Visualizar a foto de um currículo antigo.
- Enviar um arquivo novo pelo WhatsApp e confirmar que ele aparece no Storage da VPS.

---

## Publicando novas versões (código + banco)

O fluxo completo é:

```text
Alterou o banco no Lovable
        ↓
Lovable cria a migração em supabase/migrations/
        ↓
Migração sincronizada com o GitHub
        ↓
Na VPS:  cd /var/www/impressaodigital && bash deploy/deploy.sh
        ↓
O banco é atualizado automaticamente ANTES do build
```

O `deploy.sh` executa, nesta ordem: `git pull` → aplicar migrações → instalar
dependências → build → `pm2 reload` → `pm2 save`. Se alguma migração falhar, o
deploy para ali: **não faz build e não reinicia a aplicação**, para nunca colocar
código novo em cima de um banco incompatível.

Nenhuma alteração local da VPS é apagada — o deploy não usa `git reset`,
`git clean`, `git checkout .` nem `git restore`.

### Como funciona o baseline

O banco da VPS veio de um backup completo, então as migrações antigas já estão
lá. O arquivo **`deploy/migrations-baseline.txt`** informa até qual migração o
banco já está atualizado. Na primeira execução (tabela de controle vazia), tudo
até esse nome é apenas **registrado** como aplicado, sem executar SQL. Só o que
vier depois é executado.

Baseline atual:

```text
20260912044341_909d866e-0aa4-4020-9090-112fd05a21c6.sql
```

(backup `impressaodigital_260909` + as duas migrações de 12/09 já aplicadas à mão
pelo `deploy/vps-bot-endereco.sql`). Para mudar, edite o arquivo com o nome exato
de um arquivo existente em `supabase/migrations/`. Se o baseline estiver ausente
ou com um nome inválido, o script aborta com mensagem clara em vez de adivinhar.

### Verificar migrações aplicadas e pendentes

Aplicadas (registradas no banco):

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  -c "SELECT * FROM public._migracoes_aplicadas ORDER BY aplicado_em;"
```

Pendentes (não altera nada no banco):

```bash
cd /var/www/impressaodigital
bash deploy/aplicar-migracoes.sh --pendentes
```

### Quando uma migração falhar

O script mostra `[ERRO] Migration: <nome>` junto com a mensagem do PostgreSQL, e
**não** registra a migração como aplicada. Corrija a causa (geralmente uma
extensão ausente ou um objeto que já existe no banco) e rode o deploy de novo —
as migrações já aplicadas são puladas automaticamente.

Se uma migração depender de `pg_net` ou `pg_cron` e a extensão não estiver
instalada, o script interrompe antes de aplicar. Instale e repita:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Rodar somente as migrações, sem deploy:

```bash
cd /var/www/impressaodigital && bash deploy/aplicar-migracoes.sh
```

## Comandos úteis

| Ação | Comando |
| --- | --- |
| Ver logs da aplicação | `pm2 logs impressaodigital` |
| Ver status | `pm2 status` |
| Reiniciar aplicação | `pm2 restart impressaodigital` |
| Logs do Supabase | `cd /opt/supabase/supabase/docker && docker compose logs -f` |
| Status do Supabase | `docker compose ps` |

## Inteligência artificial na VPS (GEMINI_API_KEY)

A importação de currículo, a transcrição de áudio do WhatsApp e a
interpretação das respostas do bot usam IA. O sistema escolhe o provedor
automaticamente:

- **`GEMINI_API_KEY` definida no `.env`** → usa a API oficial do Google
  Gemini (modelo gemini-3.6-flash). É o modo da VPS.
- **Sem `GEMINI_API_KEY`** → usa o gateway do Lovable (só funciona dentro
  do ambiente Lovable).

### Como configurar

1. Acesse https://aistudio.google.com e clique em **Get API key** para gerar
   uma chave gratuita do Gemini (o plano gratuito atende folgadamente o
   volume de uma gráfica).
2. No `.env` da aplicação na VPS, adicione:

   ```bash
   GEMINI_API_KEY=<sua-chave>
   ```

3. Reinicie a aplicação: `pm2 restart impressaodigital`
   (as variáveis só são lidas na inicialização).
4. Teste: importe um currículo em PDF e confira que os campos são
   preenchidos; peça a transcrição de um áudio no WhatsApp.

**Importante:** a chave fica somente no servidor — nunca no código do
navegador. Não commite o `.env`.

## Endereço do sistema (bot do WhatsApp)

O banco restaurado na VPS pode não ter o campo usado pelo bot para saber o
endereço público do site. Se ao salvar em **Configurações → WhatsApp** aparecer
"Não foi possível salvar o endereço do sistema", rode uma vez no banco da VPS:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < deploy/vps-bot-endereco.sql
```

Depois abra **Configurações → WhatsApp**, clique em **Usar este endereço** e salve.
