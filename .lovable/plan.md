# Correção do registro de lotes de sincronização

## O problema

O registro de execuções de sincronização só aceita dois tipos: `CLIENTES` e `NOTAS`. O código da sincronização com a loja está gravando nomes compostos (`NOTAS_LOJA_SUPABASE`, `CLIENTES_LOJA_SUPABASE`, `RECONCILIACAO`), e o banco recusa a gravação. É por isso que o envio das 83 notas falha depois da leitura — a consulta ao banco da loja está correta.

Verificado: o registro de execuções está vazio (nenhum lote parcial ou inconsistente ficou gravado das tentativas anteriores). Nada precisa ser corrigido nos dados; nenhum registro será apagado.

## O que será corrigido

Somente o arquivo que grava os lotes de sincronização (`src/lib/sorteios-sync.server.ts`):

- Notas (envio do lote, confirmação, revisão de situação/cancelamento e reconciliação) passam a gravar `tipo = 'NOTAS'`.
- Clientes (recebimento da loja e alterações enviadas para a loja) passam a gravar `tipo = 'CLIENTES'`.
- O detalhe da operação continua identificável pelos campos já existentes: origem, destino, identificador da operação, identificador do lote e sorteio.

Nenhum endereço de rota muda, e o Lojamix Sync continua enviando o lote exatamente como hoje — o tipo é definido pelo próprio sistema.

## Detalhes técnicos

1. `abrirLote` passa a receber `tipo: "NOTAS" | "CLIENTES"` (tipagem restrita, para o erro não voltar).
2. Chamadas atualizadas: `receberNotasLote` e `registrarSituacaoNotas` → `NOTAS`; `receberClientesLote` → `CLIENTES`.
3. Como `sorteio_sincronizacoes` não possui coluna `operacao`, a distinção fina (`ENVIAR`, `ATUALIZAR_SITUACAO`) fica no `operacao_id` com prefixo da operação (ex.: `ENVIAR:<lote_id>`, `ATUALIZAR_SITUACAO:<lote_id>`), mantendo `lote_id` intacto — a busca do lote em `confirmarNotasLote`/`fecharLote` continua por `lote_id`, então a idempotência e o retry não mudam.
4. O `INSERT` final de `reconciliar()` passa de `tipo: 'RECONCILIACAO'` para `tipo: 'NOTAS'` (é validação de notas), mantendo `direcao`, `origem`, `destino` e as contagens.
5. A fila (`sorteio_sincronizacao_fila`) **não** tem essa restrição e não será alterada: os tipos de evento (`NOTAS_LOJA_SUPABASE`, `CLIENTES_SUPABASE_LOJA`) continuam como estão, preservando o trigger de clientes e o cursor.
6. Nenhuma migration, nenhuma alteração de constraint, nenhum DROP, nenhuma alteração em notas, base de notas, cupons, clientes, cursor ou regras de validação.
7. Ao final, uma varredura no código confirma que nenhum ponto grava `tipo` diferente de `NOTAS`/`CLIENTES` em `sorteio_sincronizacoes`, mais verificação de tipos e build.
