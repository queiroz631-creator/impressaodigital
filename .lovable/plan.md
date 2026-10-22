# Nº da Sorte — Etapa 4: Dashboard, Estatísticas e Relatórios

Somente leitura e acompanhamento: nada muda na geração de números, consulta, comprovante ou retirada. Sorteios e FOTO EXPRESS não são tocados.

## O que já existe e será aproveitado

- Participações (aceite do regulamento por campanha), consultas com resultado (não premiada, premiada, repetida, bloqueada, inválida, limite), premiações com situação e prazo, retiradas com quem entregou e quando, números por prêmio com situação.
- Cadastro de clientes compartilhado (com data de criação), usado para separar "novos" de "já existentes".
- A aba Participações da Etapa 2 é ampliada, não recriada. A biblioteca de gráficos já instalada é reaproveitada.

## O que o usuário vai ver

**Dashboard (todas as campanhas)**
- 14 cartões: campanhas cadastradas e ativas, clientes cadastrados e participantes, consultas totais e números distintos, não premiados, premiados, prêmios cadastrados, unidades disponíveis, aguardando retirada, entregues, vencidos e cancelados.
- Filtros: campanha, situação da campanha, data inicial e final. Cada indicador usa a data do próprio evento (consulta pela data da consulta, entrega pela data da entrega).
- Gráficos: participações por dia (clientes únicos e consultas), por horário (horário de Brasília), resultado das consultas, situação dos prêmios, premiações encontradas e entregas por dia, e comparação entre campanhas com o período de cada uma indicado.

**Estatísticas da campanha** (botão "Ver estatísticas" na lista de campanhas)
- Nome, número, período, situação, participantes, novos e já existentes, consultas, números distintos, repetidas, bloqueadas, premiados, entregues, pendentes, vencidos.
- Taxa de premiação = clientes premiados / clientes participantes.
- Taxa de retirada = entregues / (entregues + aguardando + vencidos). Prêmios ainda não encontrados e cancelados ficam fora.
- Tabela por prêmio com imagem: quantidade, números gerados, disponíveis, reservados, entregues, vencidos, cancelados.

**Relatórios** (abas com filtros e páginas de 50 linhas)
- Participantes: nome, telefone e CPF mascarados, campanha, consultas, números distintos, primeiro acesso, última participação, situação e se ganhou. Ao abrir, mostra só o histórico dessa pessoa naquela campanha.
- Premiações: campanha, cliente, número premiado, prêmio, data, prazo, situação, data da entrega e funcionário. Filtros por campanha, prêmio, situação, cliente e período.
- Consultas: campanha, cliente, número, data/hora, resultado e motivo (não premiado, premiado, já utilizado, cliente já contemplado, limite atingido, campanha indisponível).
- Reabrir comprovante não conta como nova participação (já não gera consulta).

**Exportação CSV** de participantes, consultas, premiações, retiradas, resumo da campanha e desempenho dos prêmios, respeitando os filtros, gerada no servidor em blocos, sempre com CPF mascarado.

Sem dados, as telas mostram "Esta campanha ainda não possui participações." — nunca números inventados.

## Permissões

- Já existem: `numero_sorte.visualizar`, `.participantes.visualizar`, `.relatorios.visualizar`.
- Novas: `numero_sorte.estatisticas.visualizar` (dashboard e gráficos, sem dados pessoais) e `numero_sorte.exportar` (CSV).
- Conferido no servidor e no banco, não só escondendo botões. Administradores continuam com acesso total.

## Detalhes técnicos

- Uma migração aditiva: funções SECURITY DEFINER de leitura (`numero_sorte_dashboard`, `_serie_diaria`, `_por_horario`, `_estatisticas_campanha`, `_desempenho_premios`, `_comparar_campanhas`, `_relatorio_participantes`, `_relatorio_premiacoes`, `_relatorio_consultas`, `_detalhe_participante`), cada uma checando `tem_permissao`; agregação toda no PostgreSQL, com paginação por limite/deslocamento. Índices em consultas (campanha, criado_em), (campanha, cliente), premiações (campanha, situacao, reservado_em), retiradas (entregue_em). Nenhuma tabela nova, nenhuma alteração de dados. Cópia em `supabase/migrations/`.
- Novas chaves de permissão em `src/lib/modulos.ts`.
- Server functions em `src/lib/numero-sorte-relatorios.functions.ts` com `requireSupabaseAuth`; CSV montado no servidor em blocos de 1.000 linhas.
- Interface em `src/modules/numero-sorte/estatisticas/` e `relatorios/`, ligada às abas Dashboard, Estatísticas e Participações já existentes; nova rota `/numero-sorte/campanha/$id/estatisticas`.
- Cálculos puros (taxas, máscara de CPF/telefone, CSV, divisão por zero, filtros) em `src/modules/numero-sorte/lib/indicadores.ts` com testes em `tests/numero-sorte-indicadores.test.ts`. Atualização via React Query após entrega/cancelamento, sem consultas repetidas.

## Pontos de atenção

- O banco da prévia é o mesmo da loja. A migração só cria funções de leitura e índices (não muda nem apaga dados), mas para as telas funcionarem ela precisa ser aplicada nesse banco. Ao aprovar este plano, considero isso autorizado; nenhum dado de teste será criado.
- Os testes com volume grande e com entregas reais ficam para um banco de testes isolado; os testes automáticos cobrem as regras de cálculo.
- Nada será publicado e a Etapa 5 não será iniciada.
