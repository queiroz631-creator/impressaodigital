# Etapa 5 — Infraestrutura de sincronização (5A, 5B, 5C)

Objetivo: preparar toda a estrutura para a futura API local da loja trocar notas e clientes com o sistema, processando **somente quando existe trabalho**. Nenhuma conexão real com o banco da loja é criada nesta etapa.

## O que já existe e será reaproveitado

- `sorteio_sincronizacoes` — hoje é um **registro de execuções** (tipo, direção, início/fim, status, contagens, erro). Continua sendo o log de execução/lote; ganha apenas colunas de diagnóstico.
- `sorteios.base_sincronizada_em` — segue sendo a marca oficial da última base confirmada; passa a ser preenchida somente na confirmação do lote.
- `sorteio_notas_base` (sorteio + número + valor, único por sorteio+número) e toda a regra de validação da Etapa 4 ficam **inalteradas**.
- Rotina protegida por token, no mesmo padrão das rotinas já existentes.

## 5A — Fila de sincronização

Nova tabela de **itens** de sincronização (a atual guarda execuções, não itens):

- tipo (`NOTAS_LOJA_SUPABASE`, `CLIENTES_LOJA_SUPABASE`, `CLIENTES_SUPABASE_LOJA`, aberto a novos tipos), entidade, id da entidade, sorteio quando aplicável;
- origem e destino (`LOJA` / `SUPABASE`), operação (criação/atualização), identificador da operação;
- status `PENDENTE → PROCESSANDO → SINCRONIZADO`, ou `ERRO` com o item continuando disponível para nova tentativa;
- tentativas, última tentativa, processado em, erro, criado/atualizado em;
- número sequencial próprio, usado como cursor pela API local (não depende do relógio da máquina local).

O item da fila guarda **apenas os metadados necessários ao processamento** (tipo, entidade, identificador, sorteio, origem, destino, operação, controle de tentativa). O dado completo do cliente ou da nota **não** é copiado para a fila — ele é lido da tabela oficial no momento do envio.

Acesso: a fila é **fechada**. Nenhum usuário autenticado lê identificadores de clientes, erros, origem/destino, metadados ou qualquer informação interna da sincronização. Só a própria rotina interna (e a API local, via token) acessa esses registros; a observabilidade futura será servida por um resumo agregado (quantidades de pendentes, com erro, última sincronização), nunca pelos registros brutos.

Ordem de trabalho: item pendente mais antigo primeiro; um item só é tomado por uma execução (marcação condicional), então dois processos simultâneos não repetem o mesmo item.

## Idempotência

- Chave de idempotência por evento: origem + entidade + identificador da operação. Reenvio do mesmo lote não cria um segundo item nem um segundo processamento.
- Notas: a unicidade **sorteio + número** já existente é a garantia final — reenvio atualiza o valor, nunca duplica.
- Clientes: o identificador enviado pela loja (ex.: cliente interno `12345` → `origem_id = "12345"`) é **permanente para aquele cliente** — alterar o cadastro na loja não muda o identificador, e é ele que impede duplicidade. Na falta dele, valem as regras atuais do sistema (CPF primeiro, telefone depois). Sincronização nunca exclui cliente.
- Reprocessamento após falha é seguro: reenviar do último ponto confirmado reaplica os mesmos registros sem criar duplicatas.


## Sem loops

Cada evento carrega origem, destino, operação e momento da alteração. Alteração vinda da loja e aplicada aqui é marcada com essa origem e **não** gera um evento de volta para a loja; o mesmo vale no sentido inverso. Só alteração real feita por usuário/sistema gera evento novo.

## 5B — Recebimento de notas (loja → sistema)

Endpoints internos protegidos por token, aceitando **lotes** (ex.: 500 notas em 5 envios de 100), cada lote confirmado de forma independente:

1. abertura do lote (registro de execução);
2. envio das notas do lote (sorteio + número + valor; data nunca usada para identificar);
3. confirmação do lote.

`base_sincronizada_em` é atualizada **somente** na confirmação, e nunca em início de envio, lote parcial ou erro. Falha de qualquer tipo (tempo esgotado, queda, erro de validação) registra erro, tentativa, data/hora, origem e identificador da operação, mantendo o lote como não sincronizado e pronto para reenvio seguro.

## Clientes nos dois sentidos

- **Loja → sistema:** endpoint de lote que cria ou atualiza clientes conforme as regras atuais, sem duplicar e sem excluir, usando o identificador permanente da loja.
- **Sistema → loja:** endpoint de leitura que devolve apenas os itens pendentes a partir do cursor informado pela API local, mais um endpoint de confirmação. O cursor **nunca avança antes da confirmação da API local**: se ela ler até o 102 e falhar, o cursor permanece em 100 (último ponto confirmado) e os itens são reentregues; a idempotência garante que o reprocessamento não duplique nada. Nada de "buscar todos os clientes".

## 5C — Processamento por eventos

Quando um lote de notas é confirmado: registra o evento, atualiza a marca da base, identifica **exatamente o(s) sorteio(s) do lote** e valida apenas as notas pendentes **desse** sorteio. Lote do Sorteio 1 nunca dispara consulta de pendentes de outros sorteios, e nunca faz varredura geral.

Alteração de cliente feita no sistema entra na fila no mesmo instante, para a API local buscar somente o que mudou.


## Reconciliação (rede de segurança)

