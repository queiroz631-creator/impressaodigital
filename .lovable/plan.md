# Rastreabilidade da origem do valor dos cupons — diagnóstico e proposta (nada será implementado agora)

## A) Diagnóstico atual (conferido no banco, sem alterar nada)

**Estruturas hoje**
- `sorteio_notas`: `valor_centavos`, `status`, `cupons_gerados`, `saldo_gerado_centavos`, `cupons_processado_em` (marca de idempotência). Não guarda quanto do seu valor foi consumido.
- `sorteio_cupons`: `nota_id` (NOT NULL, uma nota só), `valor_base_centavos`, `status`, `gerado_em`, `cancelado_em`. **Não existe nenhuma tabela de composição**: um cupom sabe em qual nota nasceu, não quais notas o financiaram.
- `sorteio_participantes`: um único número, `saldo_centavos`, sem decomposição por nota.

**Como o saldo é consumido hoje** (`sorteio_gerar_cupons_da_nota`, SECURITY DEFINER): trava a participação com `FOR UPDATE`, soma `saldo_centavos + valor_da_nota`, divide por `valor_por_cupom`, insere os cupons apontando **todos** para a nota atual, grava o troco e marca `cupons_processado_em`. A mistura de valores acontece dentro de um único número e depois é perdida.

**Cancelamento** (`sorteio_notas_propagar_cancelamento` → `sorteio_propagar_cancelamento_nota`): cancela os cupons com `nota_id` da nota e chama `sorteio_recalcular_saldo_participante`, que usa a regra agregada `saldo = maior(0, notas VÁLIDAS processadas − cupons que continuam valendo)` e, se sobrarem cupons sem lastro, cancela o **mais recente ATIVO** (`ORDER BY gerado_em DESC`) — a escolha arbitrária que você recusou.

**Cupons utilizados:** nenhum código do projeto grava `UTILIZADO` ainda (o mecanismo do sorteio/`sorteio_ganhadores` não está implementado). Nenhum cupom `UTILIZADO` existe no banco hoje. A regra pode ser definida antes de virar realidade.

## B) Proposta de estrutura (a menor que resolve)

**Tabela 1 — `sorteio_cupom_contribuicoes`** (histórico imutável, a resposta da sua pergunta)
```
id, sorteio_id, participante_id, cupom_id -> sorteio_cupons (RESTRICT),
nota_id -> sorteio_notas (RESTRICT, NULL = bloco herdado não rastreado),
valor_centavos (> 0), ordem, criado_em
UNIQUE (cupom_id, nota_id)
```
Uma nota pode aparecer em vários cupons; um cupom pode ter várias notas; o valor fica gravado no momento da formação e nunca é reescrito.

**Tabela 2 — `sorteio_saldo_fontes`** (quanto de cada nota ainda está disponível)
```
id, sorteio_id, participante_id, nota_id -> sorteio_notas (NULL = bloco herdado),
valor_original_centavos, valor_pendente_centavos (>= 0),
status ('PENDENTE'|'ESGOTADO'|'CANCELADO'), criado_em, atualizado_em
```
Invariantes verificáveis: `sum(valor_pendente) = sorteio_participantes.saldo_centavos` e, para cada nota, `valor_original = valor_pendente + soma das contribuições`.

Por que as duas: sem a tabela 2 não é possível saber o resíduo de cada nota nos casos antigos (ver F), e sem a tabela 1 não existe o vínculo exigido. Nenhuma das duas cria "um segundo saldo do cliente": `sorteio_participantes.saldo_centavos` continua sendo o número oficial das telas; a decomposição só serve para decidir qual cupom cancelar.

Regra de cancelamento passa a ser: **cancela-se exatamente o cupom cujo lastro (soma das contribuições de notas que continuam VÁLIDAS) ficou abaixo do valor dele** — não mais o "mais recente". Como o lastro de um cupom não depende de outros cupons, não há efeito cascata: uma única passada resolve.

## C) Exemplo do cupom formado por duas notas

