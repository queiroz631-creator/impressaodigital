# Selecionar arquivos do último atendimento no WhatsApp

## Objetivo
No painel de WhatsApp, adicionar um botão no modo de seleção de arquivos que selecione apenas os arquivos do **último atendimento anterior do mesmo cliente** (mesmo número de telefone), ignorando a conversa atualmente aberta.

Exemplo: o cliente enviou 3 arquivos no atendimento 1 e 4 arquivos no atendimento 2. Ao clicar no botão na conversa 3, devem ser selecionados só os 4 arquivos do atendimento 2.

## Decisões tomadas
- Considerar qualquer conversa anterior do mesmo número (independente de status), conforme resposta do usuário.
- Ordem do "último atendimento": conversa anterior com `created_at` mais recente.
- Seleção baseada na tabela `whatsapp_mensagens`, filtrando mensagens com `arquivo_url` não nulo.

## O que será alterado

### `src/routes/whatsapp.tsx`
1. **Consulta do último atendimento**  
   Adicionar uma `useQuery` (ou consulta inline) em `Conversa` que busque em `whatsapp_conversas` uma conversa com o mesmo `telefone`, mas `id != conversa.id`, ordenada por `created_at` decrescente, limit 1. Opcionalmente pré-buscar as mensagens dessa conversa com arquivo.

2. **Botão na barra de seleção**  
   Inserir ao lado do botão **"Selecionar todos"** um botão **"Último atendimento"** (ícone `History` do `lucide-react`).

3. **Ação do botão**  
   - Busca as mensagens do último atendimento encontrado.  
   - Se houver arquivos, substitui o `Set` de selecionados pelos `id`s dessas mensagens (seleciona somente esses arquivos).  
   - Se não houver atendimento anterior ou não houver arquivos, exibe toast informativo.

4. **Restrições**  
   - Não alterar layout geral da tela.  
   - Não alterar lógica de bot, webhook, banco de dados ou autenticação.  
   - Manter os botões existentes: Selecionar todos, Calculadora, Baixar.

## Verificação
- TypeScript (`tsgo` ou `bunx tsc --noEmit`) sem erros.
- Build (`bun run build`) com sucesso.
- Teste no preview: abrir uma conversa de um número com histórico, ativar modo de seleção, clicar em "Último atendimento" e confirmar que apenas os arquivos do atendimento anterior são selecionados.
