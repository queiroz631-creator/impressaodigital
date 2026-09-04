# Tempo por fluxo: finalização e ação por falta de resposta

## O que muda

Na configuração de cada fluxo (Configurar Bot > Fluxos), no mesmo cartão em que hoje existe
"Mostrar na finalização", entram dois blocos novos:

**1. Tempo do fluxo de finalização (por fluxo)**

- Campo "Iniciar após (minutos)", visível quando "Mostrar na finalização" está ligado.
- Com 0, o fluxo começa assim que a conversa entra em "Aguardando Finalização" (comportamento atual).
- Com valor maior que zero, a conversa entra na aba imediatamente e o fluxo só é disparado depois
  desse tempo, pela rotina automática que já roda periodicamente.
- Vale tanto para o fluxo escolhido na hora de finalizar quanto para o fluxo padrão de finalização.
  O campo global "Iniciar após (minutos)" continua existindo como padrão para quando o fluxo não
  tiver tempo próprio.

**2. Ação por falta de resposta / fluxo parado**

- Campo "Se o cliente não responder por (minutos)" + "O que fazer".
- Opções de ação: nada (padrão), enviar uma mensagem e continuar aguardando, voltar ao início do
  fluxo, iniciar outro fluxo, transferir para atendente (com ou sem mensagem), finalizar
  atendimento (com ou sem mensagem).
- Campo de mensagem opcional (enviada antes da ação) e seletor de fluxo de destino quando a ação
  for "iniciar outro fluxo".
- A contagem começa na última mensagem da conversa e vale enquanto o fluxo estiver em execução —
  o que também resolve o caso do bot travado em uma etapa, já que a conversa fica parada esperando.
- Se o cliente responder antes do prazo, nada acontece. A ação é executada uma única vez por
  parada; se o fluxo continuar e parar de novo, a contagem reinicia.

Nada mais muda: abas do WhatsApp, inatividade geral, primeiro contato, respostas automáticas e
demais fluxos continuam iguais.

## Detalhes técnicos

Banco (`bot_fluxos`), colunas novas com padrão compatível:

- `finalizacao_delay_minutos integer not null default 0`
- `sem_resposta_minutos integer not null default 0`
- `sem_resposta_acao text not null default 'nenhuma'`
- `sem_resposta_mensagem text not null default ''`
- `sem_resposta_fluxo_id uuid references bot_fluxos(id) on delete set null`

Código:

- `src/lib/bot-fluxos.ts`: novos campos em `Fluxo` e catálogo `ACOES_SEM_RESPOSTA`
  (nenhuma | mensagem | voltar_inicio_fluxo | iniciar_fluxo | transferir_atendente |
  transferir_silencioso | finalizar | finalizar_silencioso) com `rotuloAcaoSemResposta`.
- `src/components/bot/FluxosPainel.tsx`: campos no formulário do fluxo (o de finalização só
  aparece com "Mostrar na finalização" ligado) e gravação das novas colunas.
- `src/lib/bot-dados.server.ts` / `src/lib/bot-motor.ts`: carregar os novos campos junto dos fluxos.
- `src/lib/bot.server.ts`:
  - `iniciarFinalizacao`: a espera passa a ser `fluxo.finalizacao_delay_minutos` quando maior que 0,
    caindo para `config.finalizacao_delay_minutos` no fluxo padrão; grava `finalizacao_fluxo_em`
    quando houver espera.
  - `verificarInatividade`: o bloco do fluxo de finalização deixa de exigir o delay global e passa a
    comparar `finalizacao_fluxo_em` com o tempo do fluxo gravado no contexto da conversa
    (`ctx.fluxoFinalizacaoId`, novo campo, com o fluxo padrão como fallback).
  - Novo bloco na mesma rotina: busca conversas com fluxo em andamento (`contexto->fluxo` não nulo)
    e `ultima_mensagem_em` mais antigo que `sem_resposta_minutos` do fluxo corrente; envia a
    mensagem opcional e executa a ação reaproveitando as funções já existentes
    (`iniciarFluxo`/`entregarFluxo`, `transferir`, `finalizar`), registrando auditoria
    `bot_fluxo_sem_resposta`. Marca `ctx.semRespostaEm` para não repetir a ação na mesma parada.
- `src/integrations/supabase/types.ts` é regenerado pela migração.
