# Sorteios — Etapa 1 (fundação)

Somente base de dados, segurança e estrutura de arquivos. Nenhum portal público, login de participante, API local, sincronização, geração de cupons, validação de notas ou mecanismo de sorteio nesta etapa.

## O que foi encontrado no cadastro de clientes

A tabela de clientes hoje tem: identificador interno, nome, telefone, telefone normalizado, e-mail, observação e datas de criação/alteração — **470 clientes cadastrados**.

Pontos importantes:

- **Não existe campo de CPF** na tabela de clientes. O CPF só existe hoje na tabela de currículos.
- **Não existe campo de data de nascimento** na tabela de clientes (também só nos currículos).
- Já existe unicidade de telefone normalizado.
- O acesso hoje é liberado para qualquer usuário autenticado.
- Como o campo de CPF não existe, **não há duplicidade de CPF a analisar**.

Por isso, o único ajuste indispensável em clientes é acrescentar dois campos novos (CPF e data de nascimento). Nada existente será alterado, renomeado ou removido, e nenhum cliente atual será tocado — os dois campos nascem vazios.

## Ajuste em clientes (mínimo e explicitado)

- Novo campo de CPF, sempre guardado só com números (sem pontos e sem traço).
- Novo campo de data de nascimento.
- Unicidade de CPF aplicada **apenas quando o CPF estiver preenchido**, para que os 470 clientes atuais sem CPF continuem válidos.
- Índice de busca por CPF.
- Nenhum cliente será apagado, mesclado ou modificado.

## Tabelas novas do módulo

Todas usam o cliente existente por referência — nenhuma repete CPF, nome, telefone ou data de nascimento.

1. **sorteios** — nome, descrição, número do sorteio (único), situação (rascunho, ativo, encerrado, cancelado, sorteado), datas de início/fim/sorteio, valor por cupom, limite opcional de cupons, quem criou.
2. **sorteio_termos** — versão dos termos por sorteio (regras, como participar, prêmios, validade, como será realizado), com unicidade por sorteio + versão.
3. **sorteio_participantes** — participação de um cliente em um sorteio: saldo, situação de sincronização, data de sincronização, aceite dos termos (data e versão). Um cliente só pode participar uma vez de cada sorteio, mas pode participar de vários sorteios.
4. **sorteio_notas_base** — notas vindas do sistema da loja: número, valor, data da nota, identificador de origem, datas de sincronização. A data serve apenas para sincronização e auditoria, nunca para validar a nota do participante.
5. **sorteio_notas** — nota informada pelo participante: número, valor, situação (pendente, válida, inválida, cancelada), motivo da invalidez, datas de cadastro/validação/invalidação/cancelamento, vínculo com a nota da base, cupons gerados e saldo gerado. Mesmo número de nota não pode se repetir dentro do mesmo sorteio.
6. **sorteio_cupons** — cupom com vínculo direto à nota que o originou, número, valor base, situação (ativo, cancelado, utilizado) e data de cancelamento. Número único dentro do mesmo sorteio; o número será aleatório (geração fica para a etapa seguinte).
7. **sorteio_historico** — resultado da participação encerrada: número do sorteio, saldo final, quantidade de notas, quantidade de cupons, período e data de encerramento. Nunca apagado ao começar um novo sorteio.
8. **sorteio_premios** — nome, descrição, ordem, quantidade, ativo.
9. **sorteio_ganhadores** — sorteio, prêmio, participante, cupom, número do cupom, data do sorteio e observação.
10. **sorteio_sincronizacoes** — registro de cada execução: tipo (clientes ou notas), direção (para a loja ou da loja), início, fim, situação (executando, concluída, erro, parcial), quantidades enviadas/recebidas/processadas e erro.
11. **sorteio_auditoria** — trilha de eventos do módulo (cadastro, alteração, validação, invalidação, cancelamento de nota, cancelamento de cupom, aceite de termos, sincronização), guardando o que mudou e quem fez. Sem exclusão de registros.

Nada é apagado: notas e cupons cancelados permanecem no banco com sua situação.

## Regras que já ficam garantidas pelo banco nesta etapa

- Cliente não pode ter duas participações no mesmo sorteio.
- Número de cupom não repete dentro do mesmo sorteio.
- Número de nota não repete dentro do mesmo sorteio (evita revalidar a mesma nota).
- Ao cancelar uma nota, os cupons daquela nota passam a cancelados automaticamente, sem apagar nada.
- Ao registrar uma participação nova, saldo, notas e cupons começam em zero.
- A situação de sincronização de uma participação começa como pendente — nada é considerado sincronizado por padrão.

## Segurança

- Todas as tabelas novas ficam com acesso controlado desde a criação, com as permissões de acesso necessárias.
- Nesta etapa, apenas usuários autenticados do painel acessam o módulo, seguindo o padrão de permissão já usado no sistema (administrador e permissão de sorteios).
- O acesso do participante público será feito na próxima etapa, por regras específicas que só devolvem os dados dele — nenhuma regra pública é criada agora.
- Nenhuma permissão de outro módulo é alterada.

## Estrutura de código

Criação de `src/modules/sorteios/` com `components/`, `services/`, `hooks/`, `types/`, `validations/` e `README.md`. Nesta etapa entram apenas: os tipos do módulo, as validações de CPF (somente números) e de nome completo (exige nome e sobrenome), e o README. Nenhuma tela nova, nenhum item novo no menu.

## Detalhes técnicos

- Migrations versionadas em `supabase/migrations/`: (1) campos `cpf` + `data_nascimento` em `clientes` com índice único parcial `WHERE cpf IS NOT NULL`; (2) tabelas do módulo com `GRANT`, RLS e políticas; (3) gatilhos de `updated_at` reaproveitando `public.set_updated_at()` e gatilho de propagação de cancelamento nota → cupons.
- Chaves estrangeiras: participantes → `sorteios`/`clientes`; notas → `sorteios`/`sorteio_participantes`/`sorteio_notas_base`; cupons → `sorteios`/`sorteio_participantes`/`sorteio_notas`; histórico → `clientes`/`sorteios`; prêmios/ganhadores → `sorteios` e cupom/participante.
- Políticas baseadas em `public.has_role(auth.uid(),'admin')` ou `public.tem_permissao(auth.uid(),'sorteios.visualizar')`, sem tocar em políticas existentes.
- CPF como chave de negócio na sincronização; o identificador interno de cada banco nunca é usado para correspondência entre bancos.
- Sem cron, sem endpoints, sem alteração em WhatsApp, Bot, Conexões, Usuários, Orçamentos, Calculadora, Preços ou Currículos. Sem commit e sem push.
- Verificação final: consultas de conferência de chaves, índices, unicidades e RLS; testes das regras acima com dados temporários removidos ao fim; typecheck, lint e build.
