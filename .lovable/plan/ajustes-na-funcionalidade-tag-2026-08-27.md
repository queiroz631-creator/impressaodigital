# Ajustes na funcionalidade TAG

## 1. Campo "Total de TAGs"
Na faixa da TAG (card DADOS DO TRABALHO), incluir um campo de leitura mostrando o **Total de TAGs** resultante do que foi informado:

- Informando quantidade de TAGs: total = a quantidade digitada (arredondada para o número de folhas cheias já usado no cálculo? não — mantém o valor digitado).
- Informando quantidade de folhas: total = folhas x tags por folha.

O campo fica ao lado de "Tags por folha", no mesmo estilo (somente leitura), e atualiza em tempo real.

## 2. Limpar os campos da TAG
Os campos da TAG (ativo/inativo, largura, comprimento, modo e quantidade) passam a ser zerados:

- ao clicar em **Novo Pedido**;
- ao **sair da calculadora** (desmontar a página), junto com a limpeza do rascunho que já existe hoje.

## 3. Medidas em centímetros
As medidas continuam sendo digitadas em milímetros, mas passam a ser **exibidas e salvas em centímetros**:

- Nome do arquivo anexado: `TAG1 - TAMANHO: 5x9 CM - QTD: 200` (mm divididos por 10, com até uma casa decimal e vírgula no padrão brasileiro, ex.: `4,5x9 CM`).
- Como a observação do orçamento é montada a partir dos nomes desses arquivos, ela passa a sair em cm automaticamente.

Arquivos TAG já criados anteriormente mantêm o nome como está.

## Detalhes técnicos
- `src/routes/index.tsx`: novo cálculo derivado `tagTotal`; campo somente leitura na faixa da TAG; reset dos estados `tagAtivo/tagLargura/tagComprimento/tagModo/tagQuantidade` em `limparFormulario` e no cleanup de desmontagem; formatação mm→cm na geração do nome em `adicionarTagArquivo`.
- Nenhuma mudança no cálculo de preços, no layout geral ou em outras telas.
