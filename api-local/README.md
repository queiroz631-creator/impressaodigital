# Lojamix Sync

Aplicativo Windows para sincronização do Lojamix SQL Server com o sistema.

## Gerar o EXE

No Windows:

1. Extraia esta pasta.
2. Instale Python 3.11 ou superior.
3. Dê duplo clique em `GERAR_EXE.bat`.
4. O arquivo será criado em `build\\LojamixSync.exe`.

O gerador usa PyInstaller `--onefile` e `--windowed`.

O executável único inicia a interface gráfica, a API local e o worker de sincronização no mesmo processo. O `LojamixSyncService.exe` não é gerado por este modo.

### Correção do EXE 1.0.0
Foi corrigido o conflito de logging do Uvicorn quando o executável é gerado com `--windowed`.

## Versão 1.0.1

Interface desktop funcional com botões de Testar SQL Server, Testar Sistema,
Sincronizar Agora e Configurações. O worker também acorda imediatamente
quando uma sincronização manual é solicitada.

## Versão 1.0.2

Correção do modo EXE único: o Uvicorn recebe diretamente o objeto FastAPI,
garantindo o empacotamento correto da API local pelo PyInstaller. A inicialização
da API é verificada antes da interface iniciar e falhas são apresentadas ao usuário.
O token interno da API local é criado automaticamente na primeira execução e
armazenado de forma protegida no Windows.

## Versão 1.0.3

Melhor diagnóstico local de falhas SQL: exceções do SQL Server/ODBC são
sanitizadas e preservadas no status, e a interface possui o botão
"Detalhes do erro" para visualizar a exceção real sem expor senhas ou tokens.

## Versão 1.0.4

Correção da consulta de notas: os limites do período do sorteio agora são
convertidos para `datetime` Python antes de serem enviados ao SQL Server,
evitando o erro ODBC 241 "Conversion failed when converting date and/or time
from character string". Quando a data final é informada somente como
`YYYY-MM-DD`, o limite é exclusivo do dia seguinte, incluindo todo o último dia.

## Versão 1.1.0 — Consultas SQL substituíveis

A interface agora permite editar e salvar as consultas SQL oficiais usadas
na sincronização, sem recompilar o EXE. As consultas ficam em
`%PROGRAMDATA%\\LojamixSync\\sql.json`.

Consultas configuráveis:
- Notas novas
- Revisão de cancelamentos
- Clientes Lojamix → Sistema
- Cliente Sistema → Lojamix

Os valores continuam sendo enviados como parâmetros ODBC; os marcadores
`{{...}}` não são interpolados diretamente. Cada consulta pode ser validada
e restaurada para o padrão oficial. As consultas de leitura não aceitam
comandos de alteração.

## Versão 1.1.1 — Tray e inicialização do Windows

- Ícone real na bandeja do Windows.
- Fechar a janela oculta para a bandeja.
- Menu: Abrir, Sincronizar agora, Atualizar status, Configurações, Iniciar com Windows e Sair.
- O EXE habilita inicialização automática na primeira execução.
- A inicialização usa HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run, sem exigir administrador.
- O programa inicia oculto na bandeja quando iniciado automaticamente.
- Sair pelo menu encerra API, worker e tray.

## Versão 1.1.2 — Correção do editor SQL

- Corrigido erro `name 're' is not defined` que impedia o carregamento das consultas SQL.
- Editor SQL agora apresenta a consulta padrão mesmo em caso de erro de leitura do arquivo personalizado.
- Mantidos tray, inicialização automática e todas as funções da 1.1.1.

## Versão 1.1.3 — Diagnóstico de sincronização

- Erros HTTP do sistema agora preservam o status e o corpo de resposta sanitizado.
- O token interno, senha e demais segredos continuam fora dos logs e mensagens.
- Cada etapa de sincronização registra `erroDetalhe` quando falha.
- O worker apresenta esses erros em **Último erro** e em **Detalhes do erro**.
- Falhas de um lote não avançam o cursor e continuam seguras para retry.

