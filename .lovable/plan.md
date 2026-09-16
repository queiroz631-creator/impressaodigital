# Encontrar os clientes pendentes de registro no Lojamix

## O que está acontecendo

Hoje existem exatamente 2 clientes prontos para serem registrados no Lojamix
(participam do sorteio ativo, têm CPF válido, telefone válido e ainda não têm
ligação com a loja): "marco paulo" e "joão pereira".

Eles não aparecem porque a lista de pendentes é montada na ordem errada:

1. o sistema pega um bloco de 100 clientes sem ligação com a loja (são 472);
2. só depois descarta quem não participa do sorteio ativo.

Como os 2 elegíveis estão perdidos no meio dos 472, quase todo bloco volta
vazio e o programa da loja precisa de vários ciclos para tropeçar neles — e,
quando volta vazio, a impressão é de que "não há clientes pendentes".

## O que será ajustado

Filtrar primeiro por participação no sorteio ativo e só então paginar. Assim o
primeiro bloco já traz os clientes realmente pendentes, sem varrer centenas de
cadastros irrelevantes.

- A lista passa a considerar apenas clientes com participação em sorteio ATIVO
  **e** sem ligação com a loja, ordenados por identificador.
- Os critérios de elegibilidade continuam idênticos: pessoa física, CPF válido
  (11 dígitos com dígitos verificadores), telefone com 10 dígitos ou mais,
  nome preenchido, sem `origem_id`. Nota fiscal continua não sendo exigida.
- A varredura circular do marcador `ultimo_id_cliente_pendente` continua igual:
  avança só com bloco concluído sem erro e volta ao início ao esgotar a lista.
- O contador `descartadosSemParticipacao` deixa de inflar com clientes que
  nunca foram candidatos; passa a refletir apenas descartes reais dentro da
  lista de participantes.

## Detalhes técnicos

Arquivo alterado: `src/lib/sorteios-sync.server.ts`, função
`listarClientesSemOrigem`.

- Buscar os `cliente_id` dos participantes dos sorteios com status `ATIVO`
  (como já é feito).
- Aplicar esses ids na própria consulta de `clientes` com `.in("id", ids)`
  junto de `.is("origem_id", null)`, `.gt("id", desdeId)`, `ORDER BY id ASC`
  e `limit`. Quando a quantidade de participantes for grande, dividir a lista
  de ids em fatias e concatenar os resultados mantendo a ordem por id.
- Manter a validação de CPF/telefone/nome em JS exatamente como está.
- Retornar `marcador` como o maior id efetivamente lido no bloco, como hoje.

Nada muda no fluxo de notas (consultas, `ultimo_id_nota`, `ultimo_id_revisado`,
validação, cancelamento, cupons, saldo), nem nas rotas, nem no banco. Nenhuma
migração.

## Observação sobre o programa da loja

A tela enviada não mostra a etapa "clientes pendentes" no resultado do ciclo.
Se o executável instalado na loja for anterior a essa etapa, ele precisa ser
gerado novamente a partir da pasta do programa para que o passo rode. Isso é
verificação/instalação na máquina da loja, não código.
