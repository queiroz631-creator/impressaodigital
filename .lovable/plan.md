# Reabrir sorteio cancelado

## Objetivo
Permitir que um administrador reabra um sorteio **CANCELADO**, de forma controlada e auditada, como já acontece com o sorteio encerrado.

## Regra
- CANCELADO volta para a situação que tinha antes do cancelamento: **RASCUNHO** (se nunca foi ativado) ou **ATIVO**. A situação anterior é descoberta pela auditoria do cancelamento; se não houver registro, volta para ATIVO quando existir movimentação (participantes/notas/cupons) e RASCUNHO quando não houver.
- Recusado se já houver ganhador registrado.
- Cupons, notas e participantes não são alterados (o cancelamento do sorteio não mexe neles), então a base volta a aceitar movimentação normalmente.
- Auditoria `sorteio.reaberto` com situação anterior (CANCELADO) e nova.

## O que muda
1. **Banco**: nova versão da função `sorteio_reabrir`, que aceita ENCERRADO e agora também CANCELADO, com trava contra reabertura simultânea e tudo em uma única transação. A migração também vai para `supabase/migrations/` com nome datado.
2. **Servidor**: a função `reabrirSorteio` já existe e continua exigindo a permissão `sorteios.gerenciar`; ela só passa a devolver a nova situação.
3. **Tela**: na página do sorteio cancelado aparece o botão **"Reabrir sorteio"**, com a confirmação: "Tem certeza que deseja reabrir este sorteio cancelado? Ele voltará para [Ativo/Rascunho] e poderá receber notas e participações novamente." Depois de reabrir, a tela se atualiza e mostra uma mensagem de confirmação.
4. Nas regras de situação, CANCELADO passa a permitir a volta somente pela reabertura (sem virar uma troca simples de situação).

## Fora do escopo
Sorteios SORTEADOS continuam sem opção de volta. Nada muda na apuração, nos cupons, no saldo, na sincronização ou no portal.
