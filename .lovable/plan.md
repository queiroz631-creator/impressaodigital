# Permitir dois cadastros de participante com o mesmo telefone

## Objetivo

Hoje o telefone é único na base de clientes: quem tenta se cadastrar no portal com um telefone já usado por outra pessoa (CPF diferente) é recusado como "cadastro ambíguo". A mudança permite que pessoas diferentes (CPFs diferentes) compartilhem o mesmo telefone — ex.: familiares. A identidade do participante passa a ser o CPF; o telefone deixa de ser identificador único.

## Estado atual (verificado)

- `clientes.telefone_normalizado` tem restrição UNIQUE (`clientes_telefone_normalizado_key`).
- `sorteio_portal_criar_participacao` reaproveita o cliente pelo telefone; se ele já tem CPF, dispara `CADASTRO_AMBIGUO`.
- Portal (etapas de acesso/cadastro em `sorteios-publico.functions.ts`) bloqueia via `garantirCpfLivre` quando o telefone pertence a cadastro com CPF.
- A sincronização Lojamix (`sorteios-sync.server.ts`) localiza o cliente nesta ordem: `origem_id` → CPF → telefone (mais antigo). O telefone já é apenas o último recurso.
- WhatsApp, orçamentos e currículos usam o telefone como "primeiro que encontrar" — comportamento se mantém, sem alteração.

## Mudanças

### 1. Banco (uma migração)

- Remover a restrição UNIQUE de `clientes.telefone_normalizado` e recriar como índice único **parcial** somente para clientes vinculados à loja (`WHERE origem_id IS NOT NULL`): os clientes vindos da loja continuam sem telefone duplicado entre si; os cadastros feitos pelo portal podem repetir telefone.
- Reescrever `sorteio_portal_criar_participacao`:
  - Telefone já existe **sem CPF** → comportamento atual (completa o cadastro existente). Inalterado.
  - Telefone já existe **com CPF igual** ao informado → reaproveita o cliente. Inalterado.
  - Telefone já existe **com CPF diferente** → em vez de recusar, cria um cliente novo com o CPF informado. Fim do bloqueio `CADASTRO_AMBIGUO`.
  - Trava de concorrência por telefone (advisory lock) permanece.
- `sorteio_participantes` não muda: continua um participante por cliente por sorteio — cada CPF vira um participante próprio.

### 2. Portal (código)

- Ajustar o ponto que hoje chama `garantirCpfLivre` para, quando o telefone pertencer a um cadastro com CPF diferente, seguir como cadastro novo em vez de bloquear.
- Manter todas as proteções atuais: validação de CPF, conferência CPF + telefone no acesso de quem já tem cadastro, limite de tentativas, dados sempre mascarados (nada de revelar nome/telefone de terceiros).
- Auditoria do portal passa a registrar o vínculo como `telefone_compartilhado` quando um segundo cadastro usa um telefone já existente.

### 3. Sincronização Lojamix

- Nenhuma mudança de regra: a ordem de identificação já é `origem_id` → CPF → telefone. Com telefones repetidos, o último recurso continua pegando o cadastro mais antigo (comportamento atual, determinístico). Nada é alterado nas rotas, fila ou tokens.

### 4. Não alterar

- Notas, saldo, fontes, contribuições, cupons, apuração, encerramento/reabertura, WhatsApp, orçamentos, currículos, tokens e rotas da API.

## Verificação (sem bateria de testes final)

- TypeScript (`bunx tsgo --noEmit`) e build sem erros.
- Conferir no banco de desenvolvimento que dois cadastros com o mesmo telefone e CPFs diferentes passam a existir (via RPC, com dados de teste removidos em seguida).

## Pontos de atenção a validar depois

- Um telefone compartilhado significa que a confirmação "CPF + telefone" de uma pessoa pode ser conhecida por quem divide o telefone — risco inerente à decisão.
- Notas da loja cujo consumidor tem só telefone (sem CPF) continuam indo para o cadastro mais antigo com aquele telefone.
- Sem commit, push, deploy ou publicação.

## Detalhes técnicos

- Migração: `ALTER TABLE public.clientes DROP CONSTRAINT clientes_telefone_normalizado_key;` + `CREATE UNIQUE INDEX clientes_telefone_normalizado_loja_key ON public.clientes (telefone_normalizado) WHERE origem_id IS NOT NULL;` + `CREATE OR REPLACE FUNCTION public.sorteio_portal_criar_participacao(...)` (mesma assinatura e grants, service_role).
- Arquivos: nova migração em `drizzle/migrations/`; ajustes pontuais em `src/lib/sorteios-publico.functions.ts` (e, se necessário, `src/lib/sorteios-publico.server.ts`).
