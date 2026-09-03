# Plano: botão "Últimos Arquivos" no WhatsApp

## Objetivo
Renomear o botão existente de seleção de arquivos na tela de atendimento WhatsApp para **"Últimos Arquivos"** e fazer com que ele abra o **atendimento mais recente do mesmo cliente** (critério: maior `atendimento_numero`, com `created_at` como desempate), independente do status (finalizado, pendente, bot, em atendimento etc.), e selecione todos os arquivos daquele atendimento.

## Escopo confirmado
- O botão pode abrir outra conversa se ela for o atendimento mais recente do telefone.
- "Mais recente" = maior valor da coluna `atendimento_numero` da tabela `whatsapp_conversas`; em empate, usar `created_at` descendente.
- Status não importa: deve considerar todas as conversas do mesmo telefone.
- Se a conversa atual já for a mais recente, o botão apenas seleciona todos os arquivos dela.

## Mudanças

### `src/routes/whatsapp.tsx`
1. **Renomear label** do botão de "Último atendimento" para **"Últimos Arquivos"**.
2. **Criar função assíncrona** `abrirUltimosArquivos` dentro do componente `Conversa`:
   - Busca em `whatsapp_conversas` todas as linhas com o mesmo `telefone` da conversa atual, trazendo `id`, `status`, `atendimento_numero` e `created_at`.
   - Ordena por `atendimento_numero` descendente, depois `created_at` descendente, e pega a primeira.
   - Se nenhuma conversa for encontrada ou a mais recente não tiver arquivos, exibe `toast` informativo e não altera a seleção.
   - Se a conversa mais recente for diferente da atual:
     - Atualiza `abertaId` para o id dela.
     - Atualiza `aba` para o `status` dela (para a aba ativa acompanhar a conversa aberta).
     - Ativa o modo de seleção (`setSelecionando(true)`).
     - Define uma flag `selecionarAoCarregar` para selecionar os arquivos assim que as mensagens carregarem.
   - Se for a mesma conversa atual:
     - Apenas ativa o modo de seleção e seleciona todos os arquivos já carregados (comportamento atual).
3. **Adicionar efeito** que, quando `selecionarAoCarregar` estiver ativa e as mensagens da conversa aberta já tiverem sido carregadas, preenche `selecionados` com todos os `id` de mensagens que possuem `arquivo_url`, e depois limpa a flag.
4. **Ajustar tooltip/title** do botão para refletir o novo comportamento: "Abrir o atendimento mais recente e selecionar seus arquivos".

## Não será alterado
- Layout visual, abas, ícones, comportamento de envio/recebimento de mensagens, bot, webhooks, banco de dados e rotas de mídia permanecem intactos.
- A lógica de download e envio para a calculadora continua usando os IDs selecionados e a rota `/api/public/whatsapp/midia` existente.

## Verificação
- `tsgo` (typecheck) sem erros.
- Build de produção passa.
- Teste no preview: simular múltiplas conversas do mesmo telefone (quando houver) e confirmar que o botão abre a de maior `atendimento_numero` e marca todos os arquivos.
