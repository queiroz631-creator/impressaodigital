# Sorteios — aba "Dados" no sorteio

O cartão "Dados do sorteio" (situação, início, fim, data do sorteio, valor por cupom, limite, descrição e os botões Editar, Reabrir, Cancelar/Ativar etc.) sai do Painel e ganha uma aba própria, logo depois de "Painel".

## O que muda para você

- No menu de abas do sorteio aparece a aba **Dados**, entre Painel e Termos.
- O Painel passa a mostrar direto o seletor Hoje/Todos e os cartões de indicadores (participantes, notas, cupons, valor, saldo, prêmios, ganhadores), sem o cartão de dados.
- A nova aba Dados mostra exatamente o mesmo cartão de hoje, com todos os botões funcionando igual (Editar, Reabrir sorteio, mudanças de situação). Os avisos de confirmação continuam os mesmos.
- Nada muda nas demais abas (Termos, Prêmios, Participantes, Notas, Cupons, Encerramento, Sortear) nem no portal do participante.

## Detalhes técnicos

- Nova rota `src/routes/sorteios.$id.dados.tsx`: cartão "Dados do sorteio" movido de `src/routes/sorteios.$id.index.tsx` para lá, incluindo a lógica dos botões (alterar status, reabrir, confirmar) com `head()` próprio ("Dados do sorteio").
- `NavSorteio.tsx`: entrada "Dados" (`/sorteios/$id/dados`) inserida após "Painel" em `ABAS`.
- `src/routes/sorteios.$id.index.tsx`: removidos o cartão de dados, o botão Editar e os botões de situação/reabertura; mantidos PageHeader, NavSorteio, seletor Hoje/Todos, indicadores, cartão Saldo e cupons e cartão Ganhadores. Imports que ficarem sem uso são retirados.
- Verificação: typecheck, build e conferência no preview (Painel sem o cartão, aba Dados com o cartão e botões funcionando).
