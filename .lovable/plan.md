# Corrigir a impressão da etiqueta na tela de Pedidos

## Problema
A etiqueta é impressa dentro do diálogo. O diálogo é um elemento posicionado com altura máxima (90% da tela), rolagem e recorte de conteúdo. Na impressão, isso corta a etiqueta, gera páginas em branco e faz aparecer barra de rolagem no conteúdo impresso.

## Solução
Ao imprimir, a etiqueta deixa de depender do diálogo:

1. O conteúdo da etiqueta é copiado para um contêiner de impressão criado no fim da página (fora do diálogo), impresso e removido logo depois.
2. As regras de impressão passam a esconder tudo, exceto esse contêiner, com largura de 80mm, sem altura máxima, sem rolagem e sem bordas.
3. O bloco da etiqueta dentro do diálogo continua com rolagem própria na tela (para caber no diálogo), mas isso não afeta mais a impressão.
4. A tarja preta do "RESTANTE" continua sendo impressa com fundo preto.

## Detalhes técnicos
- `src/lib/impressora.ts`: em `imprimirPeloNavegador`, clonar `#etiqueta-print` para um `div#etiqueta-print-area` anexado ao `body`, chamar `window.print()` e remover o clone ao final (inclusive via `onafterprint`).
- `src/styles.css`: no `@media print`, mirar `#etiqueta-print-area` em vez do nó dentro do diálogo; forçar `position: static`, `width: 80mm`, `max-height: none`, `overflow: visible`, `transform: none` e esconder o overlay/diálogo do Radix.
- `src/components/ImprimirEtiqueta.tsx`: aplicar rolagem apenas na visualização em tela (`overflow-y-auto` com altura limitada), sem alterar o texto ou os cálculos da etiqueta.
