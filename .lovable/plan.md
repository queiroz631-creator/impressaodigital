# Nota 161036 cancelada — o que realmente aconteceu e o que ajustar

## Conferência feita no banco (sem alterar nada)

A nota 161036 (R$ 19,00) foi cancelada às 23:10:49 e o sistema **reagiu corretamente**:

- o cupom dela (01-872584) ficou com situação **CANCELADO** no mesmo instante;
- o saldo do cliente foi recalculado no mesmo instante, de **R$ 10,85 para R$ 11,85**.

O saldo subiu R$ 1,00 porque aquele cupom valia R$ 20,00 e tinha usado R$ 1,00 de
troco vindo de notas anteriores. Ao cancelar a nota, o cupom é desfeito e esse
R$ 1,00 volta para o troco do cliente. Conferência da conta: notas válidas já
processadas somam R$ 251,85, os 12 cupons que continuam valendo consomem
R$ 240,00, então o saldo correto é R$ 11,85 — exatamente o que está gravado.

Ou seja: **não há erro de cálculo**. O que engana na tela é a contagem de cupons.

## O problema real: as telas contam cupons cancelados

Hoje, ao contar cupons, o sistema conta todos, inclusive os cancelados. Por isso
o número de cupons do cliente e do sorteio não diminuiu depois do cancelamento e
dá a impressão de que "nada mudou":

- contagem de cupons na lista de sorteios e no cabeçalho do sorteio;
- coluna **Cupons** na tela de participantes.

## O que vou ajustar (apenas exibição)

1. Contagens de cupons passam a considerar somente cupons que continuam valendo
   (ativos e utilizados), excluindo os cancelados.
2. No painel do sorteio, manter o total de cancelados visível em separado, para
   o histórico continuar claro.
3. Nenhuma mudança na regra de saldo, na geração de cupons, no cancelamento, no
   banco ou na sincronização.

## Detalhes técnicos

- `src/modules/sorteios/hooks/useSorteios.ts`: em `contar`/`contagensDe` e na
  contagem por participante (por volta da linha 200), adicionar
  `.neq("status", "CANCELADO")` nas consultas a `sorteio_cupons`.
- O indicador `porStatusCupom` do painel continua como está (já separa
  ATIVO/CANCELADO/UTILIZADO).
- Sem migração, sem alteração de funções, gatilhos, políticas ou permissões do
  banco. Sem commit, envio ou publicação.
