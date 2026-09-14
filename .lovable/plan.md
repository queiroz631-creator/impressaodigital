# Identificar a conexão em cada conversa

## Resultado

- Mostrar em cada item da lista de conversas um pequeno marcador com a primeira letra do nome da conexão.
- Usar no marcador a cor cadastrada para essa conexão.
- Manter o avatar atual do contato, nome, última mensagem, horário, contador de não lidas e destaque da conversa selecionada.
- Exibir o marcador tanto na visão consolidada **Todas as conexões** quanto ao filtrar uma conexão, inclusive no celular.

## Implementação

- Usar a lista segura de conexões já carregada na tela para relacionar cada `conexao_id` da conversa ao nome e à cor correspondente.
- Incluir `conexao_id` no tipo da conversa e montar um mapa local de conexões para consulta rápida.
- Renderizar o marcador circular ao lado das informações de cada conversa, com a inicial em maiúscula e texto acessível contendo o nome completo da conexão.
- Se uma conexão não estiver disponível na lista, mostrar um marcador neutro com `?`, sem bloquear a conversa.
- Não alterar banco, permissões, credenciais, webhook, bot ou regras de isolamento.

## Verificação

- Conferir conversas de duas conexões na opção **Todas as conexões**, validando letra e cor diferentes.
- Conferir a lista filtrada por uma conexão e a visualização em tela estreita.
- Confirmar que seleção, abertura, busca, abas e contadores continuam funcionando.
- Executar as verificações de tipos, lint e compilação, sem commit ou push.