Nota A R$ 18,00, Nota B R$ 5,00, cupom R$ 20,00 → `sorteio_cupom_contribuicoes`:
```
cupom X  <- nota A  1800
cupom X  <- nota B   200
saldo: bloco da nota B com valor_pendente 300
```
Cancelando B: o sistema vê a linha de 200, conclui que o cupom X perdeu lastro (1800 < 2000) e cancela **o X** — sabendo quanto daquela nota estava dentro dele.

## D) Caso real: nota 161033 (nenhum dado alterado)

Estado atual do participante: saldo **R$ 16,85**, 12 cupons ATIVOS, 2 CANCELADOS, 0 UTILIZADOS.

Simulação FIFO em ordem de processamento (o que a composição deveria ter gravado):
```
160699  R$48,00  2 cupons  sobra  800 (da própria)
160769  R$100,00 5 cupons  consome 800 de 160699 + 9200  sobra 800
160877  R$77,85  4 cupons  consome 800 de 160769 + 7200  sobra 585
160988  R$ 2,00  0 cupons
160976  R$ 9,00  0 cupons                       pool 1685
160987  R$ 4,00  1 cupom = 585+200+900+315       sobra 85
161034  R$ 4,00  0 cupons
161033  R$ 5,00  0 cupons                       pool 985
161035  R$ 2,00  0 cupons                       pool 1185
161036  R$19,00  1 cupom = 85+400+500+200+815    sobra 1085
        (161036 cancelada 23:10:49 -> cupom 01-872584 cancelado;
         os 1185 das outras notas voltam; os 815 dela somem com a nota)
161037  R$10,00  1 cupom = 85+400+500+200+815    sobra 185
```
Cancelando 161033 (R$ 5,00): **os 500 estavam dentro do cupom 01-252279** (e antes, dentro do 01-872584, já cancelado). Com composição, o sistema cancela exatamente o 01-252279 por perda de lastro, devolve os 1500 restantes ao pool → saldo 1685 e 12 cupons. A regra atual chegou ao mesmo número por coincidência (era o cupom ATIVO mais recente); em outro dia ela poderia cancelar um cupom que não usou nada da nota cancelada.

**O que os dados atuais permitem e não permitem reconstruir:** a cadeia de `saldo_gerado_centavos` bate com o cálculo em 11 das 12 notas processadas, e a única divergência é exatamente a nota 161037 — porque houve um cancelamento entre as duas gerações. Ou seja: **não é possível reconstruir a composição dos cupons existentes com 100% de certeza** a partir do que está gravado.

## E) Cupons utilizados (precisa da sua aprovação — não vou inventar)

Cupom `UTILIZADO` é o único que não pode ser desfeito. Quando uma nota que o financiou é cancelada, o cupom fica com lastro menor que o valor dele. Consequências e opções:

1. **Nunca cancelar cupom utilizado** (recomendado): o saldo do cliente é reduzido até onde der (nunca negativo) e, se ainda sobrar diferença entre o que os cupons valem e o que as notas cobrem, isso é gravado como déficit na auditoria e mostrado como alerta no painel para decisão humana. O prêmio já entregue não é tocado.
2. **Bloquear o cancelamento da nota** quando ela financia um cupom utilizado, obrigando tratamento manual antes.
3. **Cancelar o cupom utilizado também**, com estorno/reposição decidido à mão.
4. **Ratear o prejuízo** entre os cupons afetados (não recomendo: cria regra nova de negócio).

Qualquer uma exige o indicador de déficit no painel, porque sem ele a perda fica invisível.

## F) Cupons antigos (17 no total: 15 ATIVOS, 2 CANCELADOS)

