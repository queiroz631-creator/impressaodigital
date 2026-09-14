# Sorteios — Etapa 2 (administração)

Somente a área administrativa: criar, configurar e acompanhar sorteios. Nada de portal público, login do participante, cadastro público de notas, sincronização, API local, geração de cupons ou mecanismo do sorteio.

## Menu e permissão

- O item **Sorteios** já existe no grupo Marketing como planejado (inativo, sem página). Passa a ficar ativo apontando para `/sorteios`, mantendo a chave de permissão já criada na Etapa 1.
- Ver as telas exige a permissão de Sorteios (administrador vê tudo). Criar, alterar e mudar situação exige uma permissão adicional de gerenciamento, acrescentada à lista de permissões sensíveis já existente — nenhuma permissão de outro módulo é tocada.
- A nova permissão de gerenciamento entra apenas no catálogo: nenhum perfil ou usuário existente a recebe automaticamente. Só administradores já têm acesso; os demais dependem de concessão manual.
- Quem não tem permissão continua vendo a tela padrão de acesso negado.

## Páginas

- **/sorteios** — lista com número, nome, situação, datas de início/fim/sorteio, valor por cupom e as quantidades reais de participantes, notas e cupons. Botão "Novo sorteio" e ações Abrir/Editar, mais as ações de situação permitidas em cada caso.
- **/sorteios/novo** e **/sorteios/:id/editar** — formulário com nome, número, descrição, datas, valor por cupom e limite opcional de cupons.
- **/sorteios/:id** — painel do sorteio com todos os dados de configuração e os indicadores contados no banco: participantes, notas (total, pendentes, válidas, inválidas, canceladas) e cupons (total, ativos, cancelados). Espaço de Ganhadores fica apenas indicado como próxima etapa, sem botão de sortear.
- **/sorteios/:id/termos** — versões dos termos: versão, título, regras, como participar, validade, como será realizado, informações adicionais. Várias versões por sorteio, uma única marcada como atual, nenhuma versão apagada.
- **/sorteios/:id/premios** — criar, editar, ativar/desativar e ordenar prêmios (nome, descrição, quantidade, ordem, ativo).
- **/sorteios/:id/participantes** — lista dos participantes existentes com nome, CPF e telefone parcialmente mascarados, saldo, notas, cupons, situação de sincronização e data de entrada, com busca por nome ou CPF.
- **/sorteios/:id/notas** — lista das notas existentes com filtro por situação; sem qualquer validação automática.
- **/sorteios/:id/cupons** — lista dos cupons existentes com filtro por situação; sem geração de cupons.

Onde ainda não houver dados, cada tela mostra um aviso de lista vazia — nenhum dado de exemplo é criado.

## Regras de situação

- Rascunho → ativo ou cancelado.
- Ativo → encerrado ou cancelado.
- Encerrado → sorteado ou cancelado.
- Sorteado → somente consulta.
- Cancelado → somente consulta.

Nunca é possível voltar para uma situação anterior. Toda mudança de situação é conferida no servidor imediatamente antes da gravação, relendo a situação atual do banco — a tela nunca decide sozinha.

## Proteção do sorteio com movimentação

Assim que o sorteio deixa de ser rascunho ou passa a ter qualquer movimentação — participantes, notas ou cupons, inclusive registros já cancelados ou registros no histórico —, os campos críticos (número, data de início, data de fim e valor por cupom) ficam bloqueados na tela e recusados no servidor, com a mensagem: "Este sorteio já possui movimentações e seus dados críticos não podem ser alterados." Cancelar ou apagar registros não libera a proteção, porque a verificação considera toda a movimentação histórica. Nome, descrição, data do sorteio e limite de cupons continuam editáveis. A checagem é refeita no servidor imediatamente antes de gravar.

## Exclusões

Sorteios não são excluídos — são cancelados. Notas, cupons, participantes com movimentação, histórico e auditoria nunca são apagados. Versões de termos nunca são apagadas, nem as antigas nem as substituídas; um prêmio só pode ser removido enquanto não tiver relacionamento, caso contrário é desativado.

