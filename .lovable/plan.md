# Descrição opcional para cada telefone do currículo

## Objetivo
Permitir um rótulo/descrição opcional (ex.: "WhatsApp", "Recado — Mãe") antes de cada telefone, incluindo o telefone principal. Quando preenchida, a descrição aparece no formato `WhatsApp: (11) 99999-9999` no documento, PDF e impressão; quando vazia, o telefone aparece como hoje.

## Banco de dados (migração)
- `curriculo_telefones.tipo` (text, nullable) já existe e está sem uso: passa a armazenar a descrição dos telefones adicionais — sem alteração de schema aqui.
- Adicionar `curriculos.telefone_principal_descricao` (text, nullable) para o rótulo do telefone principal.

## Alterações

1. **Migração**: `ALTER TABLE curriculos ADD COLUMN IF NOT EXISTS telefone_principal_descricao text;`

2. **`src/lib/curriculo.ts`**
   - `TelefoneItem` ganha `tipo?: string | null`.
   - `CurriculoRegistro` e `CamposCurriculo` ganham `telefone_principal_descricao: string | null`.
   - Nova função `telefoneComDescricao(telefone, descricao?)` que devolve `"Descricao: (00) 00000-0000"` ou apenas o número formatado.

3. **`src/lib/curriculo.server.ts`**
   - Incluir `telefone_principal_descricao` no SELECT principal.
   - `curriculo_telefones`: incluir `tipo` no SELECT e gravar `tipo` no replace de lista (`gravarEtapa`), usando capitalização.

4. **`src/lib/curriculo.functions.ts`**: adicionar `telefone_principal_descricao` (texto opcional, máx. 40) e `tipo` nos itens de telefone aos schemas Zod.

5. **`src/components/curriculo/FormularioCurriculo.tsx`**
   - Estado dos telefones adicionais passa de `string[]` para `{ telefone, tipo }[]`, com campo "Descrição (opcional)" ao lado de cada número.
   - Campo "Descrição (opcional)" também para o telefone principal.
   - Pré-visualização na revisão usa `telefoneComDescricao`.

6. **`src/components/curriculo/CurriculoDocumento.tsx`** e **`src/lib/curriculo-pdf.ts`**
   - Linha de telefones monta cada item com `telefoneComDescricao` (principal + adicionais).

7. **Importação (`src/lib/curriculo-import.server.ts`)**: telefones importados seguem sem descrição (nenhuma mudança necessária; `tipo` fica nulo).

## Comportamento
- Descrição totalmente opcional; currículos existentes não mudam em nada.
- Compatível com o fluxo do link público, que usa o mesmo formulário e validação.
