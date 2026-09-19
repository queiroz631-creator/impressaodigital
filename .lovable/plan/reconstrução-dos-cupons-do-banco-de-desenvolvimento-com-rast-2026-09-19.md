# Reconstrução dos cupons do banco de DESENVOLVIMENTO com rastreabilidade completa

Ambiente: **somente desenvolvimento** (uma única base usada pelo preview; nada será feito em produção). Sem commit, push, deploy ou publicação.

## ETAPA 1 — Conferência atual (nada foi alterado)

Cupons: **17** no sorteio "Dia das Crianças" (nº 1, ATIVO) — 15 ATIVOS, 2 CANCELADOS, **0 UTILIZADOS**.

| Participante | Notas VÁLIDAS processadas | Valor das notas | Cupons ATIVOS | Cupons cancelados | Valor consumido | Saldo atual | Saldo esperado | Diferença |
|---|---|---|---|---|---|---|---|---|
| 3a35dd9d… (cliente 57dc4894…) | 6 | R$ 240,85 | 12 | 2 | R$ 240,00 | R$ 0,85 | R$ 0,85 | 0 |
| 5ad01b24… (cliente b2096c7c…) | 1 | R$ 63,00 | 3 | 0 | R$ 60,00 | R$ 3,00 | R$ 3,00 | 0 |
| 7 outros participantes | 0 | R$ 0,00 | 0 | 0 | R$ 0,00 | R$ 0,00 | R$ 0,00 | 0 |

Notas: 18 no total, **0 pendentes**, **0 válidas sem processar**, 0 utilizadas em sorteio.
Auditoria: 144 registros, apenas 1 com vínculo direto a cupom.
Dependências que apontam para `sorteio_cupons`:
- `sorteio_auditoria.cupom_id` → `ON DELETE SET NULL` (as linhas de auditoria **continuam existindo**, só perdem o vínculo numérico com o cupom);
- `sorteio_ganhadores.cupom_id` → `ON DELETE RESTRICT` (tabela com **0 linhas**, então não bloqueia a exclusão).

Conclusão: **não há inconsistência** — os saldos batem com a fórmula em todos os participantes e a reconstrução a partir das notas processadas reproduz exatamente a quantidade de cupons de cada um. Pode seguir.

## ETAPA 2 — Base de saldo que será usada

`saldo_base` = soma do valor das notas VÁLIDAS já processadas (notas e seus campos de processamento **não** são tocados):
- 3a35dd9d: R$ 240,85 (notas 160699 48,00 + 160769 100,00 + 160877 77,85 + 160988 2,00 + 160976 9,00 + 160987 4,00) → 12 cupons + R$ 0,85
- 5ad01b24: R$ 63,00 (nota 160947 63,00) → 3 cupons + R$ 3,00

## ETAPA 3 — Backup antes de qualquer exclusão

Exportar em CSV (somente leitura) para a pasta de arquivos do projeto: os 17 cupons atuais, o conteúdo de `sorteio_notas` e de `sorteio_participantes`. Isso permite reverter a reconstrução manualmente se algo sair diferente do previsto.

## ETAPA 4 — Nova estrutura (migração 0005, só DDL)

**`sorteio_cupom_contribuicoes`**: `id`, `sorteio_id`, `participante_id`, `cupom_id` (FK RESTRICT), `nota_id` (FK RESTRICT, **NOT NULL**), `valor_centavos` (`CHECK > 0`), `ordem`, `criado_em`, `UNIQUE (cupom_id, nota_id)`, índices por `nota_id` e `participante_id`.

**`sorteio_saldo_fontes`**: `id`, `sorteio_id`, `participante_id`, `nota_id` (FK RESTRICT, NOT NULL), `valor_original_centavos`, `valor_pendente_centavos` (`CHECK >= 0`), `status` (`PENDENTE`/`ESGOTADO`/`CANCELADO`), `criado_em`, `atualizado_em`, `UNIQUE (nota_id)`, índice por `participante_id`.

Ambas com `GRANT` a `authenticated`/`service_role`, RLS ativada e políticas somente para o painel (`pode_sorteios()`), sem acesso anônimo — mesmo padrão das outras tabelas do módulo.

