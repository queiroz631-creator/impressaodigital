# Exibir Formato na tabela principal de "Configurar Preços"

## Objetivo
Hoje o campo **Formato** (A3/A4/A5) só aparece dentro do modal "Editar" de cada material. Exibi-lo também como coluna na tabela principal da aba "Materiais", no mesmo padrão das demais colunas (`IMPRESSÃO/CÓPIA`, `TIPO DE IMPRESSÃO`), para que o administrador veja e ajuste o formato sem abrir o modal.

## Alteração (somente `src/routes/precos.tsx`)
1. Adicionar uma coluna `FORMATO` no `<thead>` da tabela, posicionada após `TIPO DE IMPRESSÃO`.
2. Na `<tbody>`, renderizar um `Select` idêntico ao do modal, usando `FORMATOS`, com `value={m.formato ?? "A4"}` e `onValueChange` chamando `atualizar(m.id, "formato", v as FormatoPapel)`.
3. Ajustar `min-w-[820px]` da tabela para acomodar a nova coluna (ex.: `min-w-[960px]`).
4. O `Select`/`SelectItem`/`SelectContent` já estão importados; `FORMATOS` e `FormatoPapel` também já vêm de `@/lib/calc`. Sem novas dependências.

Nenhuma mudança no banco ou em outros arquivos — `formato` já é persistido por `salvarMaterial`/`salvar` (linha `formato: m.formato ?? "A4"`).

## Detalhes técnicos
- Arquivo único: `src/routes/precos.tsx`.
- Sem alteração de lógica de cálculo; somente exposição de um campo existente.
