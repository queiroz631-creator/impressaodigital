# Etapa 4 — Validação das notas do sorteio

Nota cadastrada nasce **Pendente**. Uma rotina automática confere cada nota pendente contra a base de notas do sorteio e a marca como **Válida** ou **Inválida**. Nenhum cupom e nenhum saldo é gerado nesta etapa.

## Como a conferência funciona

Ordem exata da rotina, para cada nota Pendente:

1. Procura na base do **mesmo sorteio** uma nota com o mesmo **número** e o mesmo **valor** (a data da nota nunca é usada).
2. Encontrou → **Válida** (guarda a nota da base correspondente e a data/hora da validação).
3. Não encontrou → consulta a **data/hora da última sincronização da base daquele sorteio**:
   - sem sincronização registrada → continua **Pendente**;
   - última sincronização **anterior** ao cadastro da nota → continua **Pendente**;
   - última sincronização **posterior** ao cadastro da nota → **Inválida**.

Assim ninguém recebe "inválida" só porque a base da loja ainda não foi atualizada.

Regras preservadas: nota **Válida** nunca é reprocessada; nota **Cancelada** nunca volta para a fila; nada é apagado; participante marcado como "Não concorre" continua tendo suas notas validadas.

## Somente sorteios ativos

Antes de mexer em qualquer nota, o sorteio é relido. Só sorteio **Ativo** permite validação. Rascunho, Encerrado, Cancelado e Sorteado são ignorados pela rotina, e na tela a ação manual avisa que aquele sorteio não permite mais validar notas. Nenhum status de nota muda nesses casos.

## Rotina automática (a cada 1 minuto)

Segue o mesmo modelo já usado pelas rotinas de WhatsApp: um agendamento no banco chama, a cada minuto, um endereço interno protegido por token, que processa um **lote limitado** de notas pendentes (não tenta validar todas de uma vez). A resposta traz apenas o resumo: analisadas, válidas, inválidas e pendentes. O token nunca aparece em registros de log e nenhuma informação de configuração é devolvida.

Observação de custo: uma verificação por minuto significa 1.440 execuções por dia e mantém o banco ativo mesmo sem nota pendente, o que aumenta um pouco o consumo. A alternativa mais econômica seria a cada 5 minutos (atraso máximo de 5 minutos). Seguirei com 1 minuto, conforme solicitado.

## Base de notas preparada para a sincronização futura

Cada nota da base passa a pertencer obrigatoriamente a um sorteio, com número e valor. Fica uma regra de "não repetir a mesma nota no mesmo sorteio" e uma busca rápida por sorteio + número + valor. Nenhuma nota é importada agora — apenas a estrutura fica pronta para a etapa de sincronização com o sistema da loja.

## Correção de nota inválida

O fluxo do portal que corrige número e valor e devolve a nota para **Pendente** já existe e será preservado sem alterações. Ao voltar para Pendente, a rotina a reavalia normalmente. Nenhum cupom, saldo ou nova participação é criado.

## Tela administrativa de notas

- Mantém os filtros e o layout atuais, com os rótulos Pendente / Válida / Inválida / Cancelada.
- Ganha a ação **Validar** apenas nas notas Pendentes (para quem tem permissão de gerenciar sorteios). Notas Válidas e Canceladas não exibem a ação.

## Auditoria

Cada mudança real registra: sorteio, participante, nota, usuário (ou "rotina"), data/hora, origem, status anterior e novo (Pendente → Válida ou Pendente → Inválida) e a nota da base usada. Só grava quando a nota realmente muda de estado — sem duplicidade.

## Detalhes técnicos

**Migração**
- `public.sorteio_notas_base`: coluna `sorteio_id uuid NOT NULL REFERENCES public.sorteios(id)` (tabela está vazia hoje), índice único `(sorteio_id, numero)` e índice de busca `(sorteio_id, numero, valor_centavos)`.
- `public.sorteios`: coluna `base_sincronizada_em timestamptz NULL` — marca d'água da última sincronização da base daquele sorteio, usada pela regra Pendente/Inválida. Nenhuma outra tabela é alterada.
- Nova função `public.disparar_rotina_sorteios()` (security definer, espelhando `disparar_rotina_bot`: lê `webhook_token`/`app_url` de `whatsapp_config` e faz `net.http_post`) + `cron.schedule('validar-notas-sorteio', '* * * * *', ...)`.
- Sem mudanças de RLS; `sorteio_notas_base` continua sem exposição pública.

**Servidor**
- Novo `src/lib/sorteios-validacao.server.ts`:
  - `validarNotaPorId(notaId, origem, usuarioId)` — relê nota (`sorteio_id`, `participante_id`, `numero`, `valor_centavos`, `status`, `cadastrado_em`) e o sorteio (`status`, `base_sincronizada_em`); aborta se o sorteio não estiver `ATIVO` ou a nota não estiver `PENDENTE`; busca em `sorteio_notas_base` por `sorteio_id + numero + valor_centavos`; aplica a regra da marca d'água; `update ... .eq("id", notaId).eq("status","PENDENTE").select("id")` garante que só a primeira execução altera (sem duplicidade em execuções simultâneas); grava `nota_base_id`/`validado_em` ou `invalidado_em`; auditoria em `sorteio_auditoria` com `EVENTOS_AUDITORIA.notaValidada` / `notaInvalidada` (`origem` `rotina` ou `painel`).
  - `validarNotasPendentes(limite = 100)` — lê o lote de notas `PENDENTE` de sorteios `ATIVO` (ordem `cadastrado_em`), delega item a item e retorna `{ analisadas, validas, invalidas, pendentes }`.
- Novo `src/routes/api/public/sorteios/validar-notas.ts`: apenas handler `POST`; compara `?token=` com `whatsapp_config.webhook_token`; 401 sem corpo detalhado; nunca loga o token nem devolve configuração; retorna somente o resumo.
- `src/lib/sorteios.functions.ts`: nova `validarNotaSorteio` (`createServerFn` + `requireSupabaseAuth` + `exigirGestao`, valida `notaId`, obtém o sorteio pelo próprio registro da nota) delegando ao mesmo núcleo com mensagem amigável quando o sorteio não está ativo.

**Front-end**
- `src/routes/sorteios.$id.notas.tsx`: coluna de ação com botão "Validar" para status `PENDENTE`, via `useServerFn` + `useMutation`, invalidando `["sorteio-notas", id]` e `["sorteio-indicadores", id]`; erros por `toast.error`.
- `src/modules/sorteios/types/index.ts`: `SorteioNotaBase` ganha `sorteio_id`; `Sorteio` ganha `base_sincronizada_em`.

**Fora do escopo:** cupons, saldo, regra R$ 20 = 1 cupom, cancelamento de cupons, sorteio/ganhadores, fechamento, sincronização da API Desktop, portal público, WhatsApp, Bot, Conexões e outros módulos. Sem testes, commit, push, deploy ou publicação.
