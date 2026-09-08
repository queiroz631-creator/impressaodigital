# Melhoria 25 — Total de páginas no orçamento do WhatsApp

No texto do orçamento enviado pelo WhatsApp, substituir as duas linhas atuais
("Qtd Arquivos" e "Total Pagina") por uma única informação: **Total de páginas**,
que representa o total de páginas a serem cobradas (arquivos + páginas adicionais +
cópias adicionais, já calculado no total do item).

Não serão exibidas linhas separadas para "Páginas adicionais" nem "Cópias adicionais".

## Como fica o texto

```text
*Segue Orçamento:*

Total de paginas: 27

Impressão Colorida
Encadernação: 1x
Plastificação: Nenhum

*Valor Total: R$ 50,00*
...
```

## Detalhes técnicos

- Arquivo único: `src/lib/orcamento-zap.ts`, função `textoOrcamentoZap`.
- O cálculo do total de páginas já existe no resultado da calculadora; a propriedade
  `paginasTotal` em `ItemDoc` representa as páginas totais do item. O texto usará esse
  valor.
- Nenhuma mudança de banco, de cálculo, de layout ou do PDF/imagem do orçamento.
- Ao final: typecheck/build e marcar a melhoria 25 como executada.
