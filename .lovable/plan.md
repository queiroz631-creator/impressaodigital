# Fazer o bot da segunda conexão responder às respostas rápidas

## O que está acontecendo (confirmado nos dados)

Na conversa da Queiroz Papelaria (número 5527988513393), cada vez que o cliente
escreveu "Currículo" o bot respondeu com uma mensagem **vazia** (só o rótulo
"mensagem do bot"), e a pergunta de confirmação da resposta rápida nunca foi
enviada. Em outras tentativas o bot mandou apenas o aviso de fora do horário e
depois ficou calado.

Dois motivos, ambos confirmados no código e no banco:

1. A pergunta de confirmação das respostas rápidas só é usada quando a conexão
   tem um **fluxo inicial ativo**. A Queiroz Papelaria não tem nenhum fluxo
   cadastrado, então o bot vai para o caminho do "menu" antigo. Como essa
   conexão também não tem opções de menu, o menu sai vazio — é a mensagem em
   branco que o cliente recebeu.
2. Depois de enviar o aviso de fora do horário, o atendimento passa para
   "aguardando". Nesse estado o bot para de responder, então a mensagem
   seguinte com a palavra-chave também fica sem resposta.

A conexão principal não mostra o problema porque ela tem fluxos e opções de
menu cadastrados.

## O que será feito

Regra principal: a conexão que já tem fluxo inicial ativo (a principal) não
muda em nada. A nova regra é uma exceção que só vale quando a conexão não tem
fluxo inicial ativo.

1. **Mapear antes de mexer.** Registrar o caminho atual de cada estado
   (inicio, triagem, finalizado, menu, aguardando, em_atendimento) e conferir,
   depois da mudança, que cada um continua igual quando existe fluxo inicial.
2. **Exceção para conexão sem fluxo inicial.** Nessa situação o bot primeiro
   procura uma resposta rápida pela palavra-chave; se encontrar, inicia a
   confirmação (pergunta com SIM/NÃO e, no SIM, a mensagem e a ação
   configurada). Se não encontrar, segue exatamente o comportamento atual.
3. **Nunca enviar mensagem em branco.** Sem texto para enviar (menu sem
   opções, por exemplo), o bot não envia nada.
4. **Atendimento humano intocado.** A exceção nunca assume uma conversa em
   atendimento humano e não altera as regras de transferência.
5. **Sempre por conexão.** O reconhecimento da palavra-chave usa apenas as
   respostas rápidas da conexão da conversa.

## Detalhes técnicos

- `src/lib/bot.server.ts`, `atenderMensagem`: no bloco de fluxos, quando
  `fluxoInicial(fluxos)` for nulo e a etapa for `inicio`/`triagem`/`finalizado`,
  chamar `triagem`/`resolverTriagem` antes do caminho de `processarMenu`.
  Quando existir fluxo inicial, o `rodarFluxo` atual continua sendo chamado
  sem alteração.
- `ehRespostaRapida` e a triagem usam `carregarDadosBot(conversa.conexao_id)`,
  garantindo que as respostas rápidas são as da conexão da conversa.
- Bloco de ausência (~linha 1775): a exceção só age quando o status é
  `automatico`, `aguardando` ou `aguardando_finalizacao` — nunca
  `em_atendimento`, `pendente` ou `esperando_impressao`.
- `responder`: não envia quando não há texto, mídia nem botões.
- Sem mudanças de banco, de credenciais ou de outros módulos.


## Verificação

- Enviar "Currículo" pelo número da Queiroz Papelaria e conferir que chega a
  pergunta de confirmação com SIM/NÃO e, no SIM, a mensagem "Vamos te vender
  muito!" e a transferência para atendimento.
- Repetir fora do horário e dentro do horário.
- Conferir que o número principal continua funcionando igual (fluxos e menu).
- Conferir que nenhuma mensagem vazia é registrada na conversa.
- Rodar verificação de tipos, lint e build. Sem commit e sem push.
