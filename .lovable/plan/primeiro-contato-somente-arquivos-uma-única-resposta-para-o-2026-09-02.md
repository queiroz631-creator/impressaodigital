# Primeiro contato "Somente arquivos": uma única resposta para o lote

## O que está acontecendo

Quando o cliente envia vários arquivos de uma vez e a regra tem tempo de espera configurado:

- O bot trava a conversa e começa a contar a espera com o primeiro arquivo.
- Os arquivos seguintes chegam durante essa espera e marcam a conversa como pendente de novo.
- Quando a espera termina e a resposta é enviada, o sistema confirma apenas o arquivo que iniciou o processamento. Os arquivos que chegaram no meio ainda constam como não respondidos.
- A fila roda outra vez, encontra esses arquivos, aplica de novo o tempo de espera e envia outra mensagem — uma por arquivo.

## Correção

1. **A espera passa a fazer parte do agrupamento**
   - Depois de cumprir o tempo configurado na regra, o bot relê a última mensagem recebida da conversa antes de enviar.
   - Os arquivos que chegaram durante a espera entram no mesmo atendimento, em vez de gerarem uma nova resposta.

2. **Confirmar todo o lote, não só a mensagem inicial**
   - Ao concluir o tratamento, o sistema marca como processada a mensagem de entrada mais recente naquele momento (e não apenas a que disparou a execução).
   - Assim as passadas seguintes da fila não encontram "sobras" do mesmo envio.

3. **Trava de repetição da regra de primeiro contato**
   - A regra acionada fica registrada com o horário do envio.
   - Se a mesma regra combinar de novo dentro de uma pequena janela (tempo de espera + margem), o bot não repete a mensagem; apenas registra os arquivos.
   - Regras diferentes e mensagens de texto continuam funcionando normalmente.

4. **Validação**
   - 1 arquivo: uma resposta, respeitando o tempo configurado.
   - 5 arquivos enviados juntos: uma única resposta, com todos os arquivos contabilizados.
   - Arquivos enviados já dentro de um fluxo: comportamento inalterado.

## Escopo técnico

- `src/lib/bot.server.ts`: mover/reavaliar a mensagem alvo após a espera da regra, confirmar `ultimaProcessada` com a última entrada no fim do processamento (tanto no caminho do webhook quanto na fila) e adicionar a janela anti-repetição por regra no contexto da conversa.
- Sem mudanças no banco, no cadastro das regras, no layout ou nos demais módulos.
