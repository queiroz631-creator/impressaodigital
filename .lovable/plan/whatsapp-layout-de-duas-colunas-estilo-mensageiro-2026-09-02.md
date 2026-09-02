# WhatsApp: layout de duas colunas estilo mensageiro

Reformular a tela `/whatsapp` para funcionar como um mensageiro: lista de contatos fixa à esquerda e a conversa selecionada à direita, com abas apenas de ícones.

## Coluna esquerda (lista de contatos)

- Largura fixa (~360px), com busca por nome/telefone no topo (mantida).
- Abas de status somente com ícones + contador ao lado:
  - Automático — robô
  - Aguardando Resposta — relógio
  - Em Atendimento — headset
  - Pendente — alerta
  - Aguardando Finalização — bandeira
  - Finalizado — check
  - Cada aba mostra o número de conversas ao lado do ícone e o nome completo aparece como tooltip.
- Cada contato vira uma linha compacta clicável: avatar com inicial, nome (ou telefone), prévia da última mensagem, horário e selo de não lidas. Clicar abre a conversa à direita (sem sair da tela).
- Contato selecionado fica destacado.
- Os botões de status/finalização saem dos cartões da lista (ficam no cabeçalho da conversa, que já os possui).

## Coluna direita (conversa)

- Sem botão "Voltar" no desktop: a conversa fica sempre visível ao lado da lista.
- Cabeçalho com nome, telefone, status e as ações já existentes (Assumir, Devolver ao bot, Pendente, Aguardando Finalização, Finalizar, Bot ligado/desligado), organizadas em uma barra compacta.
- Balões de mensagem, mensagens de sistema e campo de envio permanecem como estão.
- Quando nenhum contato estiver selecionado: estado vazio ("Selecione uma conversa").

## Mobile

- Abaixo de 768px volta ao comportamento atual: lista ocupa a tela toda e, ao clicar, a conversa abre em tela cheia com botão "Voltar".

## Detalhes técnicos

- Alteração apenas em `src/routes/whatsapp.tsx` (apresentação); nenhuma mudança de banco, server functions ou lógica do bot.
- Ícones do `lucide-react`; mapa de ícones por status derivado de `STATUS_CONVERSA` (`src/lib/whatsapp-comum.ts`).
- Layout com altura `calc(100vh - 8rem)` e rolagem independente nas duas colunas.
- `useIsMobile` (`src/hooks/use-mobile.tsx`) decide entre painel duplo e tela única.
