# Corrigir "Bucket not found" ao usar a logo do portal

## O que está acontecendo

A pasta de arquivos onde a logo do portal é guardada (`portal-sorteios`) existe aqui no sistema do Lovable, mas **não existe no servidor da loja**. Ela foi criada por uma ferramenta do Lovable, e essa criação não entrou nos arquivos que o deploy aplica na VPS. Por isso a tela de Sorteios no servidor da loja mostra o aviso "Bucket not found" ao carregar/enviar a logo.

Confirmado: a pasta `portal-sorteios` (privada, 2 MB) existe no banco do Lovable; a migração `20260923050000_sorteio_logo_portal.sql` cria a coluna e as regras de permissão, mas não cria a pasta.

## O que vai ser feito

1. **Criar a pasta no servidor da loja pelo deploy**: nova migração datada em `supabase/migrations/` que insere a pasta `portal-sorteios` (privada, limite 2 MB) se ela ainda não existir, e completa as regras de troca/remoção de arquivos (UPDATE e DELETE) que hoje faltam. Segura para rodar mais de uma vez; nada existente é apagado.
2. **Manter as ferramentas de conferência coerentes**: incluir `portal-sorteios` nas listas de `deploy/corrigir-storage.sql` e `deploy/verificar-storage.sh`, para que as checagens do servidor passem a cobrar essa pasta também.
3. **Mensagem em português na tela**: quando a pasta não existir ou o envio falhar por falta dela, a tela de Sorteios passa a mostrar "O armazenamento da logo ainda não está preparado neste servidor. Rode a atualização do sistema." em vez do texto técnico em inglês. A exibição da logo continua caindo para a logo padrão sem erro visível no portal do participante.

## Detalhes técnicos

- Nova migração `supabase/migrations/20260923060000_portal_sorteios_bucket.sql`:
  - `INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('portal-sorteios','portal-sorteios',false,2097152) ON CONFLICT (id) DO NOTHING;`
  - blocos `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_policies ...)` criando `portal_sorteios_atualiza_gestao` (UPDATE) e `portal_sorteios_exclui_gestao` (DELETE) com a mesma condição de gestão (`has_role admin` OU `tem_permissao 'sorteios.gerenciar'`), e também as duas políticas já existentes de forma idempotente, para servidores que ainda não as tenham.
  - No banco do Lovable a pasta já existe, então a migração não muda nada aqui.
- `src/lib/sorteio-logo.functions.ts`: traduzir erros de storage que contenham "Bucket not found" para a mensagem em português; `logoPortalPublica` segue devolvendo `url: null` em qualquer falha.
- Sem alterações no visual do portal nem na lógica de sorteios.
- Para valer no servidor da loja: `git pull` + `bash deploy/deploy.sh` (a migração nova é aplicada pelo deploy).
