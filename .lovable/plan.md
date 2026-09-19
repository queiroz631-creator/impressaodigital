# Conferência para encerramento como aba própria

## Objetivo
Hoje o bloco "Conferência para encerramento" fica embutido no painel do sorteio. Vamos movê-lo para uma aba própria no menu do sorteio, chamada **Encerramento**, visível apenas quando o sorteio está ATIVO ou ENCERRADO.

## Mudanças

### Nova aba
- Nova tela `/sorteios/$id/encerramento` que mostra o componente de conferência existente (`ConferenciaEncerramento`), sem alterar nada nele: mesmos 11 indicadores, pendências, inconsistências, botão "Encerrar sorteio" com confirmação e, após encerrado, o retrato congelado com data/hora.
- A aba segue o mesmo padrão das demais (Painel, Termos, Prêmios, Participantes, Notas, Cupons): mesma barra de abas no topo e mesma permissão de visualização.

### Ajustes no painel
- Remover o bloco de conferência da tela inicial do sorteio (Painel), que passa a mostrar somente dados do sorteio, indicadores e o card "Saldo e cupons".
- Adicionar a aba "Encerramento" ao menu `NavSorteio`, exibida somente quando o sorteio está ATIVO ou ENCERRADO (nos demais estados a aba não aparece).

## O que NÃO muda
- Nenhuma alteração no banco, nas funções de encerramento/conferência, no servidor ou nas regras de fechamento. É só reorganização de tela.
- A decisão de encerrar continua sendo refeita pelo servidor na hora do clique; a tela continua apenas exibindo a conferência.

## Verificação
- Conferir no preview: aba aparece para sorteio ATIVO/ENCERRADO, conferência carrega com os números, botão encerrar funciona com a confirmação, e o Painel não mostra mais o bloco duplicado.
- Verificação de tipos sem erros.
