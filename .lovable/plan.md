# Cancelamento de nota que completou cupom de outra nota — regra confirmada

## Contexto
Ao cancelar a nota 161033, o sistema zerava o saldo do cliente sem mexer nos cupons. A correção já aplicada faz o cancelamento também desfazer o cupom que aquela nota ajudou a completar.

## Como o sistema decide qual cupom cancelar
Não existe vínculo de "pedaços de nota" dentro de um cupom — o banco guarda apenas a nota onde o cupom nasceu. Por isso a regra é determinística:

1. Ao cancelar uma nota, recalcula: soma das notas VÁLIDAS restantes do participante → quantos cupons de valor_por_cupom esse total ainda sustenta.
2. Se houver cupons ativos a mais do que o total sustenta, cancela o(s) cupom(ns) **mais recente(s) e ainda ATIVO(s)** — nunca um cupom UTILIZADO (intocável, o cliente pode já tê-lo usado).
3. O que sobra após os cupons restantes vira troco em `sorteio_participantes.saldo_centavos`.
4. Tudo na mesma transação, com auditoria; cancelamentos repetidos são idempotentes.

## Estado atual
- Regra já implementada e testada (trigger de cancelamento + função de recálculo no banco).
- Caso real conferido: nota 161033 cancelada → cupom 01-252279 cancelado, cliente voltou a 12 cupons válidos e R$ 16,85 de troco.
- Pergunta ao usuário sobre a regra (mais recente / mais antigo / só zerar saldo) foi pulada — mantida a regra padrão: **cupom ativo mais recente**.

## Próximo passo
Nenhuma alteração pendente. Se o usuário preferir outra regra de escolha do cupom (mais antigo, ou nunca cancelar cupom), ajustar somente a função de recálculo no banco — sem mudar telas, validação, fila ou sincronização.

## Fora de escopo
Sem alteração de valor por cupom, elegibilidade, validação, API local, Lojamix, fila, cursores ou demais módulos. Sem commit, envio ou publicação.
