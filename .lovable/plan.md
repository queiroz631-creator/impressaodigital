# Aba "Aguardando Finalização" no WhatsApp

## O que muda

1. **Nova aba na tela WhatsApp**: "Aguardando Finalização", entre "Pendente" e "Finalizado", com a mesma contagem e o mesmo comportamento das outras abas.
2. **Botão de atalho no card da conversa**: um botão com ícone (bandeira/check duplo) ao lado do menu Status, na lista, que move a conversa para essa aba sem abrir a conversa. A mesma ação também entra no menu Status (lista e dentro da conversa).
3. **Fluxo de finalização**: em Configuração do Bot > aba Fluxos, um seletor no topo da tela "Fluxo de finalização", listando os fluxos ativos.
4. **Ao entrar na aba**, o bot inicia imediatamente o fluxo escolhido e conduz a conversa por ele. Enquanto o fluxo roda, a conversa continua na aba "Aguardando Finalização". Quando o fluxo termina, a conversa passa para "Finalizado" (com data e motivo de finalização, como já acontece hoje). Se nenhum fluxo estiver selecionado, a conversa apenas fica na aba, sem mensagem automática.

Nada mais muda: layout, demais abas, fluxos existentes, triagem, primeiro contato e inatividade continuam iguais.

## Detalhes técnicos

- Banco: `ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS fluxo_finalizacao_id uuid REFERENCES bot_fluxos(id) ON DELETE SET NULL;` (sem outras alterações de schema; o novo status é apenas um valor de texto em `whatsapp_conversas.status`).
- `src/lib/whatsapp-comum.ts`: novo valor `aguardando_finalizacao` em `StatusConversa`, em `STATUS_CONVERSA` (rótulo "Aguardando Finalização") e em `rotuloStatusConversa`.
- `src/lib/bot-motor.ts` / `src/lib/bot-dados.server.ts`: incluir `fluxo_finalizacao_id` no tipo `BotConfig` e na leitura de `whatsapp_config`.
- `src/components/bot/FluxosPainel.tsx`: `Select` no topo, lendo/gravando `whatsapp_config.fluxo_finalizacao_id` (opção "Nenhum").
- `src/lib/whatsapp.functions.ts` (server fn nova, com a mesma autenticação usada hoje): ao marcar a conversa como `aguardando_finalizacao`, grava o status, registra a auditoria e dispara o fluxo de finalização em `src/lib/bot.server.ts` (nova função que reaproveita `iniciar`/`entregarFluxo` já existentes, gravando `etapa: "fluxo"` e o estado do fluxo no contexto).
- `src/lib/bot.server.ts`: em `processarBot`, liberar o processamento também quando `status === "aguardando_finalizacao"` (hoje só `automatico`), mantendo todo o resto igual; ao final do fluxo de finalização, marcar `status: "finalizado"`.
- `src/routes/whatsapp.tsx`: acrescentar a ação "Aguardando Finalização" em `ACOES_STATUS` e o botão de ícone no card, chamando a nova server fn em vez do update direto para esse status.
