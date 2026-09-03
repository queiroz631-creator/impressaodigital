# Selecionar arquivos do último atendimento no WhatsApp

## Objetivo
Reutilizar o botão **"Selecionar todos"** do modo de seleção de arquivos do WhatsApp para a funcionalidade "selecionar os arquivos do último atendimento", renomeando-o. Seguindo a última resposta do usuário, os arquivos vêm da **conversa atualmente aberta**, independentemente do status dela.

## Decisões tomadas
- Não será criado um botão novo; o botão existente **"Selecionar todos"** será renomeado.
- A origem dos arquivos é a conversa aberta (a mais recente daquele cliente).
- Não há filtro por status: funciona se a conversa estiver finalizada, em atendimento, pendente, etc.
- Seleção continua baseada nas mensagens da conversa que possuem `arquivo_url`.

## O que será alterado

### `src/routes/whatsapp.tsx`
1. **Renomear o botão**  
   Alterar o texto do botão **"Selecionar todos"** para **"Selecionar arquivos do último atendimento"** (ou abreviação apropriada para caber no layout, mantendo o significado).

2. **Comportamento**  
   - Manter a ação atual: seleciona/desmarca todos os arquivos da conversa aberta.  
   - Garantir que a ação funcione para qualquer status da conversa.

3. **Restrições**  
   - Não alterar layout geral da tela.  
   - Não alterar lógica de bot, webhook, banco de dados ou autenticação.  
   - Manter os botões existentes: Calculadora e Baixar.

## Verificação
- TypeScript (`tsgo` ou `bunx tsc --noEmit`) sem erros.
- Build (`bun run build`) com sucesso.
- Teste no preview: abrir uma conversa (qualquer status), ativar modo de seleção, clicar no botão renomeado e confirmar que todos os arquivos da conversa atual são selecionados/desmarcados.


