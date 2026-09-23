# Corrigir o erro 404 ao clicar em "Gerar backup agora"

## O que está acontecendo

A janela mostra a mensagem crua do servidor: `HTTP Error 404: NOT FOUND`.
O programa já trata bem o caso "o servidor não aceita gerar backup" — então
esse 404 veio de outro ponto do fluxo, e hoje o programa não sabe explicar qual.

Duas causas possíveis (não é possível confirmar daqui, porque o servidor de
backup roda fora deste projeto):

1. O servidor no ar ainda é a versão antiga, sem a rotina de gerar backup
   (o endereço não existe e responde 404 em vez de 405).
2. O servidor novo está no ar, mas rodando em vários processos ao mesmo tempo.
   O pedido é criado em um processo e a consulta de andamento cai em outro, que
   não conhece aquela operação e responde "operação não encontrada" (404).

Nos dois casos o programa deveria dizer o que fazer, em vez de mostrar o texto
técnico.

## O que será feito no programa (api-local-backup)

1. Toda resposta de erro do servidor passa a ser lida e traduzida, nunca mais
   exibida como "HTTP Error 404: NOT FOUND".
2. Ao pedir o backup: se o endereço não existir, a mensagem fica clara —
   "o servidor de backup ainda está na versão antiga; atualize-o para aceitar
   gerar cópia sob demanda".
3. Ao acompanhar o andamento: um 404 isolado logo após o pedido deixa de ser
   erro imediato — o programa tenta de novo algumas vezes; só se insistir é que
   avisa que o servidor perdeu o controle da operação (provável servidor rodando
   em vários processos) e sugere conferir a instalação.
4. Antes de pedir o backup, o programa confere uma vez se o servidor tem a
   rotina; se não tiver, avisa na hora, sem travar os botões.
5. A cada recusa, o motivo real fica gravado no `backup.log`.

## Do lado do servidor (fora deste projeto)

Junto do código de referência em `api-local-backup/servidor/`, ficará anotado no
`README.md`: o serviço precisa rodar com **um único processo** (por exemplo,
`gunicorn --workers 1 --threads 8`), porque o andamento do backup é guardado na
memória do processo. Com mais de um processo, a consulta de andamento falha com
404 mesmo estando tudo correto.

## Não muda

Listagem de backups, download (inclusive a barra de progresso), verificação
automática, ícone na bandeja, início com o Windows e o restante do sistema.

## Detalhes técnicos

- `api_get` passa a capturar `HTTPError`, ler o corpo JSON e devolver
  `(status, dados)`; quem chama decide a mensagem.
- `status_backup` devolve o status HTTP junto dos dados; no laço de polling,
  404 incrementa um contador tolerante (até ~6 tentativas / 30 s) antes de virar
  erro com mensagem explicativa.
- `solicitar_backup` mantém o tratamento de 404/405/501, 401/403 e
  200/201/202/409, agora com fallback de mensagem lida do corpo.
- `VERSION` sobe para 6.4.4 e o `README.md` registra a correção e a exigência de
  processo único no servidor.
- Depois disso é preciso gerar o EXE novo com `gerar_exe.bat` para valer na loja.
