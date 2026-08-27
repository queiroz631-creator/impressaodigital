# Calculadora: limpeza ao sair, campos maiores e cálculo de TAGs

## 1. Limpar a tela ao sair da calculadora
Ao desmontar a rota `/` (sair da calculadora), o formulário e a lista de orçamentos do pedido em aberto deixam de aparecer: o rascunho salvo é zerado (mesmo efeito do botão "Novo Pedido", sem confirmação) e os caches do pedido são removidos. Nada é apagado do banco — os orçamentos e o pedido continuam existindo em "Pedidos". Ao voltar, a tela abre limpa.

## 2. Campos maiores no card "Arquivos anexados"
Aumento **somente da largura** dos inputs de **Páginas** e **Cópias** de cada arquivo. Altura e fonte mantidas. Sem mudança de layout do card.

## 3. Área de impressão configurável (Configurar Preços)
Nova aba **Área de impressão** em `/precos`, com largura e altura (mm) para cada formato: A3, A4 (padrão 204x292) e A5. Salvo na tabela `configuracoes` em uma nova coluna `areas_impressao` (jsonb), com valores padrão caso não configurado.

## 4. Funcionalidade "Adicionar TAG" (Dados do Trabalho)
Botão **Adicionar TAG** na parte superior do card DADOS DO TRABALHO. Ao ativar, aparece uma linha horizontal com:

- **Largura (mm)** e **Comprimento (mm)** da tag;
- Cálculo automático de quantas tags cabem na área de impressão do formato selecionado, considerando **1 mm de espaçamento** entre as peças (o espaçamento entra na conta de cada peça: `floor((area + 1) / (medida + 1))`), testando também a peça girada 90° e usando o melhor aproveitamento;
- Exibição de "X tags por folha";
- Botão alternador **Informar: Quantidade de TAGs / Quantidade de folhas** e o respectivo campo numérico;
- Botão **Adicionar arquivo**.

### Regra de conversão
- Informando **TAGs**: folhas = arredonda para cima (qtd tags ÷ tags por folha).
- Informando **folhas**: usa o valor direto; qtd de tags = folhas × tags por folha.
- O arquivo criado representa **1 folha como arquivo** e as folhas extras como **cópias** (`copias = folhas`, seguindo a regra atual em que cópias adicionais = folhas − 1).

### Arquivo gerado
Nome no padrão acumulado por tag adicionada:
`TAG1 - TAMANHO: LxC MM - QTD: N` e, ao adicionar outra, `TAG2 - TAMANHO: LxC MM - QTD: N`.
Cada tag adicionada vira **um arquivo** na lista de anexos.

### Observação do orçamento
Ao gerar o orçamento, os nomes das TAGs adicionadas (no padrão acima) aparecem automaticamente na **observação** do orçamento (concatenadas, uma por linha, junto com a observação digitada pelo usuário, se houver).

### Bloqueio de edição
Arquivos criados pela funcionalidade TAG ficam **bloqueados**: campos de páginas, cópias e frente/verso desabilitados (somente leitura), mantendo o botão Remover.

## Detalhes técnicos
- `src/lib/documento.ts`: campo opcional `origemTag?: boolean` (e medidas) em `ArquivoDoc` para marcar o bloqueio.
- `src/lib/calc.ts`: função pura `tagsPorFolha(larguraTag, compTag, areaLargura, areaAltura, espacamento = 1)` com teste de rotação.
- `src/routes/index.tsx`: estado da TAG (ativo, largura, comprimento, modo, quantidade), UI na faixa superior de DADOS DO TRABALHO, geração do arquivo e desabilitação dos controles quando `origemTag`.
- `src/routes/precos.tsx`: nova aba com os campos por formato; `src/hooks/useDados.ts` expõe `areas_impressao`.
- Migração: `ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS areas_impressao jsonb DEFAULT ...`.
- Nenhuma alteração no layout geral, nos cálculos de preço existentes ou em outras telas.
