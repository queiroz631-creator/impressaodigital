# Ajustes na calculadora, preços, currículo e destaque dos botões

## 1. Calculadora

**Aviso de páginas não lidas**
- Ao anexar arquivos sem contagem automática (.doc, alguns .docx, PDFs protegidos), exibir um alerta destacado no topo da lista de arquivos: "X arquivo(s) sem contagem automática. Informe a quantidade de páginas."
- O arquivo pendente fica realçado e o aviso some quando todas as quantidades forem informadas.

**Acabamento obrigatório (Sim/Não)**
- Nova escolha "Precisa de acabamento? Sim / Não" antes da lista de acabamentos.
- Enquanto não escolher, a lista de acabamentos, o card "Valores de impressão" e o "Resumo do cálculo" ficam ocultos.
- Se "Sim", é obrigatório marcar pelo menos um acabamento para liberar valores e resumo.
- Se "Não", segue direto sem acabamentos.

**Frente e verso obrigatório**
- Trocar o interruptor por escolha obrigatória Sim/Não, com o mesmo bloqueio de exibição enquanto não for escolhido.

**Novo Pedido**
- Ao confirmar "Novo Pedido", além de limpar o formulário, os orçamentos já adicionados ao pedido são removidos e o pedido atual é encerrado, começando um pedido vazio.

**Gerar orçamento**
- O campo Cliente passa a iniciar em branco (o botão "Cliente Padrão" continua disponível para preencher manualmente).
- "Mostrar total" vira escolha obrigatória Sim/Não, no mesmo padrão do PIX; sem escolha, não gera o documento.

**Documento (PDF e imagem)**
- Remover a linha "Cópia manual".
- "Quantidade de arquivos" só aparece quando for maior que 0.
- Substituir "Páginas adicionais" e "Cópias adicionais" por uma única linha **"Total p/ impressão"** com a quantidade usada na cobrança (arquivos + páginas adicionais + cópias adicionais), a mesma do resumo.

## 2. Configurar Preços

- A tabela passa a exibir apenas: Tipo, Descrição, Impressão/Cópia, Tipo de impressão, Ativo, Ordem, Editar e Excluir.
- Novo botão "Editar" abre um modal com Formato, Preço Uni, Qtd. fixa, Valor fixo, Preço arquivo excedente e as três faixas (páginas, arquivos excedentes, cópias adicionais).
- O modal salva apenas aquele material, mantendo a normalização das faixas com vírgula.
- "Adicionar material", ordenação e exclusão continuam como estão.

## 3. Currículo — impressão em branco

- Corrigir a impressão: o conteúdo é medido/escalado antes de o layout do iframe estabilizar, o que pode resultar em página vazia. A correção aguarda o carregamento e o layout do clone antes de calcular a escala, com fallback para escala 1 quando a medição falhar, mantendo o ajuste em uma única folha A4 e todo o estilo atual.

## 4. Botões mais destacados (todas as telas)

- Reforçar os tokens de cor no design system (`src/styles.css`): primário mais forte com texto de alto contraste, claro e escuro.
- Deixar as variantes `outline`/`secondary` com borda e fundo mais definidos, sem mudar textos, ícones ou posições.

## Detalhes técnicos

- `src/routes/index.tsx`: novos estados `decisaoAcabamento` e `decisaoFrenteVerso` (obrigatórios, no mesmo padrão de `decisaoPix`), gate de renderização de valores/resumo, banner de páginas manuais, `limparFormulario` excluindo os orçamentos do pedido, `incluirTotal` como decisão obrigatória, cliente iniciando vazio.
- `src/lib/pdf.ts` e `src/lib/imagem.ts`: remover linha de cópia manual, condicionar quantidade de arquivos e trocar as duas linhas por "Total p/ impressão".
- `src/routes/precos.tsx`: reduzir colunas e mover valores/faixas para um Dialog reaproveitando `faixasParaTexto` / `textoParaFaixas`.
- `src/lib/curriculo-pdf.ts`: ajustar `imprimirCurriculo` (espera de layout/fontes + fallback de escala).
- `src/styles.css` e `src/components/ui/button.tsx`: tokens e variantes, sem cores fixas em componentes.
