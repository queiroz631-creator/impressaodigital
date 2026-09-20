# Reabertura controlada do sorteio encerrado

## Objetivo

Permitir que um administrador reabra um sorteio que está **ENCERRADO**, voltando para **ATIVO**, de forma controlada, auditada e transacional. Hoje o módulo não permite voltar a uma situação anterior; esta etapa cria a única exceção, somente para o encerramento. Nada muda para sorteios SORTEADOS ou CANCELADOS — esses continuam sem retorno.

## O que já existe (reaproveitado, sem alteração)

- Estados e transições em `services/status.ts` e no banco.
- Colunas `encerrado_em` / `encerrado_por` / `conferencia_encerramento` em `sorteios`.
- Trigger `sorteio_bloquear_base_encerrada` nas 5 tabelas-base (participantes, notas, cupons, fontes, contribuições): bloqueia enquanto ENCERRADO/SORTEADO/CANCELADO. Como a reabertura volta para ATIVO, a base volta a aceitar movimentação normal automaticamente — **nenhum ajuste no trigger é necessário**.
- Auditoria `sorteio_auditoria` e permissão `sorteios.gerenciar`.
- Aba "Encerramento" com a conferência.

## O que será criado

### 1. Migração `0012_reabertura_sorteio.sql` — RPC `sorteio_reabrir(_sorteio_id uuid, _usuario_id uuid)`

SECURITY DEFINER, GRANT EXECUTE apenas para service_role (mesmo padrão das demais), tudo em uma única transação, nesta ordem:

1. Trava o sorteio com `FOR UPDATE` (concorrência: duas reaberturas simultâneas — só a primeira vale).
2. Confere que o status é **ENCERRADO**. Qualquer outro status devolve resposta controlada `IGNORADO` com motivo (não é erro bruto):
   - ATIVO → "já está ativo";
   - SORTEADO → "já foi sorteado e não pode ser reaberto";
   - CANCELADO → "está cancelado e não pode ser reaberto";
   - RASCUNHO → "ainda está em rascunho".
3. Atualiza para ATIVO, **limpando** `encerrado_em` e `encerrado_por`.
4. **Preserva** `conferencia_encerramento` como retrato histórico do encerramento anterior (não apaga histórico).
5. Grava auditoria `sorteio.reaberto` com: sorteio, usuário, data/hora, situação anterior (ENCERRADO) e posterior (ATIVO).
6. Retorna `resultado: 'REABERTO'` + dados do sorteio. Qualquer falha desfaz tudo.

### 2. Backend

- `src/lib/sorteios-encerramento.server.ts`: nova operação `reabrirSorteioNoBanco` chamando a RPC via supabaseAdmin, traduzindo `IGNORADO` como resposta controlada.
- `src/lib/sorteios.functions.ts`: nova server function `reabrirSorteio` — `requireSupabaseAuth` + permissão `sorteios.gerenciar`, no padrão das funções de encerramento.

### 3. Frontend

- `services/status.ts`: ENCERRADO passa a permitir também ATIVO na máquina de estados; rótulo "Reabrir sorteio". (A regra "nunca voltar" ganha esta única exceção documentada.)
- Aba "Encerramento" (`ConferenciaEncerramento`): quando o sorteio está ENCERRADO, aparece o botão **"Reabrir sorteio"** com confirmação: "Tem certeza que deseja reabrir este sorteio? Após a reabertura, novas notas, participações e cupons voltarão a alterar a base deste sorteio." Botões "Cancelar" e "Reabrir sorteio".
- Após reabrir: invalida as consultas, mostra confirmação e a conferência volta ao modo "sorteio ativo".
- A aba "Sortear" deixa de aparecer ao voltar para ATIVO (comportamento já existente no NavSorteio, sem alteração).

## Efeitos da reabertura (consequências explícitas)

- O sorteio volta a aceitar notas, participações, geração e cancelamento de cupons normalmente.
- O retrato da conferência do encerramento anterior permanece gravado como histórico; a auditoria registra quem reabriu e quando.
- Se já houver **qualquer ganhador registrado** (sorteio SORTEADO), a reabertura é recusada — não se reabre apuração.
- Para encerrar de novo, a conferência será refeita do zero na nova tentativa (regra já existente).

## Fora do escopo

- Não altera apuração, ganhadores, fechamento, notas, saldo, fontes, contribuições, validação, sincronização, fila, Lojamix ou API local.
- Não cria novos status; usa somente os existentes.
- Sem testes finais, sem reabertura real em dados reais, sem commit/push/deploy/publicação.

## Validação ao final

- `bunx tsgo --noEmit` e verificação do build.
- Resumo: estruturas reutilizadas, o que foi criado, pontos a validar depois.
