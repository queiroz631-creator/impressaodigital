# Corrigir erro ao preencher currículo pelo link

## Causa (verificada)

O erro `Unrecognized key(s) in object: 'numero'` vem da validação usada no link público. Os campos novos criados na última atualização (`numero`, e também `experiencia_possui`, `experiencia_frase`, `habilidades_observacao`) não estão na lista de campos aceitos pelo servidor, que é fechada e rejeita qualquer campo novo.

## Correção

- Incluir na validação do link público os campos: `numero`, `experiencia_possui`, `experiencia_frase`, `habilidades_observacao`.
- Conferir que o salvamento pelo link grava esses campos, igual ao modo admin.

## Detalhes técnicos

- Arquivo: `src/lib/curriculo.functions.ts` — `camposSchema` (Zod `.strict()`), adicionar as quatro chaves com os tipos corretos (texto opcional/nulo e booleano).
- Nenhuma alteração de banco; o restante do formulário permanece igual.
