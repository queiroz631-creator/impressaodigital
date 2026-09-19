# Gerar cupom quando o cancelamento libera saldo suficiente

Hoje, quando uma nota é cancelada, o sistema cancela os cupons que perderam
lastro e devolve ao saldo o que pertencia às outras notas. Se esse saldo
devolvido já der para formar um cupom novo, ele fica esperando a próxima nota.
Esta etapa fecha esse ciclo: ao final do cancelamento, se o saldo já alcançar o
valor do cupom, os cupons são emitidos na mesma hora.

## Como vai funcionar

Na ordem exata, dentro de uma única operação:

1. a nota é cancelada;
2. as fontes daquela nota saem do pool (viram CANCELADO);
3. os cupons que ficaram sem lastro são cancelados e o que pertencia às outras
   notas volta ao saldo;
4. o saldo do participante é recalculado só com as notas ainda válidas;
5. só então o sistema confere o saldo: cada múltiplo do valor do cupom gera um
   cupom novo, consumindo as fontes na mesma ordem de entrada (FIFO) e gravando
   de qual nota veio cada centavo;
6. o que sobrar continua como saldo.

Se o saldo ficar abaixo do valor do cupom, nada é criado. Se o sorteio tiver
limite de cupons, o limite manda: o que não couber permanece como saldo.
Cupons já UTILIZADOS continuam nunca sendo cancelados automaticamente.

Tudo acontece junto com o cancelamento: se a emissão do cupom novo falhar, o
cancelamento inteiro é desfeito — o participante nunca fica num estado
intermediário.

Cada passo fica registrado no histórico: o cancelamento, o recálculo do saldo e
a emissão dos cupons decorrentes.

## Detalhes técnicos

Uma única migração aditiva, sem mudar tabelas.

**Nova função interna `public.sorteio_emitir_cupons_do_pool(_participante_id, _origem, _usuario_id, _nota_referencia uuid DEFAULT NULL)`**
(`SECURITY DEFINER`, `search_path = public`, `EXECUTE` só para `service_role`):
extraída do laço que hoje vive em `sorteio_gerar_cupons_da_nota` — números
únicos com retry, limite `quantidade_maxima_cupons` contando cupons
`status <> 'CANCELADO'`, consumo das fontes `PENDENTE` por `sequencia ASC` com
`FOR UPDATE`, `INSERT` em `sorteio_cupom_contribuicoes`, baixa de
`valor_pendente_centavos`/`ESGOTADO`, gravação de
`sorteio_participantes.saldo_centavos` com a soma das fontes pendentes e
auditoria `cupons.gerados`. Pressupõe a participação já travada pelo chamador.
`sorteio_cupons.nota_id` é `NOT NULL`: o cupom recebe a nota da última
contribuição que o completou (a nota que fechou o cupom), que é rastreável pelas
contribuições de qualquer forma.

**`sorteio_gerar_cupons_da_nota`** reescrita para manter exatamente o
comportamento atual (idempotência por `cupons_processado_em`, nota `VALIDA`,
sorteio `ATIVO`, criação da fonte, conferência pool × saldo esperado,
`UPDATE sorteio_notas`) e delegar a emissão à nova função — uma única regra de
geração, sem lógica duplicada.

**`sorteio_recalcular_saldo_participante`** ganha, depois de gravar o saldo e a
auditoria `saldo.recalculado`, uma chamada a `sorteio_emitir_cupons_do_pool` com
a mesma `_origem`. O retorno passa a incluir `cupons_gerados_apos_recalculo` e
`saldo_centavos` já refletindo a emissão. A participação já está travada com
`FOR UPDATE` no início da função, então dois cancelamentos simultâneos do mesmo
participante são serializados. O trigger
`sorteio_propagar_cancelamento_nota` continua chamando essa função — logo
cancelamento + emissão ficam na mesma transação e qualquer exceção desfaz tudo.

**Servidor**: `recalcularSaldoParticipante` em
`src/lib/sorteios-cupons.server.ts` passa a devolver
`cuponsGeradosAposRecalculo`; nada mais muda. Nenhuma alteração em validação,
elegibilidade, participação, notas, sincronização, fila, cursores ou API local.

## Testes (banco de desenvolvimento, em ensaio revertido no final)

1. Cancelamento libera R$ 21,85 → 1 cupom novo, saldo R$ 1,85.
2. Libera R$ 40,00 → 2 cupons, saldo R$ 0,00.
3. Libera R$ 19,99 → nenhum cupom.
4. Sorteio no limite de cupons → não ultrapassa; excedente fica como saldo.
5. O cupom novo tem contribuições somando o valor do cupom, todas de notas
   válidas.
6. Recálculo repetido não duplica o cupom novo.
7. Dois cancelamentos simultâneos do mesmo participante → saldo e quantidade de
   cupons corretos, sem duplicidade.
8. Cupom UTILIZADO nunca é cancelado automaticamente; déficit registrado.
9. Falha forçada na emissão desfaz também o cancelamento e o recálculo.
10. Histórico com os três eventos: cancelamento do cupom, recálculo do saldo e
    geração dos cupons novos.
11. Invariantes gerais: soma das fontes pendentes = saldo de cada participante;
    soma das contribuições = valor de cada cupom ativo.

## Fora do escopo

Produção, Lojamix e API local, sincronização, fila, cursores, cron, regra de
elegibilidade, validação de notas, valor por cupom, telas. Sem commit, deploy ou
publicação.
