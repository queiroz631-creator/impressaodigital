# Remover a mensagem fixa "Vi que você enviou um arquivo. É para fazer um orçamento?"

Essa frase não vem de nenhuma configuração: está escrita direto no código, no motor de menu
(`src/lib/bot-motor.ts`), e é disparada sempre que chega um arquivo/imagem enquanto a conversa
está na etapa inicial ou nas etapas de menu.

## O que muda

- O bot deixa de enviar essa pergunta automática ao receber arquivo.
- Quem passa a decidir o que responder quando o cliente manda arquivo é exclusivamente a aba
  **Primeiro contato** (regras "só arquivos" e "arquivos + palavras-chave").
- Sem regra que combine, o bot fica em silêncio aguardando — não inicia orçamento por conta própria.
- Dentro de um fluxo, o recebimento de arquivos continua exatamente como está hoje (etapas de
  receber/analisar arquivos e a contagem de páginas).

## Detalhes técnicos

- `src/lib/bot-motor.ts`: remover os dois blocos que devolvem a mensagem fixa e a etapa
  `confirmar_arquivo` (linhas ~405-421), remover o tratamento da etapa `confirmar_arquivo`
  (~423-432) e tirar `"confirmar_arquivo"` da lista de etapas (~135).
  Arquivo na etapa inicial passa a seguir o mesmo caminho de uma mensagem comum (menu).
- Nada muda em `bot.server.ts`, fluxos, respostas automáticas, primeiro contato, calculadora,
  orçamentos, pedidos ou currículo. Sem alteração de layout.
