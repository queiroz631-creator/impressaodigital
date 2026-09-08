# Melhoria 9 — Reorganizar os cards de fluxo

Tela: Configurar Bot > aba Fluxos.

## O que muda

- Os fluxos deixam de ser uma lista de cartões largos (um por linha) e passam a ficar
  em cartões quadrados, lado a lado, quebrando para a linha de baixo quando necessário
  (2 colunas em telas médias, 3 em telas grandes; 1 no celular).
- Cada cartão recebe um tom de cor diferente, repetido em ciclo conforme a ordem da lista
  (borda e fundo suave), para diferenciar visualmente os fluxos.
- Conteúdo do cartão permanece o mesmo: ícone, nome, selo Ativo/Inativo, descrição,
  quantidade de etapas e os botões CONFIGURAR, EDITAR, DUPLICAR, ATIVAR/DESATIVAR e excluir.
  Os botões ficam alinhados na base do cartão para que todos tenham a mesma altura.
- Nada mais muda: formulários, diálogos, seletor de fluxo de finalização, regras do bot
  e banco de dados continuam iguais.

## Detalhes técnicos

- Arquivo único: `src/components/bot/FluxosPainel.tsx`, apenas o bloco da listagem
  (`<div className="grid gap-3">` com `lista.map`).
- Grid: `grid gap-3 sm:grid-cols-2 xl:grid-cols-3`; cartão com `flex h-full flex-col`
  e o bloco de botões com `mt-auto`.
- Cores: pequeno array de classes de tom (ex.: `bg-primary/5 border-primary/30`,
  `bg-accent/10 border-accent/40`, etc., todas via tokens do design system, sem cores
  fixas) aplicado por índice com módulo. Descrição limitada a 2 linhas (`line-clamp-2`)
  para manter os cartões uniformes.
- Ao final, marcar a melhoria 9 como `executada = true` (status continua "pendente").
