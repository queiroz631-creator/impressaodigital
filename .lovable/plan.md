# Transformar a API local em executável Windows com tela de configuração

## Objetivo
Gerar um `api-local.exe` único para Windows que roda na máquina da loja, com uma **tela de configuração** (sem precisar editar arquivos manualmente) para informar conexão do SQL Server, tokens e endereço do sistema.

## Como vai funcionar
1. Lojista executa `api-local.exe` (duplo clique).
2. Na primeira execução (ou quando faltar configuração), o programa abre automaticamente uma **tela de configuração** no navegador, em endereço local (`http://127.0.0.1:8787/configuracao`), acessível somente na própria máquina.
3. A tela permite preencher/editar:
   - SQL Server: servidor, porta, banco, usuário, senha, driver, timeout;
   - Sistema: endereço (URL) e token interno;
   - API local: token local, porta, tamanho do lote, intervalos;
   - Botão **"Testar conexão com o SQL Server"** (valida sem salvar);
   - Botão **"Salvar"** → grava o arquivo `.env` ao lado do `.exe` e (re)inicia o serviço.
4. Com configuração válida, o executável sobe a API normalmente (mesmas rotas atuais: `/health`, `/api/sync/*`) e mantém uma **tela de status** simples (`http://127.0.0.1:8787/`) mostrando: API no ar, conexão com SQL Server OK/erro, última sincronização, endereço do sistema configurado — **sem exibir senha ou token**.
5. Porta padrão da API: 8787 (configurável na tela).

## Mudanças no código (somente dentro de `api-local/`)
1. **`api-local/run.py`** (novo): ponto de entrada do executável
   - Inicia o uvicorn programaticamente (`uvicorn.Server`) servindo `app.main:app` em `127.0.0.1` na porta configurada;
   - Se não houver configuração válida, abre o navegador na tela de configuração;
   - Trata encerramento limpo (Ctrl+C / fechar janela).
2. **`api-local/app/routes/configuracao.py`** (novo): rotas da tela, **somente em localhost**:
   - `GET /configuracao` — página HTML da tela (campos preenchidos com valores atuais, senha/token mascarados);
   - `GET /` — página de status (API, SQL Server, última sincronização lida do estado local);
   - `POST /configuracao/testar-sql` — testa a conexão e devolve só OK/erro amigável;
   - `POST /configuracao/salvar` — valida campos e grava `.env` ao lado do executável.
   - Proteção: as rotas de configuração só aceitam conexão de `127.0.0.1`; salvamento exige o token local **se já existir** configurado (primeira configuração é livre, pois só roda na própria máquina).
3. **`api-local/app/config.py`**: ajuste para procurar o `.env` **ao lado do executável** quando empacotado (`sys.executable`) e ao lado do projeto em desenvolvimento; recarregar configuração após salvar.
4. **`api-local/app/utils/estado.py`**: pasta `estado/` criada ao lado do executável (caminho resolvido da mesma forma).
5. **`api-local/requirements.txt`**: adicionar `pyinstaller` (somente para gerar o exe; não é dependência de execução).
6. **`api-local/build-exe.bat`** (novo): script de um clique para gerar o executável na máquina Windows:
   - cria ambiente virtual, instala dependências, roda `pyinstaller --onefile --name api-local --hidden-import ... run.py`;
   - hidden imports necessários: `uvicorn.logging`, `uvicorn.loops.auto`, `uvicorn.protocols.*`, `uvicorn.lifespan.*`, `pyodbc`, `app.*`;
   - inclui a pasta de templates/estáticos da tela via `--add-data`.
7. **`api-local/README.md`**: nova seção "Gerar o executável Windows" (pré-requisito: ODBC Driver 18 instalado na máquina da loja; como gerar; como rodar; onde ficam `.env` e `estado/`).

## Observações importantes
- O **Microsoft ODBC Driver 18 for SQL Server** precisa estar instalado na máquina da loja — não é possível embuti-lo no `.exe`. Isso já está no README e será destacado.
- Senha e tokens ficam somente no `.env` local da máquina da loja; a tela nunca exibe os valores salvos por completo (mascarados) e nada disso vai para logs.
- Nenhuma regra de sincronização, validação, fila ou rotas existentes será alterada — apenas empacotamento + tela de configuração/status.
- Não consigo gerar o `.exe` para Windows aqui no ambiente (o empacotador gera executável apenas para o sistema onde roda); entrego o projeto pronto com o `build-exe.bat` que gera o `.exe` com um clique na máquina Windows da loja (ou qualquer Windows com Python 3 instalado).

## Fora do escopo
- Não alterar rotas de sincronização, serviços, repositórios ou regras das Etapas 4/5/6.
- Sem serviço do Windows (rodar como serviço pode ser uma etapa futura), sem autoatualização, sem instalador.
- Sem testes, commit, push, deploy ou publicação.

## Verificação
- Conferir que o código novo não quebra o projeto web (arquivos novos ficam isolados em `api-local/`).
- Revisão estática do Python (sintaxe/imports) sem executar testes funcionais.
