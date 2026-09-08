# Melhoria 6 — Editar nome no card de anotações (WhatsApp)

## O que muda

No card de anotações (coluna da direita da conversa), o cabeçalho passa a mostrar:

- Nome do cliente, com botão de lápis para editar
- Telefone formatado, ex.: (27) 99714-9157

Ao editar e salvar o nome:

- O nome é atualizado em todos os atendimentos daquele telefone (lista de contatos, cabeçalho da conversa e histórico passam a exibir o novo nome imediatamente).
- Nome vazio volta a exibir o telefone, como hoje.

Observação: o nome é alterado dentro do sistema. Não é possível renomear o contato na agenda do celular pela Z-API, então a mudança vale para o painel.

## Comportamento mantido

- Recolher/expandir as anotações pelo ícone e a preferência salva.
- Texto da anotação, salvar, e o vínculo por telefone.
- Nenhuma outra tela, aba, contador, layout geral ou lógica do bot é alterada.

## Detalhes técnicos

- Arquivo único: `src/routes/whatsapp.tsx`.
- Cabeçalho do card de anotações ganha nome + telefone e um modo de edição inline (input + salvar/cancelar).
- Mutation faz `update whatsapp_conversas set nome_contato = <valor ou null> where telefone = <telefone>`, seguida de `invalidateQueries` de `whatsapp-conversas` e da conversa aberta.
- Sem migração de banco; a coluna `nome_contato` já existe.
- Após implementar, a melhoria é marcada como executada, mantendo `status = 'pendente'` como nas anteriores.
