# Limpar o último sorteio para repetir o teste

## Situação atual (verificada agora no banco)

Sorteio **"Dia das Criança" (nº 1)** está em **SORTEADO**, encerrado em 21/09/2026.

Prêmios cadastrados (ambos ativos, quantidade 1):

1. 1º - Pipoqueira Elétrica — já sorteado (cupom 01-064857)
2. 2º - Triciclo Infantil com puxador — já sorteado (cupom 01-527437)

Existem exatamente **2 registros de ganhadores**, os dois deste sorteio.

## O que será feito

1. Apagar os 2 registros de ganhadores deste sorteio (somente deste sorteio).
2. Voltar a situação do sorteio de **SORTEADO** para **ENCERRADO**, mantendo a data do encerramento e o retrato da conferência.

Com isso a aba "Sortear" volta a mostrar os dois prêmios como **Disponível**, com o botão "Realizar sorteio" habilitado, e o teste pode ser repetido do zero.

## O que não muda

- Notas, participantes, cupons, saldo, fontes e contribuições permanecem exatamente como estão — nenhum cupom é gerado, cancelado ou reativado.
- Os prêmios cadastrados não são alterados.
- O histórico de auditoria anterior é preservado; nenhum registro de auditoria é apagado.

## Detalhes técnicos

- `DELETE FROM sorteio_ganhadores WHERE sorteio_id = 'b1ea820a-...'` (2 linhas).
- `UPDATE sorteios SET status = 'ENCERRADO' WHERE id = 'b1ea820a-...'`; `encerrado_em`, `encerrado_por` e `conferencia_encerramento` ficam intactos.
- Ambas as operações são alterações de dados no banco de desenvolvimento, sem migração e sem mudança de código.
- Registro na auditoria do sorteio (`sorteio.apuracao_limpa`) informando que a apuração de teste foi zerada, para não perder o rastro.
- Ao final, conferir por consulta: 0 ganhadores no sorteio e situação ENCERRADO.

Nada será publicado.
