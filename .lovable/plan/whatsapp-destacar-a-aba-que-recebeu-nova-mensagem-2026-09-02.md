# WhatsApp: destacar a aba que recebeu nova mensagem

Hoje cada aba (Automático, Aguardando, Em Atendimento, Pendente, Aguardando Finalização, Finalizado) mostra apenas o total de conversas daquele status. Não dá para saber, olhando as abas, onde chegou mensagem nova.

## O que muda

- Cada aba passa a considerar as mensagens não lidas das conversas daquele status.
- Quando houver pelo menos uma conversa com mensagem não lida na aba:
  - a aba ganha destaque visual (borda e ícone em cor de alerta, texto em negrito) mesmo quando não estiver selecionada;
  - aparece um selo com a quantidade de mensagens não lidas somadas, no canto do ícone;
  - o ícone recebe uma animação sutil de pulso enquanto houver mensagem nova.
- O número total de conversas do status continua sendo exibido como hoje, ao lado do ícone.
- O tooltip da aba passa a incluir o aviso, ex.: "Em Atendimento — 3 novas mensagens".
- Ao abrir a conversa, as não lidas já são zeradas (comportamento atual), então o destaque some sozinho.
- Na lista de contatos, a linha com mensagem não lida fica com o nome em negrito, além do selo que já existe.
- Vale igual no desktop e no mobile (é o mesmo painel de contatos).

## Detalhes técnicos

- Alteração apenas em `src/routes/whatsapp.tsx` (apresentação). Sem mudanças no banco, em server functions ou na lógica do bot.
- Novo agregado por status a partir de `conversas`: total e soma de `nao_lidas`, calculado no mesmo `useMemo` da contagem atual.
- Destaque com tokens semânticos do design system (nada de cores fixas), usando `cn` e `animate-pulse`.
- A atualização já acontece via realtime + refetch a cada 5s existentes.
