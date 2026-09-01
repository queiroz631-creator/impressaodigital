# Corrigir a foto na impressão do currículo

## Problema

Na impressão, a folha inteira é reduzida por um fator de zoom para caber em uma página A4. A foto acompanha essa redução (fica menor que 2,5 x 3,5 cm) e, por estar posicionada de forma absoluta sobre a faixa "CURRÍCULO VITAE", pode sobrepor o nome/telefones quando o conteúdo é comprimido — desconfigurando o cabeçalho.

## Correção

1. Marcar a foto com uma classe própria no documento do currículo.
2. Na folha de estilo da impressão, fixar essa foto em 2,5 cm x 3,5 cm compensando o fator de zoom aplicado, para que ela saia sempre no tamanho real independentemente da redução da página.
3. Reservar espaço no cabeçalho quando a foto está ativa (o bloco central do cabeçalho passa a ter um recuo à direita), evitando sobreposição do nome, telefones e e-mail.
4. Garantir que a foto continue com o topo alinhado à linha superior da faixa e a borda direita alinhada ao fim da faixa, tanto na tela quanto na impressão, igual ao PDF.

Nada além disso muda: campos, seções, layout, PDF e demais telas permanecem iguais.

## Detalhes técnicos

- `src/components/curriculo/CurriculoDocumento.tsx`: adicionar a classe `cv-foto` à `<img>` e um recuo condicional no cabeçalho quando `foto_exibir && foto_url`.
- `src/lib/curriculo-pdf.ts` (`imprimirCurriculo`): no CSS do iframe, definir `.cv-foto { width: 2.5cm; height: 3.5cm; object-fit: cover; }` usando uma variável CSS com o fator de zoom aplicado (`calc(2.5cm / var(--cv-zoom))`), atualizada em `aplicarFator`, e proteger o posicionamento absoluto para não colidir com o texto.
