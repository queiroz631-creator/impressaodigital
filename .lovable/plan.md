# Corrigir erro ao salvar currículo pelo link público

## Causa

O erro `Unrecognized key(s) in object: 'endereco', 'bairro', 'cidade', 'uf', 'cep'` vem da validação do servidor usada no link público do currículo. O formulário passou a enviar os campos de endereço (e o nome da pós-graduação), mas a lista de campos aceitos no servidor não foi atualizada e é fechada (rejeita qualquer campo novo).

## Correção

- Incluir na validação de campos: `endereco`, `bairro`, `cidade`, `uf`, `cep`, `pos_graduacao_nome`.
- Incluir também a lista de formações (curso superior múltiplo) e o campo `ano` em cursos, caso o formulário já envie esses dados, para evitar o mesmo erro nas outras etapas.
- Conferir que o salvamento no servidor grava esses campos na tabela de currículos.

## Detalhes técnicos

- Arquivo: `src/lib/curriculo.functions.ts` — `camposSchema` (Zod `.strict()`) e `payloadSchema`.
- Verificar `src/lib/curriculo.server.ts` (`salvarEtapa`) para persistir `formacoes` e `cursos.ano` se ainda não persistir.
- Comparar com a lista de campos enviada por `src/components/curriculo/FormularioCurriculo.tsx` para garantir cobertura total.
