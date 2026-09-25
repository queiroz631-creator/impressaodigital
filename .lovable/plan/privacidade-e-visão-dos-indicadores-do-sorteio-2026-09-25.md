# Privacidade e visão dos indicadores do sorteio

## Objetivo

Nas abas **Painel** e **Encerramento**:

- o cartão **Valor em notas válidas** abrirá com o valor monetário oculto e terá um botão de olho para revelar ou ocultar;
- haverá um controle **Concorrem / Todos os participantes**, iniciado em **Concorrem**, para alternar o público considerado nos indicadores.

## Comportamento dos controles

### Painel

- Manter o filtro de período **Hoje / Todos** já existente.
- Adicionar separadamente o filtro de participantes **Concorrem / Todos os participantes**.
- Os dois filtros funcionarão em conjunto: por exemplo, **Hoje + Concorrem** mostrará somente movimentações de hoje dos participantes elegíveis.

### Encerramento

- Adicionar o filtro **Concorrem / Todos os participantes**, também iniciado em **Concorrem**.
- A escolha altera somente os números apresentados; a conferência oficial, suas pendências, inconsistências e a decisão de permitir o encerramento continuam considerando a base completa.

### Indicadores filtrados

A escolha será aplicada a todos os indicadores vinculados a participantes: participantes, notas por situação, valor das notas válidas, cupons por situação, saldo acumulado, fontes pendentes e contribuições.

**Prêmios e ganhadores** permanecem gerais, pois não representam uma soma filtrável de participantes; ganhadores já vêm da apuração entre participantes elegíveis.

## Alterações

1. Criar um seletor reutilizável e identificado para **Concorrem / Todos os participantes**, evitando confusão com o filtro de período.
2. Atualizar os indicadores do **Painel** para relacionar notas e cupons aos participantes e aplicar simultaneamente os filtros de período e elegibilidade.
3. Criar uma consulta de leitura no banco para devolver os totais do **Encerramento** no recorte escolhido, incluindo notas, cupons, valores, saldo, fontes e contribuições.
   - A consulta exigirá a mesma permissão do módulo.
   - A migração será registrada em `supabase/migrations/`, referência oficial do projeto.
4. Preservar a conferência oficial existente para aprovar ou impedir o encerramento; o novo recorte será apenas visual.
5. Ampliar o cartão de indicador para aceitar uma ação opcional e aplicar o botão de olho somente ao cartão **Valor em notas válidas** nas duas abas.
   - valor oculto por padrão;
   - olho revela;
   - olho riscado oculta novamente;
   - cada aba mantém seu próprio estado e volta a ocultar ao ser reaberta.

## O que não muda

- Regras de geração, cancelamento e utilização de cupons.
- Elegibilidade dos participantes e regras da apuração.
- Pendências, inconsistências e autorização para encerrar o sorteio.
- Dados já gravados e retratos de encerramentos anteriores.
- Nenhuma publicação.

## Verificação

- Conferir **Concorrem** como padrão nas duas abas e alternância correta para **Todos os participantes**.
- No Painel, validar as quatro combinações entre período e participantes.
- Comparar os totais das duas visões com os registros de participantes elegíveis e não elegíveis.
- Confirmar que a aprovação do encerramento não muda ao alternar o filtro visual.
- Confirmar que o valor monetário começa oculto e pode ser revelado/ocultado sem deslocar o cartão.
- Validar tela ampla e celular, tipos e estado atual da aplicação.
