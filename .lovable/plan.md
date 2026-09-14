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

1. **Respostas rápidas funcionam sem fluxo cadastrado.** Quando a conexão não
   tiver fluxo inicial ativo, o bot passa a usar o mesmo caminho de primeiro
   contato/confirmação: reconhece a palavra-chave, envia a pergunta de
   confirmação com SIM/NÃO, e no SIM envia a mensagem da resposta e executa a
   ação configurada (atendente, finalizar, outra resposta, fluxo).
2. **Nunca enviar mensagem em branco.** Se não houver texto a enviar (menu sem
   opções, por exemplo), o bot não envia nada em vez de mandar uma mensagem
   vazia.
3. **Palavra-chave continua valendo depois do aviso de fora do horário.**
   Quando o cliente escreve algo que combina com uma resposta rápida, o bot
   responde mesmo que o atendimento tenha ficado "aguardando" por causa do
   aviso de ausência, sem interferir em conversas já assumidas por um
   atendente.
4. Tudo continua isolado por conexão: as configurações lidas e gravadas são
   sempre as da conexão da conversa.

## Detalhes técnicos

- `src/lib/bot.server.ts`, em `atenderMensagem`: quando `fluxoInicial(fluxos)`
  for nulo, chamar `triagem`/`resolverTriagem` (etapas `inicio`, `triagem`,
  `finalizado`) em vez de cair direto em `processarMenu`; manter
  `processarMenu` apenas para as etapas de menu já existentes.
- `responder`: não enviar quando o texto estiver vazio e não houver mídia nem
  botões (hoje envia só o cabeçalho).
- Bloco de ausência (~linha 1775): quando `ehRespostaRapida` for verdadeiro,
  seguir para a triagem em vez de encerrar por causa do status `aguardando`,
  desde que a conversa não esteja com atendente humano (`em_atendimento`).
- Sem mudanças de banco, de credenciais ou de outros módulos.

## Verificação

- Enviar "Currículo" pelo número da Queiroz Papelaria e conferir que chega a
  pergunta de confirmação com SIM/NÃO e, no SIM, a mensagem "Vamos te vender
  muito!" e a transferência para atendimento.
- Repetir fora do horário e dentro do horário.
- Conferir que o número principal continua funcionando igual (fluxos e menu).
- Conferir que nenhuma mensagem vazia é registrada na conversa.
- Rodar verificação de tipos, lint e build. Sem commit e sem push.
