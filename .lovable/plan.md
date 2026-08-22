# Aviso de páginas, edição de preços em modal e botões destacados

## 1. Calculadora: aviso claro quando não for possível ler as páginas

Hoje o sistema já marca o arquivo e mostra um aviso pequeno. Vai ficar mais visível:

- Ao anexar arquivos cuja contagem falhar (.doc, .docx sem contagem, PDFs protegidos), abrir um alerta destacado no topo da lista de arquivos: "X arquivo(s) sem contagem automática. Informe a quantidade de páginas."
- Cada arquivo nessa situação recebe borda/realce e o campo de páginas fica destacado até o usuário digitar um valor.
- O aviso some automaticamente quando todas as quantidades forem informadas.
- Nada muda no cálculo nem na contagem automática de PDFs/imagens.

## 2. Configurar Preços: tabela enxuta + modal de edição

A tabela de materiais passa a exibir somente:

`TIPO | DESCRIÇÃO | IMPRESSÃO/CÓPIA | TIPO DE IMPRESSÃO | ATIVO | ORDEM | EDITAR | EXCLUIR`

- Novo botão "Editar" (ícone de lápis) em cada linha abre um modal com todos os campos de valores: Formato, Preço Uni, Qtd. fixa, Valor fixo, Preço arquivo excedente, Faixas por páginas, Faixas por arquivos excedentes, Faixas por cópias adicionais.
- O modal tem "Cancelar" e "Salvar", salvando apenas aquele material (mesma lógica de update já existente, incluindo normalização das faixas com vírgula).
- Os campos que continuam na tabela (tipo, descrição, categoria, tipo de impressão, ativo, ordem) seguem editáveis direto na linha, com o botão "Salvar Alterações" atual.
- "Adicionar material" e exclusão permanecem como estão.

## 3. Botões com cor mais forte (todas as telas)

- Reforçar os tokens de cor no design system (`src/styles.css`): primário mais saturado/escuro, com texto de alto contraste, em tema claro e escuro.
- Ajustar as variantes do componente de botão (`outline`, `secondary`, `ghost`) para terem borda/fundo mais definidos, mantendo os tokens semânticos.
- Sem trocar textos, ícones ou posições dos botões — só a intensidade visual.

## Detalhes técnicos

- `src/lib/contagem.ts`: sem mudança de lógica; a flag `paginasManuais` já existente alimenta o novo alerta.
- `src/routes/index.tsx`: banner condicional na coluna de arquivos + realce por arquivo pendente.
- `src/routes/precos.tsx`: reduzir colunas da tabela e extrair os campos de valores/faixas para um novo componente de modal (Dialog) com estado local por material; reaproveitar `faixasParaTexto` / `textoParaFaixas`.
- `src/styles.css` e `src/components/ui/button.tsx`: ajuste de tokens/variantes, sem cores fixas em componentes.
