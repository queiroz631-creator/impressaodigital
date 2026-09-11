# Plano: Migrar banco e arquivos para a VPS, mantendo o Lovable como desenvolvimento

## Cenário definido
- **VPS**: ambiente de produção — banco de dados completo + todos os arquivos (Storage).
- **Lovable**: ambiente de desenvolvimento — continua com o banco atual, usado para testar antes de publicar.
- Os dois ambientes ficam **separados**: dados não sincronizam entre eles.

## Parte A — Exportar o banco completo

1. **Gerar o backup do banco atual**
   No Lovable, em Cloud → Configurações avançadas → Exportar dados, obter o dump completo (estrutura + dados).

2. **Restaurar na VPS**
   Restaurar o dump no Postgres do Supabase self-hosted (`/opt/supabase/supabase/docker`), com `psql`/`pg_restore`.

3. **Recriar o que não vem no dump**
   - Extensões: `pg_cron`, `pg_net`.
   - Agendamentos do bot (inatividade, fila, status do WhatsApp) apontando para o domínio da VPS.
   - Função `disparar_fila_bot()` com a URL nova.
   - Usuários de acesso ao sistema (login), caso não venham no dump.

## Parte B — Exportar o Storage (arquivos)

Buckets a migrar, todos **privados**:
- bot-midia
- database_export_09_09_26
- mensagens-rapidas
- orcamento-arquivos
- sistema
- whatsapp

Passos:
1. Criar os seis buckets no Supabase da VPS, com os mesmos nomes e privados.
2. Recriar as regras de acesso aos arquivos, iguais às atuais.
3. Baixar todos os arquivos do Lovable Cloud mantendo a estrutura de pastas.
4. Enviar os arquivos para os buckets equivalentes na VPS, preservando os caminhos — os caminhos gravados no banco precisam continuar válidos.

## Parte C — Apontar a aplicação da VPS para o banco da VPS

No `.env` da VPS (nunca no Git):
- `SUPABASE_URL` e `VITE_SUPABASE_URL` → `https://db.seudominio.com`
- chaves anon e service_role do Supabase da VPS
- `SITE_URL` → domínio da VPS
- credenciais da Z-API

Depois: `bash deploy/deploy.sh` e atualizar as URLs de webhook na Z-API para o domínio novo.

## Parte D — Manter o Lovable como desenvolvimento

- O código continua sendo editado no Lovable e sincronizado com o GitHub.
- Para publicar: `git pull` + `bash deploy/deploy.sh` na VPS.
- O banco do Lovable passa a ser **de teste**: mudanças de estrutura feitas aqui precisam ser aplicadas também no banco da VPS, na mesma ordem.
- Recomendo usar dados fictícios no ambiente Lovable a partir de agora, para não misturar com dados reais de clientes.

## Validação final
- Login funcionando na VPS.
- WhatsApp recebendo e enviando mensagens (webhook novo).
- Mídias antigas abrindo e baixando normalmente.
- Orçamentos, currículos e links públicos abrindo com o domínio novo.
- Bot respondendo (inatividade e fila disparando).

## Pontos de atenção
- Transcrição de áudio e interpretação por IA usam a chave do ambiente Lovable e **não funcionam na VPS** até trocarmos por uma chave própria (ex.: Google Gemini). Posso adaptar quando quiser.
- Backups do banco e dos arquivos passam a ser sua responsabilidade na VPS.
- Recomendo VPS com pelo menos 4 GB de RAM.

## Decisões pendentes
1. O Supabase self-hosted já está rodando na VPS?
2. Quer que eu gere um script automatizado para baixar e reenviar os arquivos dos buckets em lote?
3. Depois da migração, os arquivos antigos no Lovable devem ser mantidos como backup?
