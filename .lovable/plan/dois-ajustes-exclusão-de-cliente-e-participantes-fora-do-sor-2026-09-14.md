# Dois ajustes: exclusão de cliente e participantes fora do sorteio

## 1. Exclusão de cliente que participa de sorteio

**O que está acontecendo:** na tela CLIENTES, antes de excluir, o sistema confere
currículos, orçamentos e pedidos — mas não confere participação em sorteio. Quando o
cliente já participa de um sorteio, o banco recusa a exclusão e a mensagem técnica
aparece na tela ("violates foreign key constraint...").

**Correção:**
- Incluir participação em sorteio (e histórico de sorteios) na checagem já existente.
- Mensagem amigável no mesmo formato atual: "Não é possível excluir: o cliente possui
  1 participação em sorteio vinculada(s)."
- Qualquer outra falha inesperada passa a mostrar "Não foi possível excluir o cliente."
  em vez do texto técnico do banco.
- Nada é apagado em cascata: participações, notas, cupons e auditoria seguem intactos.

## 2. Participante que não concorre ao sorteio

Cada participante ganha a marcação "Concorre ao sorteio" (ligada por padrão). Ao
desligar:
- o participante continua podendo cadastrar notas e gerar cupons normalmente;
- ele fica marcado como fora do sorteio, e os sorteios futuros devem ignorá-lo;
- na lista de participantes aparece a marca "Não concorre";
- cada mudança é registrada na trilha de auditoria (quem alterou e quando).

A alteração é feita na tela Participantes do sorteio (administração), com o mesmo
controle de permissão usado nas outras ações de sorteio. Sorteios somente para
consulta (encerrado, cancelado, sorteado) não permitem alterar.

A marcação pertence à participação naquele sorteio, não ao cadastro do cliente:
vale somente para o sorteio em que foi feita, não é copiada para sorteios futuros,
e todo novo participante de um novo sorteio começa concorrendo.

## Detalhes técnicos

**Exclusão de cliente** — `src/routes/clientes.tsx`, `confirmarExclusao`: acrescentar
contagens `head: true` em `sorteio_participantes` e `sorteio_historico` por
`cliente_id` ao `Promise.all`, somar aos vínculos, e substituir o `toast.error(e.message)`
do catch por texto fixo.

**Elegibilidade** — migração adicionando `concorre_sorteio boolean not null default true`
em `sorteio_participantes` (nenhuma nova tabela; registros existentes continuam
concorrendo). Nova server function `definirElegibilidadeParticipante` em
`src/lib/sorteios.functions.ts` seguindo o padrão existente (`requireSupabaseAuth`,
`exigirGestao`, releitura do status via `lerSorteioAtual`, `somenteConsulta` bloqueia,
`registrarAuditoria` com evento `participante.elegibilidade_alterada`), validando
`sorteioId`/`participanteId`/`concorre` e aplicando `update ... eq(sorteio_id)`.
Tela `src/routes/sorteios.$id.participantes.tsx`: coluna com `Switch` + badge
"Não concorre", mutação invalidando `["sorteio-participantes", id]`. Tipos gerados
são regenerados após a migração.

## Fora do escopo

Portal público, fluxo de entrada, termos, notas, cupons, RLS existente, WhatsApp,
Bot, Conexões e demais módulos permanecem intactos. Sem commit, push ou deploy.
