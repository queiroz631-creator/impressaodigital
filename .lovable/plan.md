# Botão "Gerar backup agora" no programa de backup

O arquivo que você enviou (`app.py`, servidor de backup em Flask) **já tem tudo o que falta**: ele aceita o pedido de gerar backup, roda o script no servidor, acompanha o andamento e disponibiliza o arquivo para download. Então o trabalho aqui é só no programa Windows.

## O que você vai ver

No programa de backup, na linha de botões, entra **Gerar backup agora**:

1. Pede confirmação: "Gerar uma nova cópia do banco no servidor agora?".
2. Envia o pedido ao servidor e mostra "Gerando backup no servidor..." na barra de status.
3. Fica acompanhando o andamento (consulta a cada 5 segundos, até 1 hora).
4. Quando o servidor avisa que concluiu, o arquivo novo é **baixado automaticamente** para a pasta escolhida, com a mesma barra de progresso do download manual.
5. No fim, aviso de sucesso e a lista de backups é atualizada.

Casos tratados com mensagem clara, sem travar o programa:

- Já existe um backup em andamento no servidor → "Já existe um backup em andamento." e o programa passa a acompanhar esse mesmo backup até terminar.
- O script de backup falha no servidor → mostra o motivo que o servidor informou.
- Passou de 1 hora → avisa que o tempo de espera esgotou (o backup pode ainda terminar; basta atualizar a lista depois).
- Servidor antigo, sem a rota nova → "Este servidor de backup não aceita gerar cópia sob demanda".

Enquanto a geração está em curso, os botões de download e o de gerar ficam desabilitados, para não atropelar a operação.

## Detalhes técnicos

Arquivo: `api-local-backup/backup_app_v6_4.py`

- `api_post(url, token, timeout)` — espelha `api_get` (urllib, `Authorization: Bearer`, retorna corpo + status).
- `solicitar_backup(api, token)` → `POST {api}/api/backups`; aceita `202` (novo job) e `409` (já em andamento, reaproveita o `job_id` devolvido); `404/405/501` levantam `BackupSobDemandaIndisponivel`.
- `status_backup(api, token, job_id)` → `GET {api}/api/backups/status/{job_id}`; lê `status` (`AGUARDANDO`, `EXECUTANDO`, `CONCLUIDO`, `ERRO`), `mensagem` e `filename`.
- Novo método `gerar_backup()` na janela: roda em thread; confirma com `messagebox.askyesno`; chama `solicitar_backup`; faz polling com `status_backup` a cada 5 s (limite 1 h), atualizando a barra de status via `ui_queue` com a `mensagem` do servidor; em `CONCLUIDO` envia `("start_download", filename, False)` pela `ui_queue`, reaproveitando todo o download atual; em `ERRO` envia `("error", ...)`.
- Botão `ttk.Button(btns, text="Gerar backup agora", command=self.gerar_backup)` na linha existente (ao lado de "Baixar último backup"); nova flag `self.gerando` desabilita/reabilita os botões de ação via `ui_queue`.
- Tudo logado em `backup.log` com as mensagens em português, como no resto do app.
- `VERSION` → `6.4.3`; `README.md` ganha a seção "Gerar backup sob demanda" (como funciona, rotas usadas, variáveis `BACKUP_SCRIPT`/`BACKUP_DIR` do servidor) e a nota da correção do download automático já aplicada.
- O `app.py` enviado é guardado como referência em `api-local-backup/servidor/app.py`, para o código do servidor não se perder — nenhuma alteração nele.

Não muda: token/login, listagem, download manual, verificação automática, agendamento, `config.json`, nem qualquer parte do sistema web ou do banco. Nada é executado, compilado ou publicado — gerar o novo EXE com `gerar_exe.bat` e atualizar o servidor continuam sendo passos manuais seus.
