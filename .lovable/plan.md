# Melhoria 25 — Páginas e cópias adicionais no orçamento do WhatsApp

Incluir, no texto do orçamento enviado pelo WhatsApp, as linhas de **páginas adicionais**
e **cópias adicionais**, exibidas somente quando forem maiores que zero.

## Como fica o texto

```text
*Segue Orçamento:*

Qtd Arquivos: 03
Total Pagina: 15
Paginas Adicionais: 12      (só aparece se > 0)
Copias Adicionais: 02       (só aparece se > 0)

Impressão Colorida
Encadernação: 1x
Plastificação: Nenhum

*Valor Total: R$ 50,00*
...
```

As novas linhas ficam no mesmo bloco de "Qtd Arquivos" / "Total Pagina", sem linha em
branco entre elas, seguindo o formato de dois dígitos já usado. Quando o valor for 0,
a linha simplesmente não aparece.

## Detalhes técnicos

- Arquivo único: `src/lib/orcamento-zap.ts`, função `textoOrcamentoZap`.
- Os valores `paginasAdicionais` e `copiasAdicionais` já existem em `ItemDoc`
  (`src/lib/documento.ts`) e já são preenchidos pela calculadora — nenhum dado novo.
- Nenhuma mudança de banco, de cálculo, de layout ou do PDF/imagem do orçamento.
- Ao final: typecheck/build e marcar a melhoria 25 como executada.
