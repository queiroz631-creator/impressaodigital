# Ajustes no Bot: primeiro contato, respostas automáticas e fluxos

Mantém todas as configurações atuais e o layout existente. Apenas os campos e comportamentos
descritos abaixo mudam.

## 1. Primeiro contato

- **Uma mensagem só por atendimento**: hoje a triagem roda a cada mensagem enquanto a conversa
  fica na etapa "inicio", então o cliente que manda várias mensagens seguidas (ou vários arquivos)
  recebe a saudação repetida. Passa a registrar no contexto da conversa qual regra já respondeu
  neste atendimento; se a mesma regra combinar de novo, o bot executa a ação (ou fica em silêncio)
  sem repetir o texto.
- **Tempo de espera antes da mensagem**: novo campo "Esperar antes de enviar (segundos)" na regra,
  separado da espera já existente antes da ação. Teto de 60s, igual aos demais.

## 2. Respostas automáticas

- **Texto da pergunta de confirmação por resposta**: hoje "Você quer falar sobre *X*?" está fixo no
  código. Passa a ser um campo em **cada resposta automática**, já preenchido com a frase padrão
  (`Você quer falar sobre *{titulo}*?`) e editável individualmente. Em branco, usa o padrão.
- **Reconhecer a resposta depois de uma mensagem errada**: sem alteração, continua como está hoje.
- **Resposta com imagem**: cada resposta automática ganha tipo (texto, imagem, texto + imagem),
  upload da imagem no mesmo bucket `bot-midia` já usado pelas etapas de fluxo, e envio pela Z-API
  com legenda — mesma mecânica das etapas.

Observação: entendi "resposta rápida" como as **Respostas automáticas** (não existe outra aba com
esse nome). Se for outra coisa, é só avisar.

## 3. Fluxos

- **Garantir que a mensagem saiu**: hoje o envio para a Z-API é disparado uma vez e, se a API
  responde com erro ou falha de rede, a conversa segue em frente como se tivesse enviado — é aí que
  o cliente fica sem receber a mensagem do fluxo ou da resposta automática. Passa a: conferir a
  resposta da Z-API, tentar de novo (até 3 tentativas, com intervalo curto) quando falhar, marcar a
  mensagem como erro no histórico e registrar na auditoria. O avanço da etapa/ação só acontece
  depois que o envio foi confirmado; se todas as tentativas falharem, o bot não avança o estado,
  para poder reenviar na próxima interação em vez de pular a etapa.

- **Sim/Não com opção para cada resposta**: quando o tipo de resposta esperada for Sim/Não, o
  configurador passa a mostrar dois blocos fixos (SIM e NÃO), cada um com sua própria ação e
  destino (próxima etapa, etapa específica, outro fluxo, atendente, finalizar). São gravados como
  as opções que já existem hoje, com valores `sim` e `nao`, e o motor aceita variações
  (sim, s, isso, não, nao, n) além do número.
- **Fim dos blocos "fluxo inicial" e "fluxo de arquivos"**: as marcações saem da tela de Fluxos e
  do banco; quem decide qual fluxo começa é a aba Primeiro contato.

## 4. Comportamento com arquivos

- Com os blocos acima removidos, arquivo recebido no primeiro contato passa a ser tratado só pelas
  regras (só arquivos / arquivos + palavras-chave). Sem regra que combine, o bot fica em silêncio
  aguardando, em vez de iniciar um fluxo por conta própria.
- Dentro de um fluxo, o recebimento continua como hoje (etapas de receber/analisar arquivos e a
  etapa "aguardando_arquivos" do orçamento), incluindo a contagem de páginas.

## 5. Explicação do "tipo de resposta esperada"

Ao final, explico no chat, em texto, o que cada tipo faz (Nenhuma, Texto, Número, Arquivo, CPF,
Nome, Telefone, Sim/Não, Escolha de opção, Confirmação) e como ele se combina com "Como avança" e
com as opções da etapa.

## Detalhes técnicos

- Migração: `bot_primeiro_contato.delay_mensagem_segundos` (int, default 0);
  `bot_respostas.tipo_midia` (text default 'texto'), `midia_url`, `midia_nome`,
  `pergunta_confirmacao` (text, default '');
  `ALTER TABLE bot_fluxos DROP COLUMN inicial, DROP COLUMN fluxo_arquivos`.
- `src/lib/bot.server.ts`: contexto ganha `regraEnviada`; `triagem` aplica o não-repetir e a espera
  antes da mensagem; a pergunta de confirmação vem da própria resposta (fallback para a frase
  padrão); envio de mídia nas respostas automáticas reaproveita o `responder(..., midia)`;
  `enviarZap`/`responder` passam a checar o retorno da Z-API, repetir até 3 vezes e devolver
  sucesso/falha, com a entrega do fluxo interrompendo o avanço quando o envio falhar.
- `src/lib/bot-fluxos-motor.ts`: `escolherOpcaoDaEtapa` reconhece sim/não via `simOuNao`; remoção de
  `fluxoInicial`/`fluxoDeArquivos` e ajuste dos pontos que os usavam (`fluxo_inicial` nas ações vira
  "iniciar fluxo" com destino obrigatório).
- `src/lib/bot-fluxos.ts` e `src/lib/bot-motor.ts`: tipos e catálogos correspondentes.
- UI: `PrimeiroContatoPainel.tsx` (novo campo de espera), `RespostasPainel.tsx` (mídia e pergunta de
  confirmação), `FluxosPainel.tsx` (remoção dos selos), `FluxoConfigurador.tsx` (blocos SIM/NÃO)
  — sem mudança de layout, só campos.
- Nada é alterado em calculadora, orçamentos, pedidos, currículo ou clientes.
