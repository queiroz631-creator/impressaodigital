# Nota 160976 — por que o saldo não mudou

## O que eu encontrei no banco

- Nota 160976, R$ 9,00, cliente com saldo de R$ 5,85.
- Ela entrou às 14:56 já marcada como **válida**, vinda da loja junto com a
  ligação automática do cliente.
- Porém ela **nunca foi processada**: 0 cupons, 0 de troco e sem marca de
  processamento. Por isso o saldo continua R$ 5,85 em vez de R$ 14,85.

## A causa

Existe um caminho de entrada de notas que grava a nota como válida **direto**,
sem passar pela conferência normal — é o vínculo automático do cliente da loja
com o sorteio ativo. Todos os outros caminhos (portal, painel, rotina de
conferência) chamam o cálculo de saldo/cupons ao aprovar a nota; esse não.

Resultado: a nota fica válida e parada, esperando alguém clicar em
"Gerar cupons pendentes" no painel. Hoje há exatamente 1 nota nessa situação —
a 160976.

Além disso, a rotina automática que varre notas válidas paradas não está sendo
chamada pelo agendamento atual, então esse tipo de nota pode ficar parada
indefinidamente.

## O que vou fazer

1. No vínculo automático de cliente da loja: depois de criar a nota já válida,
   calcular saldo e cupons dela na mesma hora, com a regra que já existe e já
   foi testada. Falha nesse cálculo não desfaz a nota — ela só fica pendente
   para a próxima varredura.
2. Fazer a rodada de conferência de 15 minutos também varrer as notas válidas
   que ficaram sem processamento, de modo que nenhuma fique parada mesmo se
   algo falhar.
3. Processar agora a nota 160976: o cliente passa de R$ 5,85 para R$ 14,85
   (nenhum cupom novo, pois falta chegar a R$ 20,00).

Nada muda na regra de cupons, no valor por cupom, na validação, no cancelamento,
na sincronização com a loja ou no programa instalado na loja.

## Detalhes técnicos

- `src/lib/sorteios-sync.server.ts`, em `vincularParticipacaoPorOrigemLoja`:
  após o `insert` bem-sucedido em `sorteio_notas` com `status: 'VALIDA'`,
  recuperar o id da nota inserida (`.select('id').single()`) e chamar
  `gerarCuponsDaNota(id, 'rotina', null)` via import dinâmico de
  `@/lib/sorteios-cupons.server`, dentro de `try/catch` (o bloco externo já
  ignora falhas de conveniência). Notas duplicadas continuam ignoradas.
- `src/lib/sorteios-sync.server.ts`, na rotina de reconciliação (por volta da
  linha 749, onde já roda `validarNotasPendentesDoSorteio`): chamar em seguida
  `processarCuponsPendentes(sorteioId, 200, 'rotina', null)`, também em
  `try/catch`, para cobrir qualquer nota válida ainda não processada.
- Nenhuma migração, nenhuma alteração de função do banco, de trigger, de RLS ou
  de grants. A idempotência continua garantida por `cupons_processado_em`.
- Processamento da 160976 pela função já existente
  `sorteio_gerar_cupons_da_nota`, com conferência do saldo antes e depois.

## Fora do escopo

Regra de geração de cupons, valor por cupom, validação, cancelamento, fila,
cursores, API local, banco da loja e demais módulos. Sem commit, envio ou
publicação.
