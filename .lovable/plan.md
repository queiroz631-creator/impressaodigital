# Exclusão de cliente que participa de sorteio

## O que está acontecendo

Na tela CLIENTES, ao excluir um cadastro, o sistema confere antes se o cliente tem
currículos, orçamentos ou pedidos. Não confere participação em sorteio. Quando o
cliente já participa de um sorteio, o banco recusa a exclusão e a mensagem técnica
do banco aparece na tela ("violates foreign key constraint ...").

## Correção proposta

- Incluir a verificação de participação em sorteio (e do histórico de sorteios do
  cliente) na mesma checagem já existente antes de excluir.
- Quando houver, mostrar a mensagem amigável no mesmo formato atual:
  "Não é possível excluir: o cliente possui 1 participação em sorteio vinculada(s)."
- Nunca exibir mensagem técnica do banco ao usuário: qualquer falha inesperada de
  exclusão passa a mostrar "Não foi possível excluir o cliente."
- Nada é apagado em cascata: participações, notas, cupons e auditoria continuam
  intactos.

## Detalhes técnicos

Arquivo único: `src/routes/clientes.tsx`, função `confirmarExclusao`.
Adicionar ao `Promise.all` contagens `head: true` em `sorteio_participantes` e
`sorteio_historico` por `cliente_id`, somar aos vínculos existentes, e trocar o
`toast.error(e.message)` do catch por texto fixo amigável.

## Fora do escopo

Portal público de sorteios, administração de Sorteios, tabelas, campos, RLS,
WhatsApp, Bot, Conexões e demais módulos permanecem intactos. Sem commit, push
ou deploy.
