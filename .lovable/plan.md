# Corrigir primeiro contato com PDF

## Diagnóstico confirmado

- O PDF recebido às 17:37 chegou **sem legenda** no payload (`document.caption = null`).
- Mesmo assim, a mensagem foi gravada com `texto = "Doc 0001.pdf"`. Por isso ela está sendo tratada como **arquivo + texto**, e não combina com a regra **Somente arquivos**.
- A regra **Arquivos com pergunta de valor** também não combina, pois o nome do PDF não contém nenhuma palavra-chave configurada. O resultado é o bot não iniciar resposta.
- O código atual do webhook já separa legenda e nome do arquivo, mas os registros recentes mostram que a versão que recebeu esses PDFs ainda gravou o comportamento antigo. Também ficou uma trava do bot sem liberação após a tentativa.

## Alterações

1. **Normalizar PDFs antes de escolher a regra**
   - Usar somente a legenda real do documento como texto.
   - Se o texto salvo for igual ao nome do arquivo ou terminar em extensão de documento sem existir legenda no payload, tratá-lo como vazio.
   - Preservar o nome exclusivamente em `arquivo_nome` e no resumo visual da conversa.

2. **Aplicar proteção também na fila**
   - Ao carregar a última mensagem, normalizar documentos antigos ou recebidos por uma versão anterior antes de chamar o motor.
   - PDF sem legenda seguirá **Somente arquivos**; PDF com legenda seguirá **Arquivos + palavras-chave** quando houver correspondência.

3. **Recuperar processamento interrompido**
   - Garantir que uma trava vencida não impeça a retomada da conversa e que ela seja sempre liberada ao concluir ou falhar.
   - Manter a confirmação de mensagem processada somente depois da resposta.

4. **Validar e disponibilizar a correção**
   - Testar PDF sem legenda, PDF com legenda contendo palavra-chave e imagem sem legenda.
   - Confirmar no banco que o PDF sem legenda fica com texto vazio e gera apenas uma resposta.
   - Publicar a versão atualizada, pois o endereço configurado no webhook e na fila usa a aplicação publicada.

## Escopo técnico

- `src/routes/api/public/whatsapp/webhook.ts`: normalização defensiva da legenda de documentos.
- `src/lib/bot.server.ts`: normalização na fila e recuperação segura da trava.
- Sem mudanças nas regras cadastradas, no fluxo de imagens ou no layout.
