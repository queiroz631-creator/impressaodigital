# Sorteios — filtro Hoje/Todos no painel e nas listas

Adicionar aos sorteios o mesmo estilo de seleção de período da tela de Orçamentos: um botão "Hoje" (padrão) e "Todos", filtrando os dados pela data de hoje (fuso do computador). Nenhuma regra de negócio muda — é só filtro de exibição.

## Onde aparece

### 1. Painel do sorteio (`/sorteios/$id`)
- Seletor com dois botões: **Hoje** (selecionado por padrão) e **Todos**, no mesmo estilo visual do filtro de Orçamentos (botão destacado quando ativo), acima dos cartões de indicadores.
- Em "Hoje", os cartões filtráveis consideram apenas o dia de hoje:
  - **Participantes** — criados hoje (`criado_em` da participação).
  - **Notas** — cadastradas hoje (`cadastrado_em`), incluindo a contagem por situação (válidas, pendentes etc.), "Valor em notas válidas" e "notas aguardando cupons".
  - **Cupons** — gerados hoje (`gerado_em`), incluindo ativos/cancelados/utilizados.
- Sempre mostram o total do sorteio, independente do filtro: **Saldo acumulado**, **Prêmios ativos** e **Ganhadores**.
- O cartão "Saldo e cupons" (Gerar cupons pendentes) e o restante da página (dados do sorteio, botões de ação) não mudam.

### 2. Listas do sorteio
- **Notas** (`/sorteios/$id/notas`): mesmo seletor Hoje/Todos; em "Hoje" mostra só notas cadastradas hoje.
- **Cupons** (`/sorteios/$id/cupons`): em "Hoje" mostra só cupons gerados hoje.
- **Participantes** (`/sorteios/$id/participantes`): em "Hoje" mostra só participações criadas hoje.
- Em "Todos" as listas ficam exatamente como estão hoje. Quando a lista filtrada fica vazia, mensagem amigável ("Nenhuma nota registrada hoje." etc.).

## Detalhes técnicos

- Componente novo `SeletorHojeTodos` em `src/modules/sorteios/components/` (dois botões, estado controlado pelo pai), reutilizado nas 4 telas.
- O filtro é feito no navegador comparando a data local (mesma função `dataLocalISO` usada em Orçamentos, movida para um util compartilhado em `src/lib/format.ts` ou novo `src/lib/data-local.ts`) com `cadastrado_em` (notas), `gerado_em` (cupons) e `criado_em` (participações).
- `useIndicadoresSorteio` (`src/modules/sorteios/hooks/useSorteios.ts`): em modo "hoje", as consultas de notas, cupons e participantes trazem também os campos de data e a contagem é feita após o filtro; saldo, prêmios e ganhadores seguem totais. Query key passa a incluir o modo (`["sorteio-indicadores", id, modo]`) para não misturar cache.
- As contagens da linha do título (`useSorteio`, participantes/notas/cupons) continuam totais — não entram no filtro.
- Nenhuma mudança de banco, migração, permissão ou regra do sorteio. Nada muda no portal público.
- Verificação: typecheck (tsgo), build OK, e conferência visual no preview do painel e das três listas alternando Hoje/Todos.
