# Selecionar arquivos do último atendimento no WhatsApp

## Objetivo
No painel de WhatsApp, adicionar um botão no modo de seleção de arquivos que selecione os arquivos do **último atendimento do cliente**. Seguindo a última resposta do usuário, a origem é a **conversa atualmente aberta**, independentemente do seu status.

## Decisões tomadas
- A origem dos arquivos é a conversa que está aberta (a mais recente com aquele número).
- Não há filtro por status: funciona mesmo se a conversa estiver finalizada, em atendimento, pendente, etc.
- Seleção baseada nas mensagens da própria conversa que possuem `arquivo_url`.

## O que será alterado

### `src/routes/whatsapp.tsx`
1. **Botão na barra de seleção**  
   Inserir ao lado do botão **"Selecionar todos"** um botão **"Último atendimento"** (ícone `History` do `lucide-react`).

2. **Ação do botão**  
   - Seleciona todos os arquivos da conversa aberta (`mensagens.filter(m => m.arquivo_url).map(m => m.id)`).  
   - Se não houver arquivos, exibe toast informativo.

3. **Restrições**  
   - Não alterar layout geral da tela.  
   - Não alterar lógica de bot, webhook, banco de dados ou autenticação.  
   - Manter os botões existentes: Selecionar todos, Calculadora, Baixar.

## Verificação
- TypeScript (`tsgo` ou `bunx tsc --noEmit`) sem erros.
- Build (`bun run build`) com sucesso.
- Teste no preview: abrir uma conversa (qualquer status), ativar modo de seleção, clicar em "Último atendimento" e confirmar que todos os arquivos da conversa atual são selecionados.

