# Nome de cliente/participante sempre em CAIXA ALTA, sem acentos

Padronizar o nome de toda pessoa cadastrada: CAIXA ALTA e sem acentos (JOÃO DA SILVA -> JOAO DA SILVA), igual ao padrão usado pela loja. Vale para cadastros novos, alterações e também para os nomes que já estão na base.

## O que muda

1. **Cadastro pelo portal do sorteio** — quando a pessoa informa o nome (cadastro novo ou completar cadastro), o nome é gravado em caixa alta sem acentos.
2. **Cadastro de clientes pela tela interna** — ao salvar um cliente novo ou editar um existente, o nome é gravado no mesmo padrão.
3. **Nomes vindos da loja (Lojamix)** — a sincronização já recebe nomes em caixa alta; o mesmo tratamento é aplicado na gravação como garantia, sem alterar nada da integração, fila ou reconciliação.
4. **Nomes já cadastrados** — uma conversão única atualiza todos os nomes existentes de clientes para o novo padrão.

O que a pessoa digita continua livre na tela (pode digitar minúsculo); a padronização acontece na gravação. A validação atual de "nome e sobrenome" continua igual.

## O que não muda

Telefone, CPF, e-mail, data de nascimento, notas, cupons, saldo, apuração, encerramento e a regra de telefone único.

## Detalhes técnicos

- Nova função utilitária compartilhada (client-safe), `normalizarNomePessoa`: remove acentos via `NFKD`, aplica `toUpperCase()`, remove caracteres fora de `A-Z 0-9` e espaço, colapsa espaços e faz `trim` — mesmo comportamento do `texto()` em `api-local/app/utils/normalizacao.py`.
- Aplicar em:
  - `src/lib/sorteios-publico.functions.ts`: nos três pontos que montam `atualizacao.nome` / `_nome` (cadastro novo via `sorteio_portal_criar_participacao` e complementos de cadastro), antes da validação de nome completo.
  - `src/routes/clientes.tsx`: no payload de insert/update do formulário (`nome: form.nome.trim()`).
  - `src/lib/sorteios-sync.server.ts`: nos pontos que gravam `nome: c.nome` para clientes.
- Backfill único via `supabase--run_sql`: `UPDATE public.clientes SET nome = ...` usando `upper(translate(nome, acentuados, sem_acento))` com limpeza de caracteres especiais e espaços duplicados, somente nas linhas cujo nome difere do valor normalizado. Sem migração de schema.
