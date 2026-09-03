# Selecionar todos os arquivos do atendimento no WhatsApp

## Objetivo
Adicionar, na barra de seleção de arquivos da conversa do WhatsApp, um botão que selecione de uma só vez todos os arquivos do atendimento (conversa) atualmente aberto.

## Alterações
1. **Tela `src/routes/whatsapp.tsx`**
   - Incluir um botão "Selecionar todos" (ou "Selecionar todos os arquivos") ao lado dos botões **Calculadora** e **Baixar**, dentro do painel que aparece quando o modo seleção está ativo.
   - Ao clicar no botão, preencher o `Set` de `selecionados` com os `id`s de todas as mensagens da conversa aberta que possuam `arquivo_url`.
   - Se todos os arquivos visíveis já estiverem selecionados, o botão alterna para desmarcar todos (comportamento padrão de "selecionar/desmarcar todos").
   - Manter inalterados: modo seleção, botões Calculadora/Baixar, envio para calculadora, downloads múltiplos, layout e demais comportamentos.

## Critérios de aceitação
- O botão aparece somente quando o modo de seleção está ativo.
- Clicar no botão seleciona todos os arquivos da conversa aberta de uma só vez.
- Clicar novamente quando todos já estão selecionados desmarca todos.
- Os botões Calculadora e Baixar continuam funcionando normalmente com a seleção resultante.
