# Backup Impressão Digital — Windows V6.4.2

Correção da barra de progresso da V6.4.1.

## Progresso do download

A barra agora fica visivelmente ativa desde o início.

- Antes da conexão: barra animada.
- Se a API fornecer `Content-Length`: barra percentual de 0% a 100%.
- Se a API não fornecer `Content-Length`: barra continua animada e o texto mostra os MB recebidos.
- Ao terminar: 100% e mensagem de conclusão.
- Em erro: barra para e o erro aparece na tela.

Todas as funções da V6.4.1 foram mantidas.
