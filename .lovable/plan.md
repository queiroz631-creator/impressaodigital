# Melhoria 20 — Mensagem de ausência (fora do horário)

Hoje a mensagem de "fora do horário" só existe no caso de transferência para atendente. A melhoria faz o bot responder com a mensagem de ausência **sempre que a loja estiver fechada**, em qualquer fila de espera e no lugar da mensagem de primeiro contato — com uma exceção: se a mensagem do cliente combinar com uma **resposta rápida**, a resposta rápida pode ser enviada normalmente.

## O que muda

### 1. Configuração (Configurar Bot → Horários)
- Reativar/reaproveitar o campo existente `msg_fora_horario` + `msg_fora_horario_ativo` na aba Horários, com o rótulo "Mensagem de ausência (fora do horário)".
- Botão para restaurar o texto padrão, igual aos demais campos.

### 2. Comportamento do bot (fora do horário de atendimento)
Quando a mensagem chegar fora do horário configurado e a mensagem de ausência estiver ativa:

- **Resposta rápida tem prioridade**: se o texto combinar com uma resposta automática cadastrada, o bot segue o fluxo normal da resposta rápida (pergunta de confirmação SIM/NÃO etc.).
- **Caso contrário, envia a mensagem de ausência**:
  - no lugar da mensagem de primeiro contato (as regras de primeiro contato não disparam — o cliente recebe a ausência);
  - em qualquer fila de espera: conversas no automático, aguardando, pendente e aguardando finalização;
  - não se aplica a conversas em atendimento humano (`em_atendimento`) nem finalizadas.
- **Uma vez por atendimento**: a mensagem de ausência é enviada apenas uma vez por atendimento fora do horário (marca gravada no contexto da conversa), para não repetir a cada mensagem do cliente; respostas rápidas continuam funcionando mesmo depois do envio.
- Dentro do horário nada muda: primeiro contato, fluxos e filas funcionam como hoje.

### 3. Marcação da melhoria
- Após validar, marcar a melhoria 20 ("Mensagem de ausencia") como `executada = true`, mantendo `status = 'pendente'` (padrão das anteriores).

## Detalhes técnicos

- Arquivos: `src/lib/bot.server.ts` (triage/entrada do bot), `src/lib/bot-dados.server.ts` (já carrega `msg_fora_horario`), `src/components/ConfiguracaoBot.tsx` (aba Horários — reexibir o campo).
- Sem migration: os campos `msg_fora_horario` e `msg_fora_horario_ativo` já existem em `whatsapp_config` (hoje estão ocultos/desativados).
- Verificação de horário: reutilizar `dentroDoHorario(dados, agora)` já existente.
- Reconhecimento de resposta rápida: reutilizar `reconhecerResposta(cfg, texto)` já existente.
- Controle "uma vez por atendimento": nova marca no contexto (`ausenciaEnviada`), limpa quando um novo atendimento inicia (junto com `saudacao_em`).
- Validação: `bunx tsgo --noEmit` + `bun run build:dev`.
- Nenhuma alteração de layout fora do campo reativado; nenhuma mudança nas regras de primeiro contato, fluxos ou inatividade.
