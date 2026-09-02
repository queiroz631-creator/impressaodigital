# Primeiro contato: nova opção "Uma vez por atendimento" em Enviar a mensagem

O campo **Enviar a mensagem** da regra de primeiro contato passa a ter três opções:

1. **Sempre** — envia a mensagem toda vez que a regra combinar (hoje, na prática, ela só envia
   1 vez por atendimento por causa de uma trava interna; essa trava sai desta opção).
2. **Uma vez por atendimento** (nova) — envia a mensagem só na primeira vez que a regra
   combinar naquele atendimento; nas próximas combinações a ação da regra executa em silêncio.
   Ao finalizar o atendimento, a regra pode enviar de novo no próximo.
3. **Somente no 1º contato do dia** — comportamento atual inédito: só envia na primeira
   conversa do dia.

Regras já cadastradas continuam exatamente como estão (padrão "Sempre"); quem quiser o
comportamento de hoje (sem repetição) escolhe "Uma vez por atendimento".

## Tela

- No diálogo de edição da regra (aba **Primeiro contato**), o seletor "Enviar a mensagem"
  ganha a opção **Uma vez por atendimento** entre "Sempre" e "Somente no 1º contato do dia".
- No card da regra, selo discreto "1x por atendimento" quando essa opção estiver escolhida
  (o selo "1º contato do dia" já existe).
- Nenhuma outra mudança de layout.

## Detalhes técnicos

- Banco: o campo `bot_primeiro_contato.enviar_mensagem` passa a aceitar também
  `uma_vez_atendimento` (ajuste do CHECK/valores permitidos, sem migração de dados).
- `src/lib/bot-fluxos.ts`: nova entrada em `ENVIOS_PRIMEIRO_CONTATO` com o rótulo.
- `src/lib/bot-motor.ts`: comentário/tipo do campo atualizado.
- `src/lib/bot.server.ts` (`triagem`): a trava `regraEnviada` passa a valer apenas quando
  `enviar_mensagem === "uma_vez_atendimento"`:
  - `sempre` → envia em toda combinação (mantém o limite de 1 envio por rajada de mensagens,
    garantido pela fila/lock já existentes);
  - `uma_vez_atendimento` → envia só se a regra ainda não enviou neste atendimento
    (regraEnviada, zerada quando a conversa é finalizada — lógica já existente);
  - `primeira_do_dia` → inalterado.
- Simulador (`src/lib/bot.functions.ts`): mesma regra de envio.
- Sem mudanças em fluxos, respostas automáticas, orçamento, currículo ou Z-API.
