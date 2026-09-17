# Corrigir a data de nascimento na criação de clientes no Lojamix

## Causa (verificada)

O erro que aparece no programa da loja é:

```text
A conversão de um tipo de dados nvarchar em um tipo de dados datetime
resultou em um valor fora do intervalo. (242)
```

A data de nascimento está sendo enviada como **texto** no formato
`1988-01-22`. A coluna de data de nascimento do Lojamix é do tipo antigo
`datetime`, e nesse tipo o SQL Server interpreta datas em texto conforme o
idioma configurado (português = dia/mês/ano). Com isso, `1988-01-22` é lido
como "mês 22" e o banco recusa o registro.

Confirmado nos dados do sistema: os clientes pendentes têm datas reais como
1988-01-22, 1998-02-25, 1983-11-07 — todas com dia acima de 12, exatamente os
casos que estouram. É por isso que a criação falha em todos e o contador mostra
"recebidos 4, criados 0, erros 1".

## Correção

Enviar a data de nascimento como **valor de data de verdade**, e não como
texto, na gravação da pessoa física. Assim o formato deixa de depender do
idioma do SQL Server e o cadastro é aceito.

- Data existente no sistema: convertida para data antes de gravar.
- Data ausente: continua usando o padrão do Lojamix (01/01/1900).
- Data em formato inesperado: tratada como ausente, sem quebrar o ciclo.

## O que não muda

Elegibilidade, participação no sorteio, vínculo por CPF, `origem_id`, fila,
cursores, sincronização Loja → Sistema, notas, validação, cancelamento, cupons,
saldo, rotas, banco e migrações continuam iguais. A criação segue em uma única
transação (entidade com retorno do identificador → pessoa física → conferência
de exatamente um registro → confirmação), com desfazimento total em qualquer
erro. Modo simulação preservado.

## Detalhes técnicos

- Apenas `api-local/app/repositories/clientes_repo.py`, função `criar()`:
  `nascimento` passa a ser normalizado para `datetime.date`
  (`date.fromisoformat` para texto ISO, `date`/`datetime` mantidos, senão
  `date(1900, 1, 1)`) antes de montar os parâmetros do comando de pessoa
  física. O pyodbc envia o valor como data tipada, eliminando a ambiguidade
  de formato.
- O comando SQL de pessoa física não muda — nada a "restaurar padrão" na tela.

## Teste na loja

Com a simulação desligada, clicar em "Sincronizar Agora" e conferir que
"Clientes pendentes (sistema → loja)" passa a mostrar criados/vinculados e o
último erro fica vazio.
