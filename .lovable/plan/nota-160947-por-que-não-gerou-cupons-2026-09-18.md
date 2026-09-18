# Nota 160947 — por que não gerou cupons

## O que está acontecendo

A nota 160947 (R$ 63,00) foi registrada pelo cliente no portal às 13:45 e está
**aguardando conferência** (situação Pendente). Cupons só são gerados depois que
a nota é conferida contra a base de notas da loja.

Confirmado no banco:

- A nota existe na base da loja com o mesmo número e o mesmo valor (R$ 63,00),
  ou seja, ela **vai ser aprovada**.
- A base da loja foi sincronizada às 13:35, antes do registro da nota.
- O único registro de histórico da nota é "nota cadastrada" — nenhuma conferência
  aconteceu ainda.

Causa: quando o cliente registra uma nota no portal, o sistema **não confere a
nota naquele momento**. A conferência só acontece na rodada automática que roda a
cada 15 minutos. Curiosamente, quando o cliente *corrige* uma nota recusada, a
conferência é feita na hora — o registro inicial ficou sem esse passo.

Ou seja: não é erro na geração de cupons. A nota seria aprovada e geraria 3
cupons (com R$ 3,00 de troco) na próxima rodada automática, até 15 minutos depois
do registro.

## Correção proposta

1. Ao registrar uma nota no portal, conferir a nota imediatamente — exatamente
   como já é feito na correção de nota recusada: se falhar, a nota simplesmente
   fica pendente e a rodada automática tenta de novo, sem perder o registro.
2. Ao cadastrar uma nota pelo painel administrativo, aplicar o mesmo passo,
   caso ainda não esteja assim.
3. Processar agora a nota 160947 (e qualquer outra pendente parada), pelo próprio
   botão já existente no painel do sorteio, para que o cliente veja os cupons
   sem esperar.

Efeito para o cliente: ao enviar a nota, ela já aparece aprovada e com os cupons,
em vez de ficar "aguardando" por alguns minutos.

## Detalhes técnicos

- `registrarNotaParticipante` em `src/lib/sorteios-publico.functions.ts`: após a
  auditoria `nota.cadastrada`, chamar `validarNotaPorId(nota.id, "portal", null)`
  dentro de `try/catch` — mesmo padrão já usado em `corrigirMinhaNota`. A
  validação já dispara `gerarCuponsDaNota`.
- Nenhuma mudança na regra de validação, no cancelamento, na sincronização, na
  fila/cursores ou na API local. Sem migração nova.
- A rodada de reconciliação de 15 minutos (`cron` → `reconciliar-interno`)
  continua como rede de segurança.
- Observação registrada: não existe agendamento para a rota
  `api/public/sorteios/validar-notas`; hoje quem valida em lote é a
  reconciliação. Mantido como está nesta etapa.

Sem commit, envio ou publicação.
