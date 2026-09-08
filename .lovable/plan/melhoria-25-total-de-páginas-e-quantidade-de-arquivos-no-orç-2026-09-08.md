# Melhoria 25 — Total de páginas e quantidade de arquivos no orçamento do WhatsApp

No texto do orçamento enviado pelo WhatsApp, ajustar o cabeçalho de cada item para mostrar:

- **Qtd Arquivos**: quantidade de arquivos do item.
- **Total de páginas**: total geral de páginas a serem cobradas (já considera arquivos,
  páginas adicionais e cópias adicionais, conforme o valor `paginasTotal` do item).

Não serão exibidas linhas separadas para "Páginas adicionais" nem "Cópias adicionais".

## Como fica o texto

```text
*Segue Orçamento:*

Qtd Arquivos: 03
Total de paginas: 27

Impressão Colorida
Encadernação: 1x
Plastificação: Nenhum

*Valor Total: R$ 50,00*
...
```

## Detalhes técnicos

- Arquivo único: `src/lib/orcamento-zap.ts`, função `textoOrcamentoZap`.
- Os valores `quantidadeArquivos` e `paginasTotal` já existem em `ItemDoc`
  (`src/lib/documento.ts`) e são preenchidos pela calculadora.
- Nenhuma mudança de banco, de cálculo, de layout ou do PDF/imagem do orçamento.
- Ao final: typecheck/build e marcar a melhoria 25 como executada.
