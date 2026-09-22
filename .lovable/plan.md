# Limpar ganhadores do sorteio de teste para novos testes

## Objetivo
Zerar o resultado da apuração do sorteio "Dia das Criança" (nº 1) para permitir novos testes de sorteio, sem mexer em nada mais.

## Estado atual (confirmado no banco)
- Sorteio `b1ea820a-4058-402a-b488-eab6cd86bd6d`, status ENCERRADO.
- 3 ganhadores registrados: 1º prêmio (Pipoqueira), 2º prêmio (Triciclo) e 1 unidade do 3º prêmio.
- Demais unidades do 3º prêmio (10 no total) ainda disponíveis.

## O que será feito
1. Apagar os 3 registros de `sorteio_ganhadores` deste sorteio.
2. Status permanece ENCERRADO (já está correto para permitir sortear de novo).
3. Registrar na auditoria `sorteio.apuracao_limpa` (quem limpou, quando, quantos ganhadores removidos).

## O que NÃO será alterado
- Notas, participantes, cupons, saldo, fontes e contribuições — todos intactos.
- Prêmios cadastrados e retrato da conferência de encerramento — preservados.
- Nenhuma auditoria anterior é apagada; o histórico do que aconteceu permanece.

## Resultado esperado
A aba Sortear volta a mostrar todos os prêmios como disponíveis, sem histórico de ganhadores, pronta para um novo sorteio de teste.
