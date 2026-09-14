# Etapa 4 — Validação das notas do sorteio

Nota cadastrada nasce **Pendente**. Uma rotina automática confere cada nota pendente contra a base de notas do sorteio e a marca como **Válida** ou **Inválida**. Nenhum cupom e nenhum saldo é gerado nesta etapa.

## Como a conferência funciona

- A base de notas passa a registrar a qual sorteio cada nota pertence. A conferência exige **mesmo sorteio + número + valor**. A data da nota nunca é usada.
- Encontrou → **Válida** (guarda a nota da base correspondente e a data/hora da validação).
- Não encontrou → só marca **Inválida** se a base daquele sorteio tiver sido atualizada **depois** do cadastro da nota. Se a base ainda não recebeu atualização posterior, a nota permanece **Pendente** e é reavaliada na próxima rodada.
- Nota **Válida** nunca é reprocessada. Nota **Cancelada** nunca volta para a fila. Nada é apagado.
- Participante marcado como "Não concorre" continua tendo suas notas validadas normalmente.

## Rotina automática (a cada 1 minuto)

Segue o mesmo modelo já usado pelas rotinas de WhatsApp: um agendamento no banco chama, a cada minuto, um endereço interno protegido por token, que processa um lote de notas pendentes. Assim o sistema não fica consultando o banco continuamente pela tela.

Observação de custo: uma verificação por minuto significa 1.440 execuções por dia e mantém o banco ativo mesmo quando não há nota pendente, o que aumenta um pouco o consumo. A alternativa mais econômica seria a cada 5 minutos (atraso máximo de 5 minutos na validação). Seguirei com 1 minuto conforme solicitado.

## Correção de nota inválida

O fluxo do portal que corrige número e valor e devolve a nota para **Pendente** já existe e será preservado sem alterações. Ao voltar para Pendente, a rotina a reavalia normalmente. Nenhum cupom, saldo ou nova participação é criado.

## Tela administrativa de notas

- Mantém os filtros e o layout atuais, com os rótulos Pendente / Válida / Inválida / Cancelada.
- Ganha a ação **Validar** apenas nas notas Pendentes (para quem tem permissão de gerenciar sorteios), útil para conferir na hora sem esperar a rotina. Notas Válidas e Canceladas não exibem a ação.

## Auditoria

Cada mudança real registra: sorteio, participante, nota, usuário (ou "rotina"), data/hora, origem, status anterior e novo (Pendente → Válida ou Pendente → Inválida) e a nota da base usada na conferência. Sem registros duplicados: só grava quando a nota realmente muda de estado.

## Detalhes técnicos

**Migração**
- `public.sorteio_notas_base`: nova coluna `sorteio_id uuid NOT NULL REFERENCES public.sorteios(id)` (tabela está vazia hoje), índice único `(sorteio_id, numero)` e índice de busca `(sorteio_id, numero, valor_centavos)`.
- Nova função `public.disparar_rotina_sorteios()` (security definer, espelhando `disparar_rotina_bot`: lê `webhook_token`/`app_url` de `whatsapp_config` e faz `net.http_post`) + job `cron.schedule('validar-notas-sorteio', '* * * * *', ...)`.
- Sem mudanças de RLS; `sorteio_notas_base` continua sem exposição pública.

**Servidor**
- Novo `src/lib/sorteios-validacao.server.ts` com `validarNotasPendentes(limite)` e `validarNotaPorId(notaId, origem, usuarioId)`: relê a nota do banco (`sorteio_id`, `participante_id`, `numero`, `valor_centavos`, `status`, `cadastrado_em`), busca em `sorteio_notas_base` por `sorteio_id + numero + valor_centavos`, e faz `update ... .eq("id", notaId).eq("status","PENDENTE")` com `select("id")` — atualização só ocorre se ainda estiver Pendente (evita corrida/duplicidade). Grava `nota_base_id` + `validado_em` ou `invalidado_em`. Auditoria via `sorteio_auditoria` com eventos `EVENTOS_AUDITORIA.notaValidada` / `notaInvalidada`.
- Novo `src/routes/api/public/sorteios/validar-notas.ts`: `POST`, valida `?token=` contra `whatsapp_config.webhook_token` (401 caso contrário), chama `validarNotasPendentes` e retorna o resumo.
- `src/lib/sorteios.functions.ts`: nova `validarNotaSorteio` (`createServerFn` + `requireSupabaseAuth` + `exigirGestao`, valida `notaId`, obtém o sorteio pelo próprio registro da nota, bloqueia sorteio somente-consulta) delegando ao mesmo núcleo com origem `painel` e `usuario_id`.

**Front-end**
- `src/routes/sorteios.$id.notas.tsx`: coluna de ação com botão "Validar" para status `PENDENTE`, via `useServerFn` + `useMutation`, invalidando `["sorteio-notas", id]` e `["sorteio-indicadores", id]`; erros por `toast.error`.
- `src/modules/sorteios/types/index.ts`: `SorteioNotaBase` ganha `sorteio_id: string`.

**Fora do escopo:** cupons, saldo, regra R$20 = 1 cupom, sorteio/ganhadores, sincronização com a API local, portal público (exceto nada), WhatsApp, Bot, Conexões e outros módulos. Sem testes, commit, push, deploy ou publicação.
