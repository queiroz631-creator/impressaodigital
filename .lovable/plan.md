# Plano: Exportar o Storage do Lovable Cloud para a VPS

## Objetivo
Migrar todos os arquivos dos buckets do Lovable Cloud para o Supabase self-hosted na VPS, preservando nomes, pastas e permissões.

## Buckets envolvidos
- bot-midia
- database_export_09_09_26
- mensagens-rapidas
- orcamento-arquivos
- sistema
- whatsapp

Todas são privadas no Lovable Cloud e devem permanecer privadas na VPS.

## Passos

### 1. Pré-requisitos na VPS
- Supabase self-hosted já rodando (`docker compose up -d` em `/opt/supabase/supabase/docker`).
- Domínio do Storage acessível (ex.: `https://db.seudominio.com/storage/v1`).
- Chaves `ANON_KEY` e `SERVICE_ROLE_KEY` do novo Supabase geradas.

### 2. Criar os buckets na VPS
Criar, um a um, os seis buckets com os mesmos nomes e configuração **privada**.

### 3. Replicar as políticas de acesso (RLS)
Recriar, no Supabase da VPS, as mesmas políticas de `storage.objects` que existem no Lovable Cloud, garantindo que apenas usuários autenticados com permissão adequada acessem arquivos privados.

### 4. Exportar os arquivos do Lovable Cloud
Baixar todos os arquivos dos seis buckets, mantendo a estrutura de pastas (`bucket/pasta/arquivo.ext`). O método recomendado é usar um script local com a `service_role key` do Lovable Cloud para listar e fazer download em lote.

### 5. Importar os arquivos na VPS
Fazer upload dos arquivos baixados para os buckets correspondentes no Supabase da VPS, preservando caminhos e nomes.

### 6. Atualizar o `.env` da aplicação
Apontar a aplicação para o novo Supabase:
- `SUPABASE_URL`
- `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_ID`

### 7. Reimplantar e validar
Rodar `bash deploy/deploy.sh` na VPS e testar:
- Visualização de mídias do WhatsApp.
- Download de arquivos de orçamento.
- Envio/recepção de novos arquivos.
- Leitura de mensagens rápidas e imagens do bot.

## Decisões pendentes
1. Você já tem o Supabase self-hosted rodando na VPS?
2. Prefere executar a exportação/importação manualmente ou quer que eu gere um script automatizado (Python) para fazer o download/upload em lote?
3. Deseja manter os arquivos antigos no Lovable Cloud como backup ou pode remover após a migração?
