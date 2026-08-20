# Corrigir impressão clara do recibo (etiqueta 80mm)

## O que está acontecendo

A impressão sai fraca/clara por dois motivos confirmados no código:

1. Ao imprimir, `src/lib/impressora.ts` clona a etiqueta para `#etiqueta-print-area` e **remove o id original**. Todas as regras reforçadas de impressão escritas em `ImprimirEtiqueta.tsx` miram `#etiqueta-print`, então **não se aplicam ao que é impresso**. Valem apenas as regras mais fracas de `src/styles.css`.
2. Essas regras em `styles.css` não forçam peso de fonte, não aumentam o tamanho (fica em 11px) e não usam `print-color-adjust: exact` no bloco principal — em impressora térmica isso resulta em texto fino e acinzentado.

## Correção

1. Em `src/styles.css`, no bloco `@media print` de `#etiqueta-print-area`:
   - `color: #000`, `font-weight: 700` (títulos/`strong` em 900), `font-size: 12px`, `line-height: 1.35`;
   - `-webkit-print-color-adjust: exact; print-color-adjust: exact;` no contêiner e em todos os filhos;
   - remover qualquer `opacity`, `text-shadow`, `filter` e cinza herdado da interface (forçar tudo preto puro);
   - manter fonte monoespaçada e largura 80mm já existentes.
2. Fazer as mesmas regras valerem para os dois seletores (`#etiqueta-print` e `#etiqueta-print-area`), para que preview e impressão fiquem idênticos.
3. Em `src/lib/impressora.ts`, manter a classe `etiqueta-80mm` no clone e acrescentar uma classe de impressão dedicada, para o CSS não depender do id removido.
4. Consolidar: as regras duplicadas dentro de `ImprimirEtiqueta.tsx` passam a existir só em `styles.css`, evitando divergência futura.

## Observação

Se, após isso, ainda sair claro, o ajuste restante é de hardware: densidade/escurecimento (darkness) no driver da impressora térmica — posso indicar onde ajustar.
