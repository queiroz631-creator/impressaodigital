# Primeiro contato: regras em sequência + opção "Uma vez por atendimento"

Duas mudanças na aba **Primeiro contato** do Bot.

## 1. Uma regra diferente pode responder logo depois da primeira

Hoje, quando a primeira regra é acionada (por exemplo a saudação), a conversa segue para o
fluxo ou fica aguardando SIM/NÃO — e um arquivo enviado logo em seguida não dispara outra
regra de primeiro contato.

Passa a funcionar assim:

- Depois que uma regra de primeiro contato é acionada, abre-se uma **janela de sequência**:
  as próximas mensagens do cliente continuam sendo avaliadas pelas regras.
- Nessa janela, se o cliente mandar um arquivo (ou um texto com palavras-chave), o bot aciona
  a regra correspondente — enviando a mensagem dela e executando a ação (resposta automática,
  iniciar fluxo, etc.).
- **Nunca repete a mesma regra**: só uma regra *diferente* da que acabou de rodar pode ser
  acionada dentro da janela. Se a mensagem combinar de novo com a mesma regra, nada é
  reenviado e o atendimento segue como está hoje.
- A janela fecha quando um fluxo é efetivamente iniciado, quando o cliente responde SIM a uma
  confirmação, ou quando a conversa é transferida/finalizada.
- Se nenhuma regra diferente combinar, a mensagem segue o caminho atual (confirmação pendente
  ou etapa do fluxo).

Exemplo: cliente manda "oi" → regra de saudação responde → cliente manda o PDF → a regra
"Somente arquivos" responde e inicia o orçamento.

## 2. Nova opção em "Enviar a mensagem"

O seletor da regra passa a ter três opções (as duas atuais continuam iguais):

1. **Sempre** — envia toda vez que a regra combinar.
2. **Uma vez por atendimento** (nova) — envia só na primeira vez que a regra combinar naquele
   atendimento; nas próximas, executa a ação em silêncio. Ao finalizar o atendimento, volta a
   poder enviar.
3. **Somente no 1º contato do dia** — inalterado.

Regras já cadastradas continuam com o valor atual.

## Tela

- Diálogo de edição da regra: nova opção **Uma vez por atendimento** no seletor
  "Enviar a mensagem".
- Card da regra: selo discreto "1x por atendimento" quando essa opção estiver escolhida
  (o selo "1º contato do dia" continua igual).
- Nenhuma outra mudança de layout.

## Detalhes técnicos

- Banco: `bot_primeiro_contato.enviar_mensagem` passa a aceitar `uma_vez_atendimento`
  (ajuste do CHECK; sem migração de dados).
- `src/lib/bot-fluxos.ts`: nova entrada em `ENVIOS_PRIMEIRO_CONTATO`.
- `src/lib/bot-motor.ts`: `escolherRegra` ganha parâmetro opcional `ignorarId` para excluir a
  última regra acionada; tipo do campo `enviar_mensagem` atualizado.
- `src/lib/bot.server.ts`:
  - contexto passa a guardar `ultimaRegra` (id da última regra acionada) e um marcador de
    janela aberta;
  - em `rodarFluxo`, antes de `resolverTriagem` e antes de processar a etapa do fluxo: com a
    janela aberta, roda `escolherRegra(..., { ignorarId: ctx.ultimaRegra })`; se combinar,
    chama `triagem` com essa regra; senão segue o caminho atual;
  - a janela fecha em `executarAcaoRegra`/`entregarFluxo` quando a ação inicia fluxo,
    transfere ou finaliza, e quando o cliente confirma SIM;
  - a trava `regraEnviada` passa a valer apenas quando
    `enviar_mensagem === "uma_vez_atendimento"`; `sempre` volta a enviar em toda combinação
    (a fila/lock já evitam duplicidade numa rajada); `primeira_do_dia` inalterado.
- Simulador (`src/lib/bot.functions.ts`): mesmas regras de janela e de envio.
- Sem mudanças em fluxos, respostas automáticas, orçamento, currículo, pedidos ou Z-API.