Não vou inventar a composição deles. Estratégia segura:
- Os cupons existentes ficam **sem linhas de contribuição** = "não rastreados"; continuam valendo e continuam contados pela regra agregada.
- O saldo atual de cada participante entra como **um bloco único** (`nota_id NULL`, "saldo herdado"), que nunca é cancelável e sempre conta como lastro.
- A partir daí, toda geração nova grava composição exata e o cancelamento deixa de ser arbitrário.
- Enquanto um cancelamento depender de um cupom antigo (sem linhas), o sistema não consegue identificar qual era e mantém o comportamento de hoje como último recurso, com auditoria explícita `motivo: sem_rastreio`. Alternativas que você pode escolher: (a) aceitar isso só para os 15 antigos; (b) em vez de cancelar arbitrariamente, **não cancelar nada** e registrar déficit para revisão manual.

## G) Impacto nas funções existentes

- `sorteio_gerar_cupons_da_nota`: mesma assinatura e mesmo retorno; depois de calcular quantos cupons cabem, consome os blocos em ordem FIFO (`FOR UPDATE`), insere os cupons e uma linha de contribuição por bloco usado, baixa `valor_pendente` e grava o saldo. Regra dos R$ 20,00, limite do sorteio, numeração aleatória e auditoria permanecem.
- `sorteio_recalcular_saldo_participante`: mesma assinatura; substitui o laço "cancelar o mais recente" pela passada de lastro sobre cupons rastreados, mantém a fórmula agregada, o piso em zero, a auditoria e o registro de déficit.
- `sorteio_propagar_cancelamento_nota`: continua chamando o recálculo; passa também a marcar a fonte da nota como `CANCELADO`.
- Validação, portal, painel, API local, fila, cursores e sincronização: **sem alteração** (as telas seguem lendo `sorteio_participantes.saldo_centavos`).
- Novas tabelas: RLS ativada, políticas só para o painel (`pode_sorteios()`), `GRANT` a `authenticated`/`service_role`, sem acesso anônimo — mesma padrão das demais tabelas do módulo.

## H) Plano de migração (só depois da sua aprovação)

1. Migração 0005: criar as duas tabelas com FKs, `CHECK`, únicos, índices (`nota_id`, `cupom_id`, `participante_id`), `GRANT`s, RLS e políticas.
2. Carga inicial (via consulta, não migração): um bloco herdado por participante com saldo maior que zero; conferência de `sum(valor_pendente) = saldo_centavos`.
3. Migração 0006: regravar o corpo das duas funções (e do trigger, se necessário) já usando composição — depois da carga, para que a primeira geração rastreada encontre a tabela consistente.
4. Atualizar tipos gerados; nenhuma tela obrigatória. Opcional depois: mostrar a composição na tela de cupons.

## I) Testes necessários (ensaio, sem gravar dados)

1. A R$18,00 + B R$5,00 → 1 cupom com linhas 1800/200 e saldo R$3,00.
2. Cancelar B → cupom cancelado, saldo devolve só o que não estava no cupom.
3. Cancelar A → mesmo comportamento pelo lado de A.
4. Três notas encadeadas (R$5,00 + R$5,00 + R$15,00) → 1 cupom com três linhas somando 2000 e saldo R$5,00.
5. Reprocessar qualquer nota → 0 cupons e 0 linhas novas.
6. Cancelar nota que só gerou saldo → saldo cai, nenhum cupom cancelado.
7. Cancelar nota que financiou cupom → cancela exatamente esse cupom (não o mais recente).
8. Cancelar nota que financia cupom UTILIZADO → comportamento da regra que você aprovar + registro de déficit.
9. Nota cancelada antes de processar → nada muda.
10. Quatro processamentos simultâneos do mesmo participante → um só efeito, sem cupom nem linha duplicada.
11. Invariante `sum(valor_pendente) = saldo_centavos` conferida depois de cada operação.
12. Participante com bloco herdado (caso antigo) → saldo continua correto e o cupom antigo não é cancelado por engano.

## Fora de escopo
Valor por cupom, elegibilidade, participação, validação, fila, cursores, API local, banco da loja e demais módulos. Sem migração, sem alteração de função, trigger ou frontend neste passo. Sem commit, push, deploy ou publicação.
