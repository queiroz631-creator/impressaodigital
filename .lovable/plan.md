# WhatsApp: seletor de ações, botão de painel e atalho para orçamento

## 1. Seletor de ações ao lado de "Assumir"
- O botão **Assumir** continua como está.
- Logo depois dele entra uma lista suspensa "Mover para..." com as opções, cada uma com seu ícone e cor atuais:
  - Devolver ao bot
  - Pendente
  - Fila de impressão
  - Enviar para Aguardando Finalização
- Escolher uma opção já executa a ação, igual ao clique no botão de hoje. Depois a lista volta a mostrar "Mover para...".
- Os 4 botões separados saem da barra. Os botões Finalizar, Bot, Selecionar e Anotações continuam iguais.

## 2. Botão que abre e fecha as informações do contato
- O botão das anotações/informações do contato passa a usar o ícone padrão de abrir e fechar painel lateral.
- O ícone muda conforme o painel está aberto ou fechado. O comportamento fica igual: lembra a última escolha.

## 3. Botão "Orçamento" sempre visível
- Um novo botão **Orçamento** fica na barra do topo da conversa, com o mesmo visual do botão Calculadora.
- Ele abre a calculadora já com o nome e o telefone do cliente preenchidos, sem precisar selecionar arquivos.
- O botão **Calculadora** da seleção de arquivos não muda.

## Detalhes técnicos
- `src/routes/whatsapp.tsx`: `Select` (shadcn) com valor controlado e resetado após `onValueChange`, chamando `alterarStatus(...)` / `enviarFinalizacao()`; ícone `PanelRightOpen`/`PanelRightClose` no botão de `alternarNotas`; nova função `abrirOrcamento()` gravando `calc-arquivos-whatsapp` com `arquivos: []`, nome e telefone.
- `src/routes/index.tsx`: hoje a calculadora ignora o pedido quando não há arquivos; passa a preencher só nome/telefone nesse caso (o caminho com arquivos fica igual).
- Sem mudança no banco.