## Versão 1.1.4 — Correção da tela Consultas SQL

- Corrigido o erro de geometria Tkinter que deixava a janela de Configurações em branco.
- A opção "Iniciar automaticamente com o Windows" agora pertence corretamente à aba Conexão.
- A aba Consultas SQL carrega explicitamente "Notas novas" ao abrir.
- Editor SQL com borda visível e área redimensionável.
- Mantidas bandeja, inicialização automática, sincronização e diagnóstico de erros.

## Versão 1.1.5 — Elegibilidade de clientes por sorteio

- Cliente Loja → Sistema só é lido/enviado quando for Pessoa Física.
- CPF preenchido com 11 dígitos.
- Telefone válido (celular ou fone1) com pelo menos 10 dígitos.
- Existe pelo menos uma nota fiscal não excluída no período do sorteio ativo.
- Pessoa Jurídica/CNPJ continua fora do escopo.
- O sorteio ativo é consultado uma vez por ciclo e reutilizado por notas e clientes.
- A consulta usa EXISTS para não multiplicar clientes por quantidade de notas.
- A regra de clientes Sistema → Loja permanece inalterada.


## V1.1.6 — correção de clientes por novas notas

O sincronismo Loja → Sistema de clientes usa dois cursores independentes:
- `ultimo_id_entidade`: clientes novos elegíveis;
- `ultimo_id_nota_cliente`: clientes antigos que aparecem em novas notas do sorteio.

O limite superior de `id_nota_fiscal` é capturado uma única vez no início do ciclo. O sincronismo de notas permanece independente do sincronismo de clientes.

## V1.1.7 — recuperação de clientes elegíveis

- Novo passo de **revisão de clientes** em cada ciclo: varre o cadastro em blocos (`revisao_bloco`) com os mesmos critérios de elegibilidade (Pessoa Física, CPF válido, telefone com pelo menos 10 dígitos e nota no período do sorteio ativo) e reenvia quem está elegível. O envio é idempotente por `origemId`, então clientes já sincronizados são apenas atualizados. Marcador próprio: `ultimo_id_cliente_revisado`; ao terminar a varredura, recomeça do início.
- A tela mostra **por que** clientes ficaram fora do envio: sem nome, sem CPF, CPF inválido, sem telefone.
- A reconciliação (`POST /api/sync/reconciliar`) voltou a revisar clientes elegíveis (`clientesElegiveis`).
- Novo botão **Reprocessar clientes** (`POST /api/local/clientes-reprocessar`): zera **somente** `ultimo_id_entidade`, `ultimo_id_nota_cliente` e `ultimo_id_cliente_revisado`. Nunca altera `ultimo_id_nota` nem `ultimo_id_revisado`, que pertencem ao sincronismo de notas. Recusa a execução quando há um ciclo de clientes em andamento (todo o fluxo de clientes é serializado por uma trava única).
- Nada é excluído em nenhum dos sentidos; notas fiscais não são afetadas.

## Gravação de clientes no Lojamix (chave mestra)

- Nova opção `gravar_clientes_no_lojamix` (**desligada por padrão**), na aba Conexão das Configurações.
- Desligada: as etapas `clientes_sistema_loja` (`aplicar_alteracoes`) e `clientes_pendentes_loja` (`enviar_pendentes_para_loja`) não executam — a fila do sistema nem é lida, nenhum cursor ou marcador avança e nada é criado, atualizado ou vinculado no Lojamix. A tela mostra essas etapas como "desligada" e exibe um aviso destacado.
- Ligada: o comportamento anterior volta integralmente, incluindo `criar_cliente_no_lojamix`, `simulacao_criacao_cliente`, vínculo por CPF, transação única e rollback.
- Nada foi removido do código; o fluxo Loja → Sistema, a revisão de clientes e o sincronismo de notas seguem funcionando normalmente.
