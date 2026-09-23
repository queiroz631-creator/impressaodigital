# Botão "Gerar backup agora" no programa de backup

## O que você vai ver

No programa de backup (Windows), ao lado de "Baixar último backup", entra um botão **Gerar backup agora**:

1. Pede confirmação ("Gerar uma nova cópia do banco no servidor agora?").
2. Pede ao servidor de backup para criar a cópia.
3. Mostra "Gerando backup no servidor..." e fica aguardando (com limite de espera).
4. Quando o arquivo novo aparece na lista, ele é baixado sozinho para a pasta escolhida, com a mesma barra de progresso do download manual.
5. Ao terminar, mostra o aviso de sucesso e atualiza a lista de backups.

Se o servidor recusar o pedido, aparece uma mensagem clara: "Este servidor de backup não aceita gerar cópia sob demanda" — sem travar o programa.

## Ponto importante (precisa da sua decisão / ação)

O servidor `backup.queiroztecno.com.br` **não faz parte deste projeto** — o código dele não está aqui. Você indicou que hoje ele provavelmente só lista e baixa backups já gerados.

Isso significa: o botão fica pronto no programa, mas ele só vai realmente gerar a cópia depois que o servidor de backup passar a aceitar esse pedido. Enquanto isso, o botão vai mostrar a mensagem de "não suportado".

Junto com o botão, deixo escrito no README exatamente o que o servidor precisa oferecer para o botão funcionar (rota, forma de chamar e resposta esperada), para quem cuida daquele servidor aplicar. Se você me der acesso ao código desse servidor, faço a parte dele também num próximo passo.

## Detalhes técnicos

Arquivo: `api-local-backup/backup_app_v6_4.py`

- Nova função `api_post(url, token, timeout)` (urllib, `Authorization: Bearer`), espelhando `api_get`.
- Nova função `solicitar_backup(api, token)` → `POST {api}/api/backups`; trata `404`/`405`/`501` como "não suportado" (exceção própria `BackupSobDemandaIndisponivel`).
- Novo método `gerar_backup()` na janela: roda em thread, guarda a lista de nomes atual, chama `solicitar_backup`, e depois faz polling de `get_backups` (a cada 5s, até 10 min) procurando um nome que ainda não existia (ou o `filename` devolvido pela resposta, quando houver).
- Ao encontrar, reaproveita `start_download(filename)` (mesma barra de progresso, mesma pasta de destino, mesmo tratamento de erro).
- Botão `ttk.Button(btns, text="Gerar backup agora", command=self.gerar_backup)` na linha de botões, desabilitado enquanto uma operação estiver em curso (mesma lógica de `self.busy` já usada).
- Mensagens e logs em português, gravados em `backup.log` como o restante do app.
- `VERSION` → `6.4.3`; `README.md` ganha a seção "Gerar backup sob demanda" com o contrato da rota esperada e a nota da correção do download automático já aplicada.

Não muda: login/token, listagem, download manual, verificação automática, agendamento, `config.json`, nem qualquer parte do sistema web ou do banco. Nada é executado, compilado ou publicado — gerar o novo EXE com `gerar_exe.bat` continua sendo passo manual seu.
