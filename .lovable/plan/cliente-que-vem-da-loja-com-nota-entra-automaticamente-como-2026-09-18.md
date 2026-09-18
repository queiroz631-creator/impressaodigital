# Cliente que vem da loja com nota entra automaticamente como participante

## Objetivo

Quando um cliente chega da loja porque tem nota fiscal dentro do período de um sorteio ATIVO, ele deve:

1. entrar automaticamente como participante desse sorteio;
2. ter as notas dele já vinculadas como notas válidas;
3. ficar pendente apenas o aceite dos termos, feito por ele no portal público.

Hoje isso não acontece porque a base de notas do sorteio guarda número, valor e data, mas **não guarda de qual cliente a nota é**. Sem esse dado não é possível ligar as notas ao cadastro.

## Como vai funcionar

1. A loja passa a enviar, junto com cada nota, o código do cliente dono da nota (o mesmo código já usado na ligação de cadastros).
2. A base de notas do sorteio guarda esse código do cliente.
3. Sempre que um cliente da loja chega ao sistema (ou é ligado à loja), o sistema procura nas notas do sorteio ATIVO as notas daquele cliente:
   - se encontrar, cria a participação dele no sorteio (se ainda não existir);
   - vincula essas notas ao participante já como **válidas** (a nota existe na base oficial da loja, então não há o que validar);
   - notas canceladas na loja não são vinculadas; uma nota já usada por outro participante é ignorada.
4. O mesmo acontece no sentido inverso: quando notas novas chegam da loja e o cliente já está ligado, as notas são vinculadas na hora.
5. Nada de cupons, números de cupom nem saldo é gerado aqui — isso continua sendo a etapa seguinte, ainda pendente.
6. No portal público, esse cliente entra pelo CPF e a única coisa pendente é o aceite dos termos, exatamente como já funciona hoje. As notas dele já aparecem na lista.

Decisões adotadas (avise se preferir diferente):
- o participante criado automaticamente entra concorrendo ao sorteio;
- notas antigas já enviadas antes desta mudança não têm o código do cliente; elas vão ganhando esse código na varredura de revisão de notas que a loja já faz, e aí são vinculadas automaticamente.

## Detalhes técnicos

**Banco (uma migração aditiva)**
- `sorteio_notas_base`: nova coluna `cliente_origem_id text` (nula) + índice `(sorteio_id, cliente_origem_id)`. Nenhuma coluna alterada ou removida.

**Site**
- `src/routes/api/public/sorteios/sync/notas-lote.ts` e `notas-situacao.ts`: aceitar `clienteOrigemId` opcional por nota.
- `src/lib/sorteios-sync.server.ts`:
  - `receberNotasLote` grava `cliente_origem_id`; `registrarSituacaoNotas` preenche o campo quando vier (sem sobrescrever com nulo);
  - nova função `vincularNotasDoClientePorOrigem(clienteId, origemId)`: lê sorteios ATIVO → notas de `sorteio_notas_base` com aquele `cliente_origem_id` e `cancelada_em IS NULL` → garante `sorteio_participantes` (upsert por `sorteio_id, cliente_id`, `concorre_sorteio = true`, aceite de termos intocado) → insere em `sorteio_notas` (`status = 'VALIDA'`, `validado_em`, `nota_base_id`, `cupons_gerados = 0`, `saldo_gerado_centavos = 0`), ignorando conflito na unicidade `(sorteio_id, numero)`;
  - chamada em `receberClientesLote` (criado e atualizado), em `vincularOrigemCliente` e em `confirmarNotasLote` (para os clientes das notas do lote), reaproveitando `marcarParticipantesSincronizados`;
  - falha na vinculação nunca derruba o recebimento do cliente/nota: registra e segue.

**API local (loja)**
- `api-local/app/services/notas.py`: incluir `clienteOrigemId` = `id_entidade` nos dois envios (notas novas e revisão de situação). A consulta SQL já retorna `id_entidade` — nenhum SQL muda.

**Não muda:** validação manual e automática de notas, regra da marca d'água, cancelamento, cupons, saldo, cursores e marcadores, elegibilidade de clientes, criação de cliente no Lojamix, rotas existentes, RLS, portal público (fluxo de termos já existente), WhatsApp/Bot/Orçamentos/Currículos.

Sem commit, envio ou publicação.
