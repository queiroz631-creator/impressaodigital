# Quebrar a seção de experiência em duas colunas quando houver mais de 3 empresas

## Objetivo

Quando o currículo tiver **mais de 3 empresas** na seção "Experiência profissional", distribuir as experiências em **duas colunas** lado a lado, para ocupar menos espaço vertical na folha. Com 3 ou menos, mantém o formato atual (uma coluna).

## Escopo técnico

### 1. PDF — `src/lib/curriculo-pdf.ts`

No bloco `Experiência profissional` (linhas ~189-198), quando `dados.experiencias.length > 3`:

- Dividir o array de experiências em dois grupos (ex.: primeira metade na coluna esquerda, segunda metade na direita).
- Renderizar cada coluna com largura `util / 2 - 8` (pequena margem entre colunas), usando o mesmo fluxo de `texto`/`paragrafo` atual.
- Controlar o `y` de cada coluna de forma independente e, ao final, avançar `y` para a maior das duas.
- Manter a barra de seção "Experiência profissional" única, acima das duas colunas.
- Com 3 ou menos empresas, manter o comportamento atual em coluna única.

### 2. Visualização/Impressão — `src/components/curriculo/CurriculoDocumento.tsx`

No bloco de experiência (linhas ~105-118), quando `dados.experiencias.length > 3`:

- Renderizar os cards de experiência em um grid de 2 colunas (`grid grid-cols-2 gap-x-6`) em vez da coluna única atual.
- Cada card permanece igual (empresa, cargo, período, atividades).
- Com 3 ou menos, manter a coluna única (`space-y`).

### 3. Sem mudança em banco de dados, formulários ou demais telas.

## Verificação

Gerar o PDF e a visualização de um currículo com mais de 3 empresas (ex.: 4–5 experiências) e confirmar a distribuição em duas colunas; conferir que um currículo com 3 ou menos permanece em coluna única.
