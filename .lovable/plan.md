# Melhoria 6 — Editar nome e anotações com botão "Editar" (WhatsApp)

## O que muda

No card de anotações (coluna da direita da conversa), o cabeçalho passa a mostrar:

- Nome do cliente, com botão de lápis para editar
- Telefone formatado, ex.: (27) 99714-9157

Ao editar e salvar o nome:

- O nome é atualizado em todos os atendimentos daquele telefone (lista de contatos, cabeçalho da conversa e histórico passam a exibir o novo nome imediatamente).
- Nome vazio volta a exibir o telefone, como hoje.

Texto da anotação:

- O campo fica somente leitura por padrão.
- Um botão "Editar" habilita a digitação; ao editar aparecem "Salvar" e "Cancelar".
- Cancelar descarta a alteração e volta ao modo leitura.
- Trocar de conversa também volta ao modo leitura.

Observação: o nome é alterado dentro do sistema. Não é possível renomear o contato na agenda do celular pela Z-API, então a mudança vale para o painel.

## Comportamento mantido

- Recolher/expandir as anotações pelo ícone e a preferência salva.
- Anotação vinculada ao telefone, compartilhada entre todos os atendimentos do cliente.
- Nenhuma outra tela, aba, contador, layout geral ou lógica do bot é alterada.

## Detalhes técnicos

- Arquivo único: `src/routes/whatsapp.tsx`.
- Card de anotações: cabeçalho com nome + telefone, modo de edição inline do nome (input + salvar/cancelar) e estado `editandoNota` controlando textarea desabilitado, botão Editar/Salvar/Cancelar; estado reseta ao trocar `conversa.telefone`.
- Mutation do nome faz `update whatsapp_conversas set nome_contato = <valor ou null> where telefone = <telefone>`, seguida de `invalidateQueries` de `whatsapp-conversas` e da conversa aberta.
- Sem migração de banco; a coluna `nome_contato` já existe.
- Após implementar, a melhoria é marcada como executada, mantendo `status = 'pendente'` como nas anteriores.
