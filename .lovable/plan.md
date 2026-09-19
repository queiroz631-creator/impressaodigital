# Aba "Sortear" e apuração do cupom vencedor

Nova etapa do módulo de Sorteios: apuração dos prêmios de um sorteio já encerrado, com resultado registrado de forma permanente e a mudança final de Encerrado para Sorteado.

## O que já existe e será reaproveitado

Verificado no banco e no código:

- Prêmios já cadastrados por sorteio, com nome, descrição, ordem, quantidade e ativo — nenhuma tabela nova de prêmios.
- Tabela de ganhadores já existe e já tem sorteio, prêmio, participante, cupom, número do cupom, data/hora e observação.
- Cupons, participantes, auditoria, permissões (`sorteios.gerenciar`), regras de acesso, abas do sorteio, cartões de indicador e o padrão visual das telas.
- Os cinco status atuais (Rascunho, Ativo, Encerrado, Cancelado, Sorteado) e a transição Encerrado → Sorteado, já prevista nas regras.

Nada de notas, saldo, fontes, contribuições, geração/cancelamento de cupons, validação, sincronização ou fechamento será alterado.

## Regras da apuração (confirmadas com você)

- Um prêmio com quantidade 3 é sorteado 3 vezes: cada unidade gera um ganhador. O prêmio só fica concluído quando todas as unidades saírem.
- Um participante não pode ganhar duas vezes no mesmo sorteio: quem já ganhou sai da urna nos prêmios seguintes.
- Prêmios inativos não entram na apuração. O sorteio vira Sorteado quando todas as unidades dos prêmios ativos tiverem ganhador.
- A urna usa apenas os cupons deste sorteio, de participantes que concorrem, sem contar cupons cancelados — exatamente a mesma regra de cupom participante que o sistema já usa na conferência.
- Cada clique sorteia uma unidade (o próximo prêmio disponível, na ordem cadastrada).

## A aba "Sortear"

Nova aba no menu do sorteio, ao lado de Painel, Termos, Prêmios, Participantes, Notas, Cupons e Encerramento. Mesma permissão de visualização das demais.

Topo — indicadores:

- Participantes concorrentes (com cupom válido)
- Cupons concorrentes
- Prêmios cadastrados
- Prêmios já sorteados
- Prêmios disponíveis

Lista de prêmios na ordem cadastrada, com nome/descrição, quantidade e a marca "Disponível" ou "Já sorteado" (com o andamento quando houver mais de uma unidade).

Botão "Realizar sorteio" aparece quando o sorteio está encerrado e existe pelo menos 1 participante concorrente, 1 cupom válido e 1 prêmio disponível. Antes de iniciar, confirmação:

"Tem certeza que deseja realizar o sorteio? Após realizar o sorteio, o resultado ficará registrado no histórico e não poderá ser alterado por esta tela."

Se o sorteio não estiver encerrado, a aba mostra apenas o resumo e a mensagem "Este sorteio ainda não está encerrado.", sem botão. Se já estiver Sorteado, mostra somente o resultado e o histórico.

## Animação

Ao clicar, o servidor decide o vencedor primeiro; só depois a tela roda a animação dos números de cupom passando rapidamente na vertical, desacelerando até parar e destacar o número vencedor. A animação é apenas a representação do resultado já definido — ela nunca escolhe nada. Layout adaptado para celular, tablet e computador.

## Resultado e histórico

Depois da animação, card de ganhador com prêmio, número do cupom, participante, cliente e data/hora. O resultado continua visível ao atualizar a página, porque vem do registro no banco.

Abaixo, "Histórico dos ganhadores" com prêmio, cupom, participante, cliente, data/hora e situação, na ordem dos prêmios cadastrados.

## Detalhes técnicos

Migração nova (somente o que falta):

Estado verificado hoje em `sorteio_ganhadores`: id, sorteio, prêmio, participante, cupom, número do cupom, data/hora e observação; índices: chave, único por (sorteio, cupom) e índice por sorteio. Não existe campo de unidade nem de usuário responsável. Prêmios já têm ordem, quantidade e ativo. Só isso será criado:

- Coluna `unidade` (inteiro) em `sorteio_ganhadores`, indicando qual unidade do prêmio foi apurada (1..quantidade), e coluna `usuario_id` (quem realizou).
- Índice único `(sorteio_id, premio_id, unidade)`: garante no máximo um ganhador por unidade e continua permitindo vários ganhadores do mesmo prêmio quando a quantidade é 2, 3, 10 etc. O único existente por (sorteio, cupom) é mantido — nenhum índice atual é removido ou afrouxado.
- Função `sorteio_realizar(_sorteio_id, _usuario_id)`, `SECURITY DEFINER`, restrita a `service_role`, tudo em uma única transação e nesta ordem: trava o sorteio com `FOR UPDATE`; confere que o status é `ENCERRADO`; localiza o primeiro prêmio ativo com unidade ainda disponível, na ordem cadastrada; determina a unidade exata a apurar (menor número livre de 1 até a quantidade); monta a urna com os cupons deste sorteio não cancelados de participantes que concorrem; remove da urna todos os cupons de participantes que já têm qualquer ganhador neste sorteio (regra por participante, não por cupom); sorteia aleatoriamente no banco; insere o ganhador; grava a auditoria `sorteio.realizado`; verifica se restam unidades; e altera para `SORTEADO` somente quando todas as unidades de todos os prêmios ativos tiverem ganhador. Qualquer falha desfaz tudo, inclusive a mudança de status.
- Idempotência e concorrência: a trava mais o índice único por unidade impedem duplicidade. Uma segunda chamada simultânea ou repetida recebe resposta controlada ("esta unidade já foi sorteada" / "não há prêmio disponível"), sem criar outro ganhador e sem erro bruto na tela. Nada disso depende do navegador.
- A resposta da função traz, de uma só vez, tudo que a tela precisa: ganhador, sorteio, prêmio (id e nome), unidade e quantidade total, participante (id e nome), cliente (id e nome), cupom (id e número), data/hora, status atual do sorteio e se foi a última apuração. O frontend não faz uma segunda consulta para descobrir o vencedor.
- Grants conforme o padrão atual das demais funções do módulo.

A animação recebe apenas o número já decidido pelo servidor e a lista de números para o efeito visual; ela não escolhe, não recalcula e não pode ser usada para alterar o resultado — o registro do ganhador já está gravado antes de a animação começar.


A trigger de congelamento da base encerrada continua intacta: ela cobre notas, participantes, cupons, fontes e contribuições — a apuração não escreve em nenhuma delas.

Código:

- `src/lib/sorteios-apuracao.server.ts` — chamada da RPC via cliente de serviço, no padrão de `sorteios-encerramento.server.ts`.
- `src/lib/sorteios.functions.ts` — duas operações novas: resumo da apuração (leitura) e realizar sorteio, ambas autenticadas e passando por `exigirGestao`.
- `src/routes/sorteios.$id.sortear.tsx` — nova tela; `NavSorteio` ganha a aba.
- `src/modules/sorteios/components/PainelSortear.tsx` e `RoletaCupons.tsx` — resumo/prêmios/histórico e a animação.
- Tipos e hooks do módulo estendidos (ganhador com usuário, resumo da apuração), reaproveitando o que já existe.

Ao final: verificação de tipos e de erros de compilação, resumo das alterações e dos objetos reaproveitados. Sem bateria de testes, sem sorteio real, sem publicação.

## Fica para depois

Marcar cupom como utilizado/entrega de prêmio, suplentes, reordenar prêmios durante a apuração e exibição pública do resultado.
