# Bot em página própria + melhorias no WhatsApp

## 1. Nova página "Configuração do Bot"

- Criar a rota `/bot` com toda a configuração do bot que hoje vive dentro de Configurações.
- Em Configurações, remover a aba "Bot" e deixar apenas um atalho/botão "Abrir Configuração do Bot" (mantendo as demais abas iguais).
- Adicionar "Bot" no menu lateral (ícone de robô), logo abaixo de WhatsApp.
- Na nova página, cada bloco atual vira uma aba própria:
  1. Geral (bot ativo, IA, orçamento automático, revisão humana)
  2. Horários (24h ou por dia da semana)
  3. Mensagens (boas-vindas, retorno, menu, fora do horário, não entendi, transferência, finalização, orçamento)
  4. Menu principal (opções, ações, ordem, palavras-chave)
  5. Respostas automáticas
  6. Inatividade / finalização
  7. Simulador (testar bot)
- Botão Salvar continua fixo no topo, com o indicador de alterações não salvas.

## 2. Tela WhatsApp

- Campo de pesquisa no topo, filtrando a lista por nome do contato ou telefone (ignorando máscara/acentos), aplicado dentro da aba ativa.
- Botão de status direto no card da conversa (sem abrir a conversa): menu com Assumir, Devolver ao bot, Pendente e Finalizar, com a mesma gravação e auditoria já usadas dentro da conversa.
- Dentro da conversa: ao clicar em Devolver ao bot, Pendente ou Finalizar, salvar e voltar automaticamente para a lista. "Assumir" continua abrindo/permanecendo na conversa.

## 3. Ignorar grupos

- No webhook do WhatsApp, descartar qualquer callback de grupo (telefone/chat com sufixo de grupo, `isGroup`, ou presença de participante). Essas mensagens não são gravadas, não criam conversa e o bot não responde.

## 4. Remover Histórico

- Excluir a rota `/historico` e o item do menu lateral.
- Remover apenas o que era usado exclusivamente por ela (consulta de cálculos usada só nessa tela). Nada de cálculo/orçamento em outras telas é alterado.

## Detalhes técnicos

- Nova rota `src/routes/bot.tsx` usando `AppLayout` + `head()` próprio; `src/components/ConfiguracaoBot.tsx` é reorganizado em `Tabs` (sem mudar a lógica de carregamento/salvamento existente).
- Filtro e ação de status na lista reaproveitam as funções já existentes em `src/routes/whatsapp.tsx` (extraídas para uso na lista e na conversa).
- Filtro de grupo aplicado cedo em `src/routes/api/public/whatsapp/webhook.ts`, antes da deduplicação e da criação de cliente/conversa.
- Nenhuma mudança de banco necessária.
