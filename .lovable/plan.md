# Tempo de espera do fluxo de finalização

## O que muda

Em Configuração do Bot > Fluxos, ao lado do seletor "Fluxo de finalização", entra um campo
**"Iniciar após (minutos)"**.

- Com **0** (padrão), tudo continua como hoje: o fluxo começa assim que a conversa entra na aba
  "Aguardando Finalização".
- Com um valor maior que zero, a conversa vai para a aba imediatamente, mas o bot só inicia o
  fluxo depois desse tempo, pela rotina automática que já roda periodicamente.
- Se o cliente ou o atendente mudar a conversa de status antes do prazo, o fluxo não é iniciado.
- Sem fluxo selecionado, o campo não tem efeito.

Nada mais muda: abas, demais fluxos, primeiro contato, inatividade e finalização continuam iguais.

## Detalhes técnicos

- Banco: `ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS finalizacao_delay_minutos integer NOT NULL DEFAULT 0;`
  e `ALTER TABLE whatsapp_conversas ADD COLUMN IF NOT EXISTS finalizacao_fluxo_em timestamptz;`
  (marca quando a conversa entrou na aba e ainda aguarda o disparo).
- `src/lib/bot-motor.ts` / `src/lib/bot-dados.server.ts`: novo campo `finalizacao_delay_minutos` em `BotConfig`.
- `src/lib/bot.server.ts`:
  - `iniciarFinalizacao`: se o delay for 0, mantém o comportamento atual; se for maior, grava
    `finalizacao_fluxo_em = now()` e retorna sem enviar mensagem.
  - `verificarInatividade` (rotina periódica já existente): novo bloco que busca conversas com
    `status = 'aguardando_finalizacao'` e `finalizacao_fluxo_em` mais antigo que o delay, limpa o
    campo e dispara o fluxo com o mesmo `iniciarFluxo`/`entregarFluxo` usado hoje.
  - Ao sair do status `aguardando_finalizacao` (qualquer troca de status), `finalizacao_fluxo_em` é limpo.
- `src/components/bot/FluxosPainel.tsx`: campo numérico ao lado do seletor, lendo/gravando
  `whatsapp_config.finalizacao_delay_minutos`, com texto de ajuda.
