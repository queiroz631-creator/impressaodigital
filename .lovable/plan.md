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

- **Texto da pergunta de confirmação**: hoje "Você quer falar sobre *X*?" está fixo no código.
  Vira uma mensagem configurável na aba Mensagens (com `{titulo}` como variável), mantendo o texto
  atual como padrão.
- **Reconhecer a resposta depois de uma mensagem errada**: hoje, se o cliente responde algo que não
  é SIM/NÃO, o bot descarta a pergunta e volta para a triagem. Passa a manter a pergunta pendente:
  se a nova mensagem também não for SIM/NÃO nem casar com outra regra/resposta, o bot reenvia
  (uma única vez) a pergunta pendente e continua aceitando o SIM/NÃO no turno seguinte.
- **Resposta com imagem**: cada resposta automática ganha tipo (texto, imagem, texto + imagem),
  upload da imagem no mesmo bucket `bot-midia` já usado pelas etapas de fluxo, e envio pela Z-API
  com legenda — mesma mecânica das etapas.

Observação: entendi "resposta rápida" como as **Respostas automáticas** (não existe outra aba com
esse nome). Se for outra coisa, é só avisar.

## 3. Fluxos

- **Nunca ficar mudo**: quando a etapa não entende a resposta, o motor devolve "não entendi" sem
  nenhuma mensagem e a entrega ignora isso — é o caso em que o bot fica calado. Passa a reenviar a
  mensagem da etapa com as opções, precedida da mensagem "não entendi" já configurada. Também
  quando uma etapa não tem texto nem mídia e não avança, o bot reenvia a etapa em vez de silenciar.
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
  `bot_respostas.tipo_midia` (text default 'texto'), `midia_url`, `midia_nome`;
  `whatsapp_config.msg_confirmar_resposta` (text, default "Você quer falar sobre *{titulo}*?");
  `ALTER TABLE bot_fluxos DROP COLUMN inicial, DROP COLUMN fluxo_arquivos`.
- `src/lib/bot.server.ts`: contexto ganha `regraEnviada` e `triagemRepetida`; `triagem` e
  `resolverTriagem` aplicam o não-repetir, a espera antes da mensagem, a pergunta configurável e a
  persistência da pergunta pendente; remoção dos ramos `fluxoInicial`/`fluxoDeArquivos`; envio de
  mídia nas respostas automáticas reaproveita o `responder(..., midia)` existente.
- `src/lib/bot-fluxos-motor.ts`: no caso `naoEntendi`, devolver de novo a mensagem da etapa;
  `escolherOpcaoDaEtapa` reconhece sim/não via `simOuNao`; remoção de `fluxoInicial`/`fluxoDeArquivos`
  e ajuste dos poucos pontos que os usavam (`fluxo_inicial` nas ações vira "iniciar fluxo" com
  destino obrigatório).
- `src/lib/bot-fluxos.ts` e `src/lib/bot-motor.ts`: tipos e catálogos correspondentes.
- UI: `PrimeiroContatoPainel.tsx` (novo campo de espera), `RespostasPainel.tsx` (mídia),
  `FluxosPainel.tsx` (remoção dos selos), `FluxoConfigurador.tsx` (blocos SIM/NÃO),
  `ConfiguracaoBot.tsx` (campo da pergunta na aba Mensagens) — sem mudança de layout, só campos.
- Nada é alterado em calculadora, orçamentos, pedidos, currículo ou clientes.
