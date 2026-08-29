# Corrigir salvamento da descrição dos telefones adicionais

## Causa

A tela administrativa do currículo (`src/routes/curriculos.$id.tsx`) grava os telefones direto pelo cliente do banco, com sua própria função `salvarEtapa`. Ao regravar a lista, ela monta apenas `{ telefone }` e descarta a descrição (`tipo`), então a descrição digitada é perdida ao salvar. Pelo link público o salvamento passa pelo servidor, que já grava a descrição corretamente.

## Correção

- Em `src/routes/curriculos.$id.tsx`, na gravação de `curriculo_telefones`, incluir também a descrição: `tipo` com o texto capitalizado ou nulo quando vazio (mesmo comportamento do salvamento público).

Nenhuma alteração de banco é necessária.
