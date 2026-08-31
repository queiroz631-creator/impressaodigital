# Primeiro contato do dia: saudação por tipo de solicitação

Nova configuração no Bot para identificar o que o cliente quer logo na primeira mensagem e
responder com a saudação correspondente, podendo (ou não) iniciar um fluxo. Nenhuma outra
configuração muda e o layout atual é mantido (uma aba a mais no padrão já existente).

## Como o bot passa a agir

Na primeira mensagem de um atendimento, o bot percorre as **Regras de primeiro contato**
na ordem cadastrada e usa a primeira que combinar:

1. **Só saudação** (oi, olá, bom dia...) → envia a saudação cadastrada e aguarda o cliente dizer o que deseja.
2. **Só arquivos** (sem texto reconhecível) → envia a mensagem cadastrada e, conforme a ação,
   pergunta antes (SIM/NÃO) ou já inicia o fluxo de orçamento.
3. **Arquivos + palavras-chave** (ex.: "quanto custa imprimir isso") → envia a mensagem e inicia
   direto o fluxo de orçamento.
4. **Texto com palavras-chave** (sem arquivo) → mensagem + ação configurada.
5. **Qualquer outra coisa** (regra final opcional) → mensagem + ação, ou silêncio se não houver regra.

Cada regra tem sua própria saudação/mensagem. O texto da regra só é enviado no **primeiro contato
do dia**; nos contatos seguintes do mesmo dia o bot pula a saudação e executa direto a ação da regra.

Se nenhuma regra combinar, o comportamento atual continua: procura resposta automática
(pergunta "Você quer falar sobre X?" com SIM/NÃO) e, sem reconhecimento, aguarda —
com o fallback por tempo iniciando o fluxo inicial como hoje.

## Campos de cada regra

- Nome, ativo, ordem (subir/descer).
- **Condição**: só saudação · só arquivos · arquivos + palavras-chave · texto com palavras-chave · qualquer mensagem.
- **Palavras-chave** (quando a condição usa palavras).
- **Mensagem** (a saudação correspondente àquele tipo de solicitação).
- **Ação**: apenas enviar a mensagem e aguardar · perguntar SIM/NÃO e então iniciar fluxo ·
  iniciar fluxo direto · enviar uma resposta automática · transferir para atendente · finalizar.
- **Destino** (fluxo ou resposta automática) e **espera em segundos** antes da ação.

## Segunda mensagem dos fluxos: removida

- O campo "mensagem 2 / retorno no mesmo dia" sai do cadastro de fluxo e das etapas, e as colunas
  são removidas do banco. Cada fluxo/etapa passa a ter um texto único.
- A diferenciação "1ª conversa do dia" passa a ser responsabilidade das regras de primeiro contato.
- As respostas automáticas continuam exatamente como estão hoje.

## Tela

- Nova aba **Primeiro contato** na página do Bot, no mesmo padrão visual das abas Fluxos/Respostas:
  cabeçalho com botão **+ ADICIONAR REGRA**, lista de cards (nome, condição, prévia da mensagem,
  ação, selo Ativo/Inativo) com editar, subir/descer, duplicar, ativar/desativar e excluir.
- Diálogo de edição com os campos acima.
- O **Simulador** existente passa a considerar as regras, sem mudanças visuais.
- Nas telas de Fluxos e do Configurador de fluxo, apenas o campo da segunda mensagem é retirado.

## Detalhes técnicos

- Migração: tabela `bot_primeiro_contato` (nome, condicao, palavras text[], mensagem, acao,
  destino_fluxo_id, destino_resposta_id, delay_segundos, ordem, ativo) com RLS + GRANTs no padrão
  do projeto; seed com as três regras descritas acima a partir do comportamento atual
  (fluxo de arquivos já marcado em `bot_fluxos.fluxo_arquivos`).
  `ALTER TABLE bot_fluxos DROP COLUMN mensagem_retorno_dia` e
  `ALTER TABLE bot_fluxo_etapas DROP COLUMN mensagem_retorno_dia`.
- `src/lib/bot-motor.ts`: tipo `RegraPrimeiroContato`.
- `src/lib/bot-dados.server.ts`: carregar as regras junto dos demais dados do bot.
- `src/lib/bot.server.ts`: em `triagem()`, avaliar as regras antes da busca por resposta automática;
  enviar a mensagem só quando for o 1º contato do dia (`saudacao_em`); confirmação SIM/NÃO reaproveita
  o estado de triagem já existente; ações reutilizam `executarAcaoResposta`.
- `src/lib/bot-fluxos.ts`, `bot-fluxos-motor.ts`, `FluxosPainel.tsx`, `FluxoConfigurador.tsx`:
  remoção do campo de mensagem de retorno.
- Novos: `src/components/bot/PrimeiroContatoPainel.tsx` (+ diálogo) e ajuste de abas em
  `src/components/ConfiguracaoBot.tsx`.
- Sem alterações em cálculo de orçamento, currículo, pedidos, Z-API ou qualquer área não relacionada.
