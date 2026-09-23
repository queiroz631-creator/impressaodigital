# Backup Impressão Digital — Windows V6.4.3

## Novidades da V6.4.3

### Botão "Gerar backup agora"

Agora é possível pedir uma cópia nova do banco sem esperar o agendamento:

1. Clique em **Gerar backup agora** e confirme.
2. O programa pede ao servidor para executar o script de backup.
3. A barra de status mostra o andamento informado pelo servidor.
4. Quando o servidor conclui, o arquivo novo é baixado automaticamente para a
   pasta local, com a barra de progresso normal.

Situações tratadas com mensagem clara (sem travar o programa):

- já existe um backup em andamento no servidor — o programa acompanha o mesmo;
- o script falha no servidor — mostra o motivo informado;
- passou de 1 hora de espera — avisa e sugere usar **Atualizar lista** depois;
- servidor antigo sem a rota nova — avisa que não aceita backup sob demanda.

Enquanto a geração está em curso, os botões de gerar e de baixar ficam
desabilitados.

### Correção do backup automático

A verificação automática chamava um método inexistente e falhava em silêncio;
agora o download automático de um backup novo funciona de fato.

## Servidor de backup

O código do servidor está em `servidor/app.py` (Flask), apenas como referência.
Rotas usadas pelo programa:

| Rota | Uso |
| --- | --- |
| `GET /health` | teste de conexão |
| `GET /api/backups` | lista dos arquivos disponíveis |
| `POST /api/backups` | inicia um backup (responde `202` com `job_id`, ou `409` se já houver um em andamento) |
| `GET /api/backups/status/<job_id>` | andamento: `AGUARDANDO`, `EXECUTANDO`, `CONCLUIDO`, `ERRO` |
| `GET /api/backups/<arquivo>/download` | download do arquivo |

Todas exigem `Authorization: Bearer <token>`.

Variáveis de ambiente do servidor:

- `BACKUP_API_TOKEN` — token exigido nas rotas (obrigatório);
- `BACKUP_DIR` — pasta dos arquivos `backup-*.tar.gz`;
- `BACKUP_SCRIPT` — script que gera o backup (precisa ser executável);
- `HOST` / `PORT` — endereço de escuta.

## Progresso do download (V6.4.2)

A barra fica visivelmente ativa desde o início.

- Antes da conexão: barra animada.
- Com `Content-Length`: barra percentual de 0% a 100%.
- Sem `Content-Length`: barra animada e o texto mostra os MB recebidos.
- Ao terminar: 100% e mensagem de conclusão.
- Em erro: barra para e o erro aparece na tela.

## Gerar o executável

Rode `gerar_exe.bat` e substitua o programa instalado na máquina da loja.
