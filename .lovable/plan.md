# Cancelamento de nota — devolver o troco e cancelar os cupons

## O que eu verifiquei na nota 160969

- Cadastrada às 10:35 e cancelada às 10:52 (R$ 5,00).
- Ela **nunca chegou a ser processada**: não gerou cupom e não deixou troco.
- O saldo do cliente (R$ 5,85) vem da nota 160877 — não da 160969.

Nesse caso não havia nada a descontar.

## A falha real que existe hoje

Se a nota **já tiver sido processada** e depois for cancelada, o sistema cancela
os cupons dela mas **não corrige o troco** do cliente: o saldo fica maior do que
deveria. É isso que esta etapa corrige.

## Conferência feita antes de definir a fórmula (sem alterar nada)

Como o saldo é preenchido hoje: só na geração de cupons — a cada nota válida
processada, `saldo + valor da nota` vira cupons e o resto é gravado em
`saldo_centavos` da participação e em `saldo_gerado_centavos` da nota.
`cupons_gerados` é a quantidade de cupons daquela nota. Nenhum outro ponto do
sistema mexe nesses campos.

Fórmula testada em todos os 9 participantes reais:

`saldo = maior(0, soma das notas VÁLIDAS já processadas − soma do valor dos cupons que não estão cancelados)`

| Participante | Saldo atual | Notas consideradas | Cupons (ativos/cancel./utiliz.) | Consumido | Calculado | Diferença |
|---|---|---|---|---|---|---|
| 3a35dd9d | R$ 5,85 | R$ 225,85 | 11 / 0 / 0 | R$ 220,00 | R$ 5,85 | 0 |
| 5ad01b24 | R$ 3,00 | R$ 63,00 | 3 / 0 / 0 | R$ 60,00 | R$ 3,00 | 0 |
| outros 7 | R$ 0,00 | R$ 0,00 | 0 / 0 / 0 | R$ 0,00 | R$ 0,00 | 0 |

Diferença zero em todos. Observação honesta: hoje não existe nenhum cupom
cancelado nem utilizado no banco, então essas duas situações só podem ser
comprovadas nos testes criados para isso (itens 1, 3 e 5 abaixo) — antes da
correção em massa.

O valor consumido usa o valor gravado em cada cupom (`valor_base_centavos`), e
não o valor atual do sorteio, para que uma mudança futura no valor por cupom não
desfaça o histórico.

## Saldo acumulado antes de formar um cupom — já funciona

Confirmado na implementação atual: uma nota válida que não chega ao valor de um
cupom **já é processada e já aumenta o saldo** (gera 0 cupons, grava o saldo novo
e marca a nota como processada). O acúmulo entre notas também já funciona:
`novo saldo = saldo anterior + valor da nota − (cupons × valor por cupom)`.
As telas já leem o saldo de `sorteio_participantes.saldo_centavos` — a lista de
Participantes mostra Cliente, CPF, Saldo, Notas e Cupons, e o indicador "Saldo
acumulado" do painel soma os saldos dos participantes daquele sorteio.

Portanto **nada da geração de cupons será alterado** e nenhum campo ou tabela de
saldo será criado. Desta parte só entra na etapa a conferência dos casos de 0
cupom nos testes e a garantia de que o recálculo do cancelamento usa a mesma
fonte de saldo.

## Regra a aplicar

Ao cancelar uma nota:

1. Os cupons gerados por aquela nota são cancelados (já acontece hoje).
2. O saldo do cliente naquele sorteio é recalculado pela fórmula acima.
3. A nota cancelada deixa de contar e não volta a ser processada.
4. Tudo em uma única operação, com registro no histórico: saldo anterior, total
   das notas, cupons considerados, valor consumido e saldo novo.

## Correção dos saldos já existentes

Nada será atualizado em massa sem sua confirmação. Antes disso eu apresento a
mesma tabela acima (saldo atual, total, cupons, consumido, calculado, diferença)
já com os testes realizados; só depois, e só nos participantes com diferença, o
saldo é gravado — com registro na auditoria.

## Detalhes técnicos

**Banco (migração aditiva, sem tabela nova)**

- Nova função `public.sorteio_recalcular_saldo_participante(_participante_id uuid, _origem text, _usuario_id uuid)`,
  `SECURITY DEFINER`, `search_path = public`, `EXECUTE` apenas para `service_role`:
  - `SELECT ... FOR UPDATE` na participação (mesma serialização de
    `sorteio_gerar_cupons_da_nota`).
  - `total = sum(valor_centavos)` de `sorteio_notas` do participante com
    `status='VALIDA' AND cupons_processado_em IS NOT NULL`.
  - `consumido = sum(valor_base_centavos)` de `sorteio_cupons` do participante
    com `status <> 'CANCELADO'`.
  - `saldo = greatest(total - consumido, 0)`; grava só se mudou.
  - `INSERT sorteio_auditoria` evento `saldo.recalculado` com
    `saldo_anterior_centavos`, `saldo_centavos`, `total_notas_centavos`,
    `consumido_centavos`, `cupons_considerados`.
  - Retorna `jsonb` com esses mesmos números (permite conferir sem gravar nada
    mais).
- `public.sorteio_propagar_cancelamento_nota()` (trigger AFTER UPDATE já
  existente): após cancelar os cupons da nota, chamar o recálculo do
  participante. O comportamento atual (cancelar cupons, `cancelado_em`) fica
  idêntico.
- Nada muda em RLS, grants de tabela, validação, fila, cursores ou sincronização.

**Servidor**

- `src/lib/sorteios-cupons.server.ts`: `recalcularSaldoParticipante(...)` via RPC
  e `recalcularSaldosDoSorteio(sorteioId)`.
- `src/lib/sorteios.functions.ts`: `processarCuponsDoSorteio` (permissão
  `sorteios.gerenciar`) passa a recalcular os saldos ao final.

**Tipos**

- `src/modules/sorteios/types/index.ts`: evento `saldo.recalculado`.
- Sem mudança visual; o saldo já aparece em Participantes e no painel.

**Testes (banco de desenvolvimento, dados reais)**

1. Nota processada com troco → cancelar → cupons da nota cancelados e saldo recalculado.
2. Nota cancelada antes do processamento (caso 160969) → saldo inalterado.
3. Nota cujos cupons foram consumidos por troco posterior → saldo nunca negativo.
4. Cancelar duas vezes a mesma nota → nenhum efeito extra.
5. Cupom marcado como utilizado → continua contando como consumido.
6. Cancelamentos simultâneos de duas notas do mesmo participante → saldo final correto.
7. Participante sem nota válida → saldo permanece zero e 0 cupons.
8. Nota de R$ 5,00 → 0 cupons e saldo R$ 5,00; segunda de R$ 5,00 → R$ 10,00;
   terceira de R$ 15,00 → 1 cupom e R$ 5,00 de saldo.
9. Reprocessar qualquer uma dessas notas → nenhum saldo ou cupom duplicado.
10. Cancelar uma nota que só gerou saldo → saldo recalculado corretamente.
11. Duas notas simultâneas do mesmo participante → saldo final correto.

## Fora do escopo

Validação de notas, elegibilidade, participação, fila, cursores, sincronização,
API local e Lojamix, demais módulos. Sem commit, envio ou publicação.
