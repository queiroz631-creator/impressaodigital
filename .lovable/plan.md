# Importar currículo: por que o arquivo não sai da pasta de origem

## O que encontrei

A parte de copiar o arquivo para a pasta escolhida funciona. O que falha é o passo de apagar o original — e, em alguns casos, nem se tenta mover.

**Causa 1 — falta a permissão de alteração no arquivo escolhido.**
Ao abrir o seletor, o navegador dá apenas permissão de leitura do arquivo. O sistema pede permissão de gravação só para a pasta de destino, nunca para o arquivo de origem. Sem essa permissão, apagar o original é recusado; o resultado é "copiado, mas não foi possível apagar".

**Causa 2 — o aviso nunca chega à tela.**
Quando o apagar falha, a mensagem é guardada em um aviso dentro do modal, mas nesse momento o modal já foi fechado e a tela navegou para o currículo. Ou seja: aparentemente "não fez nada", sem explicação.

**Causa 3 — quando o arquivo vem sem o controle do arquivo.**
Se o arquivo entrar pelo seletor simples do navegador (usado quando o recurso moderno não está disponível) ou por um arraste que não fornece o controle do arquivo, não há como mover nem apagar. Hoje isso acontece em silêncio, sem nenhum aviso ao usuário.

## O que vou fazer

1. **Pedir a permissão de alteração do arquivo** antes de apagar o original, no mesmo momento em que se verifica a pasta de destino. Se o navegador recusar, o arquivo ainda é copiado e o motivo aparece de forma clara.
2. **Mostrar o resultado sempre em aviso na tela (toast)**, não dentro do modal que fecha: sucesso ("arquivo movido para X"), copiado sem apagar, ou não foi possível mover.
3. **Avisar quando o arquivo não pode ser movido por origem**, com a orientação de usar o botão "SELECIONAR ARQUIVO" no Chrome ou Edge do computador para que o arquivamento funcione.
4. **Mensagem específica para permissão recusada no arquivo**, diferente da mensagem de pasta.

Nada muda na leitura do currículo, no preenchimento dos campos, na IA ou no banco de dados.

## Detalhes técnicos

- `src/lib/curriculo-arquivo.ts` → `moverArquivo`: chamar `garantirPermissao(arquivoHandle)` (query/request `readwrite`) antes de `arquivoHandle.remove()`; novo código de erro `SEM_PERMISSAO_ARQUIVO` e respectivo texto em `mensagemErroArquivamento`; manter `COPIADO_SEM_APAGAR` para falhas do `remove()` em si.
- `src/components/curriculo/ImportarCurriculo.tsx` → `arquivarArquivo`: retornar um resultado tipado (`{ ok, nome? , aviso? }`) em vez de `string | null`; incluir o caso "sem controle do arquivo" (`arquivoHandle` nulo com pasta definida); em `continuar`, emitir `toast.success` / `toast.warning` conforme o resultado antes de `onImportado(id)`.
- Sem alteração de banco, de migrações ou de outras telas.
