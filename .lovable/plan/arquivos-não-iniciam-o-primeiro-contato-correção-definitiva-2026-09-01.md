# Arquivos não iniciam o primeiro contato — correção definitiva

## O que os dados mostram

Verifiquei a conversa dos testes de hoje (17:14 às 17:18):

- As imagens e o PDF foram registrados normalmente na conversa.
- A saudação foi marcada (o motor chegou a iniciar a triagem), mas **nenhuma mensagem de saída foi criada**, nem registro de falha de envio, nem erro no histórico: a execução simplesmente parou no meio.
- Sinal decisivo: quase todos os arquivos recebidos ficaram **sem cópia no armazenamento** (`storage_path` vazio). Essa cópia é a última etapa do webhook, ou seja, a requisição foi encerrada antes de terminar.
- Causa: hoje toda a resposta acontece dentro da requisição do provedor. Para arquivos o caminho soma a espera de agrupamento, a espera da trava e as esperas configuradas na regra (3s + 3s). A conexão do provedor cai antes disso e o processo é interrompido. Para texto a regra tem espera zero, por isso funciona.

Segundo problema confirmado, específico de PDF/Word: quando o documento vem **sem legenda**, o webhook usa o **nome do arquivo** como texto da mensagem (ex.: "Doc 0001.pdf"). A regra **Somente arquivos** exige mensagem sem texto, então ela não é escolhida e nenhuma outra regra combina — o bot fica em silêncio mesmo se a execução terminasse.

## Alterações

1. **Tirar a resposta do bot de dentro da requisição do provedor**
   - O webhook passa a apenas registrar a mensagem, o arquivo e marcar a conversa como "com mensagem pendente para o bot", respondendo na hora.
   - Uma nova rotina interna processa as conversas pendentes: pega a trava, escolhe a mensagem mais recente, respeita as esperas configuradas e envia a resposta sem risco de ser interrompida.
   - Essa rotina roda automaticamente a cada poucos segundos pelo agendador que já existe no projeto (mesmo mecanismo da rotina de inatividade), com o mesmo token de segurança.
   - A cópia da mídia para o armazenamento privado passa a ser feita nessa rotina, deixando o webhook curto e estável.

2. **Documento sem legenda conta como "somente arquivo"**
   - O texto da mensagem passa a usar apenas a legenda real. O nome do arquivo continua guardado e aparecendo no resumo da conversa, mas não é mais tratado como se o cliente tivesse escrito algo.
   - Assim, PDF/Word sem legenda cai na regra **Somente arquivos**, e com legenda continua caindo em **Arquivos + palavras‑chave**.

3. **Agrupar vários arquivos em uma única resposta**
   - Mantém a trava por conversa e a marcação da última mensagem processada, agora aplicadas na rotina: várias imagens enviadas juntas geram uma resposta só.

4. **Validação**
   - Uma imagem sem legenda: dispara **Somente arquivos** com a pergunta SIM/NÃO.
   - Várias imagens juntas: uma única resposta.
   - PDF sem legenda: mesma regra. PDF com legenda contendo palavra‑chave: regra de arquivos + palavras‑chave.
   - Texto e saudação continuam funcionando como hoje.
   - Conferir que os arquivos passam a ficar com cópia no armazenamento.

## Escopo técnico

- `src/routes/api/public/whatsapp/webhook.ts`: registra e enfileira; sem chamada ao motor e sem download da mídia; legenda de documento sem cair para o nome do arquivo.
- Nova rota `src/routes/api/public/whatsapp/fila.ts`: drena as conversas pendentes (autenticada pelo token do webhook).
- `src/lib/bot.server.ts`: função de drenagem da fila reaproveitando trava, seleção da mensagem mais recente e confirmação após a resposta.
- Migração: colunas de controle da fila em `whatsapp_conversas` e agendamento da nova rotina no agendador interno.
- Sem mudanças no layout, na calculadora, em pedidos ou em currículos.
