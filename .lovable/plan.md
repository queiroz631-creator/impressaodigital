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

- Coluna `usuario_id` em `sorteio_ganhadores` (quem realizou), mais índice único garantindo uma unidade de prêmio por posição — impede sortear duas vezes a mesma unidade.
- Função `sorteio_realizar(_sorteio_id, _usuario_id)`, `SECURITY DEFINER`, restrita a `service_role`, em uma única transação: trava o sorteio com `FOR UPDATE`, confere que o status é `ENCERRADO`, localiza o próximo prêmio ativo com unidade disponível na ordem cadastrada, monta a urna (cupons do sorteio não cancelados, de participantes que concorrem, excluindo participantes já premiados), sorteia com aleatoriedade do banco, insere o ganhador, grava auditoria `sorteio.realizado` (sorteio, prêmio, cupom, participante, usuário, data/hora, status anterior e posterior) e, quando não restar unidade disponível, atualiza o sorteio para `SORTEADO`. Qualquer falha desfaz tudo. Sem prêmio disponível ou sem cupom elegível devolve resposta controlada, não erro.
- Grants conforme o padrão atual das demais funções do módulo.

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
