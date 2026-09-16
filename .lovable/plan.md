# Corrigir o aviso "A API local não conseguiu iniciar. Detalhe: 1"

## O que está acontecendo

O programa da loja abre a interface e, ao mesmo tempo, sobe o serviço interno na porta 8100 (127.0.0.1). Quando essa porta já está ocupada — quase sempre porque **outra cópia do programa já está rodando** (ícone na área de notificação) ou porque o **serviço do Windows "Lojamix Sync" está instalado e ativo** — a subida falha imediatamente e devolve apenas o código `1`. Daí a mensagem sem explicação: "Detalhe: 1".

Ou seja: não é falha de banco, de token ou de rede. É porta ocupada (ou, mais raramente, porta bloqueada/sem permissão).

## Correção proposta (somente em `api-local/`)

1. **Checar a porta antes de subir**: se já houver algo respondendo em `127.0.0.1:<porta>`, o programa verifica se é o próprio Lojamix Sync (consulta o `/health`).
   - Se for o próprio: a interface abre normalmente em modo "acompanhar", usando o serviço que já está no ar — sem erro nenhum.
   - Se for outro programa: mensagem clara em português, dizendo a porta ocupada e orientando trocar a porta na aba de configuração.
2. **Mensagem de erro compreensível**: nunca mais exibir só um número. O aviso passa a nomear a causa provável (porta em uso, permissão negada, porta inválida) e o que fazer.
3. **Evitar duas cópias abertas**: trava simples de instância única — abrir o programa de novo apenas traz a janela existente para a frente, em vez de tentar subir um segundo serviço.
4. **Aba de configuração**: ao salvar uma porta, avisar na hora se ela já está ocupada, antes de reiniciar.

## Fora do escopo

- Nada muda no site, no banco de dados ou nas rotas de recebimento.
- Nada muda nas consultas ao SQL Server, na sincronização de notas/clientes nem nos marcadores.
- Sem dados fictícios, sem testes, sem commit, push ou publicação.

## Detalhes técnicos

- `api-local/launcher.py`: antes de `uvicorn.Server.run`, testar `socket.connect_ex(("127.0.0.1", porta))`; se aberta, `GET /health` para identificar a própria API e entrar em modo anexado (não inicia worker nem servidor). `SystemExit`/`OSError` do uvicorn traduzidos por código (`EADDRINUSE`, `EACCES`) em texto explicativo.
- Trava de instância única via arquivo de lock ao lado do `estado.json` (ou socket bindado num porta-lock local), liberado no `close()`.
- `api-local/gui/main.py`: `show_startup_error` recebe texto já traduzido; validação de porta ocupada ao salvar em `api_local_port`.
- Nenhuma alteração em `app/services/*`, `app/routes/*` ou `app/sql_store.py`.
