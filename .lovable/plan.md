# Cancelamento de nota — devolver o troco e cancelar os cupons

## O que eu verifiquei na nota 160969

- Ela foi cadastrada às 10:35 e cancelada às 10:52 (R$ 5,00).
- Ela **nunca chegou a ser processada**: não gerou nenhum cupom e não deixou troco.
- O saldo atual do cliente (R$ 5,85) vem de outra nota, a 160877 — não da 160969.

Ou seja, nesse caso específico não havia nada para descontar: a nota foi cancelada
antes de virar cupom/troco.

## A falha real que existe hoje

Se a nota **já tiver sido processada** e depois for cancelada, o sistema hoje
cancela os cupons dela, mas **não devolve nem corrige o troco** do cliente. O
saldo fica maior do que deveria. É isso que esta etapa corrige.

## Regra a aplicar (conforme sua resposta)

Ao cancelar uma nota:

1. Os cupons gerados por aquela nota são cancelados (já acontece hoje).
2. O saldo do cliente naquele sorteio é **recalculado**: soma o valor de todas as
   notas válidas já processadas do participante e desconta o valor dos cupons que
   continuam valendo. Se o resultado der negativo, o saldo fica zero.
3. A nota cancelada deixa de contar: seus cupons e seu troco são desconsiderados
   no cálculo, e ela não volta a ser processada.
4. Tudo em uma única operação, com registro no histórico (auditoria) do que foi
   cancelado e de qual saldo passou para qual.

Notas canceladas antes de serem processadas continuam sem efeito nenhum, como a
160969.

## Depois de implementar

Rodar uma conferência dos participantes que já têm nota cancelada processada e
corrigir o saldo deles pela mesma regra, registrando na auditoria.

## Detalhes técnicos

**Banco (migração aditiva, sem tabela nova)**

- Nova função `public.sorteio_recalcular_saldo_participante(_participante_id uuid, _origem text, _usuario_id uuid)`,
  `SECURITY DEFINER`, `search_path = public`, executável apenas por `service_role`:
  - `SELECT ... FOR UPDATE` na participação (mesma serialização usada em
    `sorteio_gerar_cupons_da_nota`).
  - `total = soma(valor_centavos)` das notas do participante com
    `status = 'VALIDA' AND cupons_processado_em IS NOT NULL`.
  - `consumido = count(cupons ativos/utilizados) * sorteios.valor_por_cupom_centavos`
    (cupons `status <> 'CANCELADO'` do participante).
  - `saldo = greatest(total - consumido, 0)` → `UPDATE sorteio_participantes.saldo_centavos`.
  - `INSERT sorteio_auditoria` com evento `saldo.recalculado` e detalhe
    (`saldo_anterior_centavos`, `saldo_centavos`, `total`, `consumido`).
- Alterar `public.sorteio_propagar_cancelamento_nota()` (trigger AFTER UPDATE já
  existente em `sorteio_notas`) para, depois de cancelar os cupons da nota,
  chamar a função de recálculo do participante. A parte que já funciona
  (cancelamento dos cupons, `cancelado_em`) permanece idêntica.
- Nada muda em RLS, grants, validação, fila, cursores ou sincronização.

**Servidor**

- `src/lib/sorteios-cupons.server.ts`: expor `recalcularSaldoParticipante(participanteId, origem, usuarioId)`
  via RPC, e uma rotina `recalcularSaldosDoSorteio(sorteioId)` usada na
  conferência pontual e pelo botão do painel.
- `src/lib/sorteios.functions.ts`: incluir o recálculo no
  `processarCuponsDoSorteio` (mesma permissão `sorteios.gerenciar`), para que o
  botão "Gerar cupons pendentes" também acerte saldos divergentes.

**Tipos / telas**

- `src/modules/sorteios/types/index.ts`: novo evento de auditoria `saldo.recalculado`.
- Sem mudança visual necessária; o saldo já é exibido em Participantes e no painel.

**Testes (no banco de desenvolvimento, dados reais)**

1. Nota processada com troco → cancelar → cupons cancelados e saldo recalculado.
2. Nota cancelada antes do processamento (caso 160969) → saldo inalterado.
3. Cancelar a nota que gerou cupons já usados por troco posterior → saldo não fica negativo.
4. Cancelar duas vezes a mesma nota → nenhum efeito extra.
5. Cancelamentos simultâneos de duas notas do mesmo participante → saldo final correto.
6. Participante sem nota válida → saldo permanece zero.

## Fora do escopo

Validação de notas, elegibilidade, participação, fila, cursores, sincronização,
API local e Lojamix, demais módulos. Sem commit, envio ou publicação.
