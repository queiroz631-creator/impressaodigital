# Melhoria 27 — Assumir atendimento abre a conversa

## Objetivo
Ao assumir um atendimento (pelo botão "Assumir" ou quando o atendimento passa para atendimento humano automaticamente), o sistema deve levar direto para a conversa daquele cliente, já aberta, em vez de fechar a conversa e deixar o usuário na aba anterior.

## Comportamento novo
- Ao clicar em "Assumir": a aba passa para "Em atendimento" e a conversa do cliente continua aberta, pronta para digitar.
- Quando o robô transferir a conversa para atendimento humano e essa conversa já estiver aberta na tela, ela permanece aberta e a aba acompanha o novo status (sem fechar sozinha).
- Demais ações (Devolver ao bot, Pendente, Fila de impressão, Finalizar) continuam exatamente como estão hoje: a conversa fecha e a aba atual é mantida.

## Detalhes técnicos
Alteração restrita a `src/routes/whatsapp.tsx`:
- Em `alterarStatus`, aceitar um parâmetro opcional "seguir" que, ao concluir a mudança para `em_atendimento`, chama `onAbrirConversa(conversa.id, "em_atendimento")` — o mesmo callback já usado por "Últimos Arquivos" para trocar aba e manter a conversa aberta. Usado apenas no botão "Assumir".
- No efeito que hoje fecha a conversa aberta quando o status deixa de bater com a aba selecionada, abrir exceção quando o novo status for `em_atendimento`: nesse caso trocar a aba para `em_atendimento` e manter a conversa aberta.

Sem mudanças em banco de dados, lógica do bot, layout ou outras telas. Ao final, marcar a melhoria como executada.
