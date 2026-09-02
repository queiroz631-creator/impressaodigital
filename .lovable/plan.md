# Mensagem de transferência fora do horário

Hoje a transferência para atendente sempre envia a mesma mensagem (`Transferência para atendente`), sem considerar se a loja está aberta. A mensagem "Fora do horário" existente só é enviada no primeiro contato.

## O que muda

Na aba **Horários** da configuração do bot, um novo bloco:

- Switch: "Mensagem própria ao transferir para atendente fora do horário"
- Campo de texto com a mensagem (aceita `{nome}`, `{telefone}`, `{saudacao}`)
- Botão restaurar padrão, com texto sugerido informando que o atendimento será respondido no próximo horário de funcionamento

Comportamento: quando o bot transferir o atendimento para a fila humana (fluxo, resposta automática, menu, primeiro contato) e o momento estiver fora do horário configurado (respeitando o modo 24 h), o bot envia essa mensagem no lugar da mensagem normal de transferência. Isso vale também para as ações "Transferir para atendente (sem mensagem)": a transferência silenciosa passa a enviar somente a mensagem de fora do horário quando a regra estiver ligada; dentro do horário, a transferência silenciosa continua sem enviar nada. Com o switch desligado, tudo continua exatamente como está hoje.

## Detalhes técnicos

- Migração em `whatsapp_config`: `msg_transferencia_fora_horario text not null default '...'` e `msg_transferencia_fora_horario_ativo boolean not null default false`.
- `src/lib/bot-dados.server.ts` e `src/lib/bot-motor.ts`: carregar/tipar os dois campos.
- `src/lib/bot.server.ts`: `transferir()` passa a receber os dados completos do bot (config + horários) ou o resultado de `dentroDoHorario`, e escolhe a mensagem: fora do horário e flag ligada e texto preenchido → nova mensagem (inclusive nas transferências silenciosas); silencioso dentro do horário → nada; senão → comportamento atual.
- `src/components/ConfiguracaoBot.tsx`: novo bloco na seção Horários, salvando junto com o restante da configuração.
- Simulador (`src/lib/bot.functions.ts`) reflete a mesma regra.