A rotina atual de validação de 1 minuto passa para **15 minutos** e muda de função: procura apenas situações potencialmente presas — nota pendente em sorteio cuja base já foi sincronizada depois do cadastro, item de fila em processamento há tempo demais, item com erro pronto para nova tentativa. Cada execução fica registrada. Ela existe só para eventos perdidos, API desligada ou requisição interrompida — não é o caminho normal de processamento.

## Segurança e registros

Todos os endpoints exigem token; token nunca aparece em log e nenhuma configuração é devolvida. Nenhum segredo em código ou migração. O log de sincronização (origem, destino, entidade, lote, quantidades, sucesso/erro, tentativas, duração, data/hora) fica separado da auditoria de negócio e é igualmente fechado a usuários autenticados. A estrutura permite montar depois um painel de pendentes, erros e última sincronização a partir de um resumo agregado, sem expor registros internos.

## Fora do escopo

Cupons, saldo, R$ 20 = 1 cupom, sorteio, ganhadores, fechamento, portal público, WhatsApp, Bot, Conexões, banco local da loja e API Desktop real. `concorre_sorteio` não interfere em nada aqui.

## Detalhes técnicos

**Migração**
- Nova `public.sorteio_sincronizacao_fila`: `id uuid`, `sequencia bigserial` (cursor), `tipo text`, `entidade text`, `entidade_id text`, `sorteio_id uuid NULL REFERENCES sorteios(id)`, `origem text`, `destino text`, `operacao text`, `operacao_id text`, `status text default 'PENDENTE'`, `tentativas int default 0`, `ultima_tentativa_em`, `processado_em`, `erro text`, `metadados jsonb NULL` (só o mínimo para processar — sem dados pessoais nem cópia do registro), `criado_em`, `atualizado_em` + trigger `sorteio_set_atualizado_em`. Índice único parcial `(origem, entidade, operacao_id)` onde `operacao_id` não é nulo; índices `(status, sequencia)` e `(tipo, status)`. GRANT apenas `all` para `service_role` (nada para `anon`/`authenticated`); RLS habilitada **sem política** — leitura só pelo servidor com service role.
- `public.sorteio_sincronizacoes`: colunas `lote_id text NULL`, `operacao_id text NULL`, `sorteio_id uuid NULL REFERENCES sorteios(id)`, `origem text NULL`, `destino text NULL`, `duracao_ms int NULL`, `atualizado_em timestamptz default now()`; índice `(tipo, status, iniciado_em desc)`. Nenhuma coluna existente é alterada ou removida; as políticas de leitura existentes desta tabela serão restringidas a `service_role` para não expor erro/origem/destino a usuários autenticados.
- `public.sorteio_sincronizacao_cursores`: `consumidor text primary key`, `sequencia bigint not null default 0`, `atualizado_em`. Avança **somente** na confirmação explícita da API local; mesmos GRANTs restritos.
- `public.clientes`: `origem_id text NULL` — identificador permanente do cliente na loja, nunca reescrito por atualização de cadastro — com índice único parcial; e `origem_alteracao text NULL` para marcar a última origem da alteração (evita eco).

- Trigger em `clientes` (AFTER INSERT/UPDATE): enfileira `CLIENTES_SUPABASE_LOJA` apenas quando `origem_alteracao` não é `LOJA`.
- `cron`: `validar-notas-sorteio` re-agendada para `*/15 * * * *` chamando `disparar_rotina_sorteios('reconciliar')`; nova rota substitui a chamada de 1 minuto.

**Servidor**
- `src/lib/sorteios-sync.server.ts`: `abrirLote`, `receberNotasLote`, `confirmarLote` (atualiza `base_sincronizada_em` e enfileira o evento de validação por sorteio), `receberClientesLote`, `lerAlteracoesClientes(cursor, limite)`, `confirmarCursor(consumidor, sequencia)`, `tomarItens`/`marcarSincronizado`/`marcarErro`, `reconciliar()`.
- `src/lib/sorteios-eventos.server.ts`: enfileiramento idempotente (upsert por `(origem, entidade, operacao_id)`, apenas metadados) e disparo da validação por sorteio via `validarNotasPendentesDoSorteio(sorteioId)`.
- `src/lib/sorteios-validacao.server.ts`: adiciona `validarNotasPendentesDoSorteio(sorteioId, limite)` — filtra `.eq("sorteio_id", sorteioId).eq("status","PENDENTE")` e reutiliza `validarNotaPorId` sem tocar na regra existente; `validarNotasPendentes` permanece apenas para reconciliação.

- Novas rotas, todas `POST` com `?token=` conferido contra `whatsapp_config.webhook_token`, 401 sem corpo detalhado: `src/routes/api/public/sorteios/sync/notas-lote.ts`, `.../notas-confirmar.ts`, `.../clientes-receber.ts`, `.../clientes-alteracoes.ts`, `.../clientes-confirmar.ts`, `src/routes/api/public/sorteios/reconciliar.ts`. Todas validam entrada com Zod e devolvem apenas resumo.
- `src/modules/sorteios/types/index.ts`: tipos `TipoSincronizacao` ampliado, `StatusFilaSincronizacao`, `SorteioSincronizacaoItem`, `clientes.origem_id`.

**Não alterado:** `validarNotaPorId`, portal público, `sorteios.$id.notas.tsx`, cupons, saldo, RLS existente, WhatsApp/Bot/Conexões.

Sem testes, commit, push, deploy ou publicação.
