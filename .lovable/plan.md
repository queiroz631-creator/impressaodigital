# Etapa — Saldo e geração de cupons

Transformar as notas já validadas em saldo de participação e cupons, sem tocar em
nada do que já funciona (notas, validação, cancelamento, participação, fila,
cursores, sincronização, API da loja).

## O que já existe e será reutilizado

Nada precisa ser recriado — a base já foi preparada nas etapas anteriores:

- **Participação**: guarda o saldo do cliente naquele sorteio (`saldo_centavos`),
  uma participação por cliente/sorteio.
- **Notas**: já guardam quantos cupons geraram e quanto de saldo sobrou.
- **Cupons**: tabela pronta com cliente (pela participação), sorteio, nota de
  origem, número único por sorteio, valor base, data de geração e situação
  (Ativo / Cancelado / Utilizado).
- **Regra de cálculo**: já escrita no projeto (cada múltiplo do valor por cupom
  gera um cupom, o resto fica como saldo).
- **Cancelamento**: quando uma nota é cancelada, o próprio banco já cancela os
  cupons dela. Nada disso muda.
- **Telas**: painel do sorteio, participantes, notas e cupons já existem.

Portanto **nenhuma tabela nova de saldo e nenhuma tabela nova de cupom** será
criada.

## O que falta (o que esta etapa faz)

1. **Marca de "já processado" na nota** — único campo novo no banco. É o que
   garante que rodar o processo duas vezes não gera cupom de novo, inclusive
   quando a nota gerou 0 cupons e só virou saldo.
2. **Rotina de geração** no servidor, em uma única operação atômica por nota:
   confere a nota (precisa estar Válida, do sorteio Ativo e ainda não
   processada), soma o saldo da participação ao valor da nota, calcula quantos
   cupons saem, cria os cupons, grava o novo saldo, marca a nota como processada
   e registra na auditoria. Qualquer erro no meio desfaz tudo — nunca sobra
   cupom sem saldo nem saldo sem cupom.
3. **Números de cupom**: prefixo do número do sorteio + 6 dígitos sorteados
   (ex.: `01-402917`), únicos dentro do sorteio. Em caso de coincidência o
   próprio banco recusa e a rotina sorteia outro — dois processos simultâneos
   nunca recebem o mesmo número.
4. **Quando roda**: automaticamente assim que uma nota é validada (pela rotina
   de 15 minutos, pelo portal e pelo painel) e também por um botão
   "Gerar cupons pendentes" no painel do sorteio, que varre tudo que ficou para
   trás.
5. **Limite de cupons do sorteio**: se o sorteio tiver limite, ele é respeitado;
   o que passar do limite fica como saldo.
6. **Telas**: consulta administrativa de cupons com busca, saldo e cupons por
   participante, e indicadores do painel vindos do banco.

O saldo continua sendo acumulativo: o troco de uma nota se soma ao da nota
seguinte do mesmo participante até formar um cupom, como você confirmou.

## Interface

**Cupons do sorteio** (tela que já existe, ampliada):
busca por nome do cliente, CPF, número do cupom ou número da nota; filtro por
situação; colunas cliente, CPF, nota de origem, valor base, situação, data de
geração. Cada linha mostra a origem do cupom, então dá para chegar de
Cupom → Nota → Participação → Cliente → Sorteio.

**Painel do sorteio**: botão "Gerar cupons pendentes" (com o resumo do que foi
processado) e indicadores: participantes, notas válidas, saldo acumulado,
cupons gerados, ativos, cancelados e utilizados — todos contados no banco.

**Participantes**: colunas de saldo e de quantidade de cupons.

## Detalhes técnicos

**Migração (única, aditiva)**
- `sorteio_notas.cupons_processado_em timestamptz NULL` + índice parcial para
  localizar rapidamente as notas válidas ainda não processadas
  (`(sorteio_id) WHERE status='VALIDA' AND cupons_processado_em IS NULL`).
- Índices novos: `sorteio_cupons (sorteio_id, status)` e
  `sorteio_cupons (numero)` para a consulta administrativa.
- Função `public.sorteio_gerar_cupons_da_nota(_nota_id uuid)` — `SECURITY
  DEFINER`, `search_path = public`, uma transação:
  `SELECT ... FOR UPDATE` na participação (serializa o saldo por participante) →
  relê a nota e o sorteio → sai se a nota não estiver `VALIDA`, se
  `cupons_processado_em` não for nulo ou se o sorteio não estiver `ATIVO` →
  calcula `cupons = (saldo + valor) / valor_por_cupom_centavos`, respeitando
  `quantidade_maxima_cupons` → `INSERT` dos cupons em laço com número sorteado e
  reaproveitamento do índice único `sorteio_cupons_numero_unico` (até 10
  tentativas por número) → `UPDATE sorteio_notas` (`cupons_gerados`,
  `saldo_gerado_centavos`, `cupons_processado_em`) →
  `UPDATE sorteio_participantes.saldo_centavos` → `INSERT sorteio_auditoria`
  (`cupons.gerados`) → retorna json com cupons criados e saldo final.
  A unicidade `(sorteio_id, numero)` já existe; a idempotência fica no banco
  (`cupons_processado_em IS NULL` dentro da transação com a linha travada).
- Grants/RLS: nada muda nas tabelas; a função é chamada apenas pelo servidor.

**Servidor**
- Novo `src/lib/sorteios-cupons.server.ts`: `gerarCuponsDaNota(notaId, origem)`
  (chama a função do banco via `rpc`) e
  `processarCuponsPendentes(sorteioId, limite)` (varre notas válidas não
  processadas em ordem de cadastro).
- `src/lib/sorteios-validacao.server.ts`: após gravar `VALIDA`, chamar
  `gerarCuponsDaNota` com import dinâmico; falha na geração **não** desfaz a
  validação (a nota fica válida e não processada, a próxima rodada tenta de
  novo). A regra de validação em si não muda.
- `src/lib/sorteios.functions.ts`: server function `processarCuponsDoSorteio`
  protegida por `sorteios.gerenciar`, recebendo só o id do sorteio — a
  quantidade de cupons nunca vem do frontend.
- `src/routes/api/public/sorteios/validar-notas.ts`: depois da rodada de
  validação, processar os pendentes de cupons (mesmo token interno, sem rota
  nova).

**Frontend**
- `src/routes/sorteios.$id.cupons.tsx`: busca e colunas novas.
- `src/routes/sorteios.$id.index.tsx`: indicadores e botão.
- `src/routes/sorteios.$id.participantes.tsx`: saldo e cupons.
- `src/modules/sorteios/hooks/useSorteios.ts`: consultas de indicadores, cupons
  com cliente/CPF/nota e mutation do botão.
- `src/modules/sorteios/types/index.ts`: campo novo da nota.

**Testes** (no banco de desenvolvimento, sobre os dados reais existentes, sem
criar cadastro fictício): nota válida nova gera saldo/cupons; segunda execução
gera 0; nota nova gera só os cupons dela; duas execuções simultâneas não
duplicam número nem saldo; erro no meio desfaz tudo; consulta do cupom chega à
origem; cliente sem nota válida não recebe nada; nota cancelada/inválida não
gera cupom.

## Fora do escopo

Integração e API do Lojamix, sincronização, fila, cursores, vínculo de clientes,
elegibilidade, participação, notas e sua validação, cancelamento, cron, demais
módulos. Sem commit, envio ou publicação.
