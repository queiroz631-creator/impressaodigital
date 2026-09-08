# Corrigir "Total de páginas" do orçamento enviado pelo WhatsApp

## Problema

No card VALORES DE IMPRESSÃO, o "Total para Cobrança" soma:

```text
quantidade de arquivos + páginas adicionais + cópias adicionais
```

Já o texto enviado pelo WhatsApp usa outro valor: apenas a soma das páginas lidas
nos arquivos anexados. Por isso os dois números aparecem diferentes.

## Correção

No texto do orçamento (Envia Zap), o "Total de paginas" passa a ser calculado da
mesma forma que o "Total para Cobrança":

```text
Qtd Arquivos: 03
Total de paginas: 27
```

onde 27 = arquivos + páginas adicionais + cópias adicionais.

Vale tanto para o Orçamento Rápido quanto para o orçamento do pedido completo,
assim os dois sempre batem com a tela.

## Detalhes técnicos

- Arquivo único: `src/lib/orcamento-zap.ts`, função `textoOrcamentoZap`.
- Trocar `item.paginasTotal` por
  `item.quantidadeArquivos + item.paginasAdicionais + item.copiasAdicionais`
  (todos já existem em `ItemDoc`).
- Sem mudanças no cálculo de preços, no banco, no layout, no PDF ou na imagem do
  orçamento.
- Ao final: typecheck/build.
