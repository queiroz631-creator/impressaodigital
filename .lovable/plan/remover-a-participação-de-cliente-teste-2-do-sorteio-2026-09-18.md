# Remover a participação de CLIENTE TESTE 2 do sorteio

## O que foi verificado
- CLIENTE TESTE 2 (CPF 219.364.640-63) tem 1 participação no sorteio "Dia das Crianças" (criada automaticamente pela nova regra de vínculo).
- Essa participação **não tem** notas vinculadas, cupons, saldo nem registros de ganhador — a remoção é segura.
- Existem 2 registros de histórico (auditoria) ligados a ela — serão **preservados**, conforme a regra de nunca apagar históricos.

## O que será feito (apenas dados, sem alterar código)
1. Apagar somente o registro de participação desse cliente no sorteio (DELETE em `sorteio_participantes` filtrando pelo id exato da participação).
2. Manter intactos: o cadastro do cliente, as notas na base do sorteio, o histórico de auditoria (2 registros) e qualquer outro dado.
3. Conferir no final: participação removida; auditoria, cliente e notas intactos.

## Observações
- Se a remoção for bloqueada pelo vínculo com o histórico de auditoria, paro e aviso em vez de apagar o histórico.
- O cadastro do cliente no sistema **não** será removido — só o vínculo com o sorteio. Se quiser remover também o cadastro, avise.
- Atenção: com a regra nova de vínculo automático, se esse cliente tiver nota válida na base e a loja o reenviar, ele pode voltar a participar automaticamente.

## Fora de escopo
Nenhuma alteração de código, rotas, RLS, notas, cupons, saldo ou sincronização. Sem commit, envio ou publicação.
