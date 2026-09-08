# Correção automática do webhook da Z-API

## Objetivo
O endereço gravado na Z-API está diferente do correto. Hoje a correção é manual (botão "Reconfigurar webhook"). Vamos tornar a correção automática e confirmar que funcionou.

## O que será feito

1. **Correção automática ao abrir a tela**
   - Em Configurações → WhatsApp, ao carregar a comparação do webhook:
     - Se o endereço gravado na Z-API estiver diferente do correto, o sistema chama `reconfigurarWebhooksZapi()` automaticamente (sem precisar clicar no botão).
     - Ao terminar, recarrega a leitura dos webhooks para mostrar o estado atualizado.

2. **Confirmação visível**
   - Se a correção automática funcionar: aviso verde "Webhook corrigido automaticamente".
   - Se falhar (ex.: credenciais inválidas): mantém o aviso vermelho e mostra o erro retornado, com o botão manual para tentar de novo.

3. **Validação**
   - Abrir Configurações → WhatsApp, confirmar que o endereço gravado passa a ser o correto sem clique manual.
   - Enviar mensagem de teste pelo celular e confirmar que a conversa aparece no sistema.

## Detalhes técnicos
- Alteração apenas em `src/routes/configuracoes.tsx` (bloco da aba WhatsApp): um `useEffect` que dispara a reconfiguração quando `lerWebhooksZapi` retorna divergência, com proteção contra execução dupla e `queryClient.invalidateQueries` para atualizar a leitura.
- Nenhuma mudança no banco de dados, no bot ou no layout.
