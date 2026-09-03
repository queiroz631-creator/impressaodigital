# WhatsApp — fechar conversa ao mudar de aba

## Problema
Hoje, ao executar uma ação na conversa aberta (Assumir, Finalizar, Pendente, Enviar para Finalização, Devolver ao bot), o status muda e a conversa vai para outra aba, mas ela continua aberta no painel direito, porque a busca da conversa aberta (`aberta`) ignora o status/aba atual.

## Alteração (somente em `src/routes/whatsapp.tsx`)

No componente `Atendimento`:

1. Ao resolver a conversa aberta (`aberta`), considerar também a aba atual: se a conversa existir mas o `status` dela não corresponder mais à aba selecionada, tratar como fechada (`aberta = null`).
2. Como consequência, o painel direito volta ao estado "Selecione uma conversa para começar o atendimento" e o usuário permanece na aba atual, pronto para a próxima tarefa. No mobile, volta para a lista de contatos da aba atual.

Comportamento que permanece igual:
- Todas as ações (assumir, finalizar, pendente, bot etc.) e auditorias.
- Abas, contadores, badges de não lidas, busca e layout — nenhuma mudança visual.
- Conversas que mudam de status por fora (ex.: pelo bot) também fecham se estiverem abertas em outra aba — mesmo comportamento consistente.

## Fora de escopo
- Nenhuma alteração de layout, banco de dados ou lógica do bot.
