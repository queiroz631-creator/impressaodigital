# Enviar clientes do sistema para o Lojamix (inclusive cadastros novos)

## O que está acontecendo hoje

- Só uma alteração de cliente entrou na fila do sistema para a loja (o cadastro feito ontem no portal) e ela foi marcada como sincronizada.
- Mas nada mudou no Lojamix: o programa da loja só sabe **atualizar** um cliente que já existe lá (ele procura pela ligação `origem_id`). Como o cadastro nasceu no portal, não tem ligação — o programa pula em silêncio e ainda avança o marcador.
- Os 472 clientes antigos do sistema nunca entraram nessa fila (ela passou a existir depois), então também nunca foram enviados.

## Como o envio vai funcionar

Para cada cliente que o sistema manda (e para os antigos, na varredura):

```text
cliente do sistema
   |
   1. tem ligacao com a loja (origem_id)?  --sim-->  ATUALIZA no Lojamix (como hoje)
   |                                                  (nome, e-mail, telefone)
   nao
   |
   2. existe no Lojamix com o mesmo CPF?  --sim-->  VINCULA (guarda o id da loja
   |                                                 no sistema) e atualiza
   nao
   |
   3. CRIA no Lojamix: um registro de entidade (nome, telefone com DDD, e-mail)
      + o registro de pessoa fisica (CPF, data de nascimento)
      |
      4. devolve ao sistema o id criado, que fica guardado como ligacao
         permanente (marcado como alteracao vinda da LOJA, para nao gerar
         eco de volta)
```

Regras que ficam valendo:
- Só pessoa física com **CPF válido** e **telefone com 10+ dígitos** é criada na loja. Sem isso, fica de fora e aparece no relatório com o motivo.
- Nunca cria dois: antes de criar, sempre procura por CPF; e depois da criação a ligação impede repetição. Se a criação falhar, o marcador não avança e tenta no próximo ciclo.
- Nada é apagado nem sobrescrito no Lojamix além dos campos de contato do próprio cliente.
- Os textos vão em CAIXA ALTA sem acentos (regra já usada); CPF e telefone só dígitos.

## Clientes antigos (os 472)

Um passo novo de **envio pendente** no ciclo do programa: ele pede ao sistema, em blocos, os clientes que têm CPF e telefone e ainda não têm ligação com a loja, e aplica exatamente o fluxo acima (procurar por CPF → vincular ou criar). O passo tem marcador próprio, roda aos poucos (bloco configurável) e pode ser disparado na hora pelo botão "Reprocessar clientes". Nenhum cliente é enviado duas vezes.

## Segurança da gravação no Lojamix

Como é a primeira vez que o programa grava no banco da loja:
- As duas instruções de gravação (criar entidade e criar pessoa física) ficam na tela de consultas configuráveis, com um padrão pronto e comentado — você pode ajustar campos obrigatórios do seu Lojamix sem mexer no programa.
- Existe um **modo simulação** (ligado por padrão na primeira instalação): o ciclo mostra na tela quantos e quais cadastros *seriam* criados, sem gravar. Você confere e desliga a simulação para valer.
- Toda criação é registrada no log local e no resumo do último ciclo (criados, vinculados, atualizados, ignorados com motivo).

## Fora do escopo

- Nada muda nas notas fiscais, nas consultas de notas, em cupons, saldo, validação ou cancelamentos.
- Nada muda no portal público nem nas telas do site além do necessário para devolver a ligação do cliente.
- Sem dados fictícios, sem testes, sem commit, push, deploy ou publicação.

## Detalhes técnicos

Site (`src/`):
- `src/lib/sorteios-sync.server.ts`: `vincularOrigemCliente({ clienteId, origemId })` — grava `origem_id` e `origem_alteracao='LOJA'` (trigger já ignora origem LOJA, sem eco); `listarClientesSemOrigem({ desdeId, limite })` — clientes com CPF e telefone e `origem_id IS NULL`, paginado por `id` estável (ordenado por `created_at, id`).
- Novas rotas protegidas exclusivamente por `LOJAMIX_SYNC_TOKEN`: `POST /api/public/sorteios/sync/clientes-vincular` e `GET|POST /api/public/sorteios/sync/clientes-pendentes-loja`.

Programa da loja (`api-local/`):
- `app/sql_store.py`: novas chaves `cliente_por_cpf` (select), `cliente_criar_entidade` e `cliente_criar_pessoa_fisica` (write, com `OUTPUT`/`SCOPE_IDENTITY()` para devolver `id_entidade`); `WRITE_KEYS` atualizado.
- `app/repositories/clientes_repo.py`: `por_cpf(cpf)`, `criar(nome, cpf, telefone, email, nascimento) -> id_entidade` (transação única para entidade + pessoa física).
- `app/services/clientes.py`: `aplicar_alteracoes` passa a resolver ligação (origem_id → CPF → criar) e chama `sistema.vincular_origem`; novo `enviar_pendentes_para_loja()` com marcador `ultimo_id_cliente_pendente` (novo em `app/utils/estado.py`, incluído em `MARCADORES_CLIENTES`).
- `app/services/sistema.py`: rotas `CLIENTES_VINCULAR` e `CLIENTES_PENDENTES`.
- `app/settings_store.py`: `criar_cliente_no_lojamix` (bool) e `simulacao_criacao_cliente` (bool, padrão ligado), `pendentes_bloco`.
- `app/schemas/sync.py`: resumo com `criados`, `vinculados`, `simulados`, motivos de descarte.
- `app/worker.py`: novo passo de pendentes, sob o mesmo lock do fluxo de clientes.
- `gui/main.py`: opções de criação/simulação, contadores do último ciclo e as novas consultas na aba de SQL.