Na mesma migração, regravar:
- `sorteio_gerar_cupons_da_nota`: mantém assinatura, regra dos R$ 20,00, limite do sorteio, numeração aleatória, trava `FOR UPDATE` e auditoria; passa a criar a fonte da nota, consumir as fontes em ordem FIFO e gravar uma linha de contribuição por nota usada.
- `sorteio_recalcular_saldo_participante`: **remove o `ORDER BY gerado_em DESC LIMIT 1`**. Passa a (1) marcar a fonte da nota como `CANCELADO`, (2) recalcular o lastro de cada cupom usando só contribuições de notas ainda VÁLIDAS, (3) cancelar exatamente os cupons ATIVOS cujo lastro ficou abaixo do valor do cupom, devolvendo ao saldo as contribuições das demais notas, (4) nunca deixar saldo negativo, (5) registrar tudo na auditoria.
- Cupom `UTILIZADO`: **nunca cancelado automaticamente**; se perder lastro, grava evento de auditoria próprio e registra o déficit (sem alterar o fato de que foi utilizado).

## ETAPA 5 — Reconstrução (dados, com confirmação)

Executada logo depois da migração, sem cancelar notas no meio. Para cada participante, na ordem de `cupons_processado_em`:

1. `DELETE FROM sorteio_cupons WHERE sorteio_id = <sorteio>` — a exclusão mostra um cartão de confirmação antes de rodar (17 registros).
2. Reinserir os cupons com os **mesmos 15 números** reaproveitados na mesma ordem de geração (para não mudar o número que o cliente vê), com `valor_base_centavos = 2000`, `status = 'ATIVO'` e `nota_id` = a nota que originou cada cupom.
3. Inserir as 20 linhas de contribuição. Composição exata que a ordem FIFO produz:
```
3a35dd9d (12 cupons)
 1  160699 2000
 2  160699 2000
 3  160699  800 + 160769 1200
 4  160769 2000
 5  160769 2000
 6  160769 2000
 7  160769 2000
 8  160769  800 + 160877 1200
 9  160877 2000
10  160877 2000
11  160877 2000
12  160877 585 + 160988 200 + 160976 900 + 160987 315
5ad01b24 (3 cupons)
 1,2,3  cada um 160947 2000
```
4. Inserir as 7 linhas de fontes: `valor_original` = valor da nota, `valor_pendente` = resíduo (só a nota 160987 fica com 85 e a 160947 com 300; as demais em `ESGOTADO`), `status` correspondente.
5. Gravar `sorteio_participantes.saldo_centavos` = soma dos resíduos (85 e 300 — mesmos valores de hoje) e inserir na auditoria o evento de reconstrução.

**Consequência a confirmar:** os 2 cupons cancelados de hoje (01-872584 e 01-252279) deixam de existir, porque correspondiam a notas já canceladas e não têm lastro nas notas válidas. Seus registros de auditoria permanecem. Se preferir mantê-los visíveis como histórico, eu os reinsero como `CANCELADO` sem contribuição.

## ETAPA 6 — Conferências depois da reconstrução

Tabela final: participante, saldo antes, notas processadas, valor das notas, cupons reconstruídos, valor consumido, saldo depois, diferença.
Invariantes verificadas por consulta:
- `sum(valor_pendente_centavos)` = `sorteio_participantes.saldo_centavos` para todos os participantes;
- `sum(contribuições)` = `valor_base_centavos` para cada cupom;
- nenhum cupom sem contribuição (17 cupons, 20 contribuições);
- nenhum cupom com valor maior que o lastro das notas válidas;
- `sorteio_notas`, `sorteio_participantes`, `clientes`, `sorteios` e `sorteio_auditoria` inalterados, exceto o campo de saldo.

## ETAPA 7 — Testes no banco de desenvolvimento

1. Nota R$ 18,00 + nota R$ 5,00 → 1 cupom com linhas 1800/200, fonte B pendente R$ 3,00, saldo R$ 3,00.
2. Cancelar a nota de R$ 5,00 → cancela exatamente o cupom afetado; os R$ 18,00 voltam ao pool.
3. Notas R$ 5,00 + R$ 5,00 + R$ 15,00 → 1 cupom com três linhas e saldo R$ 5,00.
4. Cancelar uma das três notas → composição recalculada e só o cupom sem lastro cancelado.
5. Nota que só gera saldo → nenhum cupom cancelado.
6. Reprocessar nota → nenhum cupom, contribuição ou fonte duplicada.
7. Processamentos simultâneos do mesmo participante → um único efeito.
8. Cupom `UTILIZADO` → não cancelado, déficit registrado.
9. Nota cancelada antes de processar → nada gerado nem cancelado.
10. Todos os invariantes conferidos novamente ao final.
Os testes são feitos em modo de ensaio (tudo desfeito ao final) e a base reconstruída dos 17 cupons fica gravada.

## Fora de escopo
Notas, participação, clientes, validação, cancelamento de notas, integrações com a loja, API local, fila, cursores, cron e demais módulos. Nada em produção.
