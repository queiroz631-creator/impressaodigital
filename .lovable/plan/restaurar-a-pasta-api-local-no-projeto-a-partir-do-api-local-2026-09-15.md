# Restaurar a pasta api-local no projeto a partir do api-local.zip enviado

## Objetivo
Colocar de volta no projeto a pasta `api-local/` (o programa da loja), usando o arquivo `api-local.zip` que você enviou. O zip é uma versão mais nova do que a que foi apagada: inclui tela de configuração (gui/), serviço do Windows (service/, installer/) e script de geração do executável (GERAR_EXE.bat).

## Verificações já feitas no zip
- Sem pasta `.git` (seguro copiar para o projeto).
- Sem arquivo `.env` (nenhuma senha vem no pacote).
- 55 arquivos, ~100 KB; contém pastas temporárias `__pycache__` que serão excluídas da cópia.

## O que será feito
1. Extrair o zip em pasta temporária (`/tmp`).
2. Copiar o conteúdo para `api-local/` na raiz do projeto, excluindo `__pycache__` e arquivos temporários.
3. Conferir que os arquivos foram copiados (contagem e listagem).
4. Atualizar `roadmap.md`: registrar que a pasta `api-local/` foi restaurada a partir do zip enviado (versão com GUI/serviço/instalador), mantendo a referência ao backup anterior.

## O que NÃO será feito
- Nenhuma alteração no site, no banco de dados ou em qualquer código fora de `api-local/` e `roadmap.md`.
- Nenhum teste, dado fictício, commit, push, deploy ou publicação.
- Nenhuma senha criada ou alterada — o `.env` continua sendo preenchido só na máquina da loja.

## Resultado esperado
A pasta `api-local/` volta a existir no projeto com a versão nova (GUI + serviço Windows + instalador), e o site segue funcionando normalmente, pois nada do site depende dessa pasta.
