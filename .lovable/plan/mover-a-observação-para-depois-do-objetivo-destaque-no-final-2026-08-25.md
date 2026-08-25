# Mover a Observação para depois do Objetivo (destaque no final)

## Contexto

Hoje a observação (`habilidades_observacao`) aparece **dentro** da seção "Habilidades",
no formato `OBS.: {texto}`. O Objetivo já é a última seção do currículo.

O usuário quer que a observação seja a **última seção**, posicionada logo **após o
Objetivo**, com fonte um pouco maior e em negrito para dar destaque.

## Mudanças

Arquivos a alterar (somente renderização — sem mudança no banco, no formulário
ou na ordem das outras seções):

1. **`src/components/curriculo/CurriculoDocumento.tsx`**
   - Remover o bloco `OBS.: {observacao}` de dentro da seção "Habilidades".
   - A seção "Habilidades" passa a listar apenas as habilidades (ou fica oculta
     se não houver habilidades nem observação — ajustar a condição de exibição).
   - Após a seção "Objetivo", renderizar a observação como uma seção final em
     destaque: título "Observação" (mesmo padrão visual das outras seções) e
     texto em fonte maior (`text-[12pt] font-bold`) em vez do `10.5pt` normal.

2. **`src/lib/curriculo-pdf.ts`**
   - Remover o `paragrafo(OBS.: ...)` de dentro do bloco de Habilidades.
   - Ajustar a condição de exibição da seção "Habilidades" para depender apenas
     de `dados.habilidades.length`.
   - Após a seção "Objetivo", desenhar uma seção "Observação" final usando
     `texto(...)`/`paragrafo(...)` com tamanho 12 e negrito (vs. 10 normal),
     cor NAVY para destacar.

## Não incluir

- Sem migração de banco (campo `habilidades_observacao` já existe).
- Sem alteração no formulário (`FormularioCurriculo.tsx`) — o campo continua onde está.
- Sem alteração na ordem das demais seções.