## Registro de eventos

Cada criação de sorteio, alteração, mudança de situação, criação/alteração de termos, definição da versão atual e criação/alteração/ativação de prêmio grava um registro na trilha de auditoria já existente, com usuário, evento, data e os campos alterados.

## Ajuste necessário no banco

Uma única migração pequena, só no módulo Sorteios: a tabela de termos ganha o campo **título** e um marcador de **versão atual**, com garantia no banco de que só existe uma versão atual por sorteio. Nada mais é alterado — a tabela de clientes e as demais tabelas ficam intactas.

## Detalhes técnicos

- Migração: `ALTER TABLE public.sorteio_termos ADD COLUMN titulo text NOT NULL DEFAULT ''`, `ADD COLUMN atual boolean NOT NULL DEFAULT false` + índice único parcial `UNIQUE (sorteio_id) WHERE atual`. Sem GRANT/RLS novos (tabela já existente, políticas da Etapa 1 mantidas).
- Rotas TanStack no padrão do projeto: `src/routes/sorteios.index.tsx`, `sorteios.novo.tsx`, `sorteios.$id.index.tsx`, `sorteios.$id.editar.tsx`, `sorteios.$id.termos.tsx`, `sorteios.$id.premios.tsx`, `sorteios.$id.participantes.tsx`, `sorteios.$id.notas.tsx`, `sorteios.$id.cupons.tsx`, todas envolvidas em `<AppLayout permissao="sorteios.visualizar">` + `PageHeader`, com `head()` próprio.
- Leituras via `supabase` do cliente + TanStack Query (RLS `pode_sorteios()` da Etapa 1); contadores por `select('id', { count: 'exact', head: true })` filtrados por `sorteio_id`.
- Escritas em `src/lib/sorteios.functions.ts` (`createServerFn` + `requireSupabaseAuth`), validando por RPC `has_role('admin')` **ou** `tem_permissao(auth.uid(),'sorteios.gerenciar')`, relendo o sorteio no servidor (situação atual + contagem de participantes/notas/cupons/histórico, inclusive cancelados) imediatamente antes de cada `UPDATE`, com `.eq('status', <situação lida>)` na gravação para impedir corrida, e gravando em `sorteio_auditoria` na mesma operação. Nunca confia no payload do navegador.
- Definir termos como atual: função no banco (`public.sorteio_definir_termos_atual(_termos_id uuid)`, `SECURITY DEFINER`, criada na mesma migração) que dentro de uma única transação desmarca a versão atual anterior do sorteio e marca a nova, protegida pelo índice único parcial. Nenhuma versão é apagada.
- Nenhuma tabela, política ou funcionalidade fora do módulo Sorteios é alterada — apenas a migração descrita em `sorteio_termos`.
- Módulo: `src/modules/sorteios/validations/sorteio.ts` (Zod: nome, número único, datas coerentes, valor > 0, limite > 0 quando informado, prêmio, termos), `services/status.ts` (transições permitidas e campos críticos), `components/` (badge de situação, cartão de indicador, tabela responsiva, formulários de sorteio/prêmio/termos), `hooks/` (consultas do módulo). `types/index.ts` recebe `titulo` e `atual` nos termos.
- Dinheiro sempre em centavos (`integer`); entrada e exibição em formato brasileiro com `brl`, conversão sem float acumulado. Datas com `datetime-local`, convertidas para ISO na gravação e exibidas com `dataHoraBR`; nenhum ajuste de timezone global.
- `PERMISSOES_SENSIVEIS` em `src/lib/modulos.ts` recebe `sorteios.gerenciar`; item Sorteios passa a `ativo: true`, `rota: "/sorteios"`.
- Verificação: fluxo completo (criar rascunho, editar, ativar, encerrar, número duplicado, datas inválidas, termos v1/v2 com uma única atual, prêmios, contadores, telas de participantes/notas/cupons vazias, auditoria) com dados temporários removidos ao fim; typecheck, lint e build. Sem commit e sem push.
