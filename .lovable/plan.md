# Calculadora: colunas invertidas, Cópia Manual por categoria de material

## O que muda

1. **Layout da tela Calculadora (Dados do trabalho)**
   - Coluna **esquerda**: anexar arquivos (botão, texto de ajuda e lista "Arquivos anexados").
   - Coluna **direita**: quantidades e configurações (quantidade de arquivos, páginas adicionais, cópias adicionais, tipo de impressão, formato e o botão Cópia Manual).
   - Nada muda no conteúdo dos cards, apenas o lado em que aparecem.

2. **Novo campo em Configurar Preço (materiais): Impressão ou Cópia**
   - Cada material passa a ter uma categoria: **Impressão** ou **Cópia**.
   - Todos os materiais já cadastrados ficam como **Impressão**.
   - Novos materiais entram como **Impressão** por padrão.

3. **Botão Cópia Manual muda de função**
   - Ativado: a tabela "Valores de impressão" mostra somente materiais com a categoria **Cópia**.
   - Desativado: mostra somente materiais com a categoria **Impressão**.
   - As regras de cálculo atuais da cópia manual (cobrança por página, cada arquivo conta 1 página, sem valor por arquivo) continuam iguais.

4. **Remoção do "Usar faixa de quantidade"**
   - O botão e a opção somem da tela e deixam de existir no estado, nos rascunhos e no cálculo.
   - Na cópia manual continua valendo o preço unitário cadastrado, sem faixas (comportamento atual com a opção desligada).

Todo o resto (acabamentos, pedidos, orçamentos, impressão, WhatsApp, currículos) permanece intacto.

## Detalhes técnicos

- Migração: `ALTER TABLE public.materiais ADD COLUMN categoria text NOT NULL DEFAULT 'impressao'` com `CHECK (categoria IN ('impressao','copia'))`; linhas existentes recebem `'impressao'` pelo default.
- `src/lib/calc.ts`: adicionar `categoria: "impressao" | "copia"` em `Material`; em `EntradaCalculo` remover `usarFaixaCopiaManual` e filtrar por `(m.categoria ?? "impressao") === (entrada.copiaManual ? "copia" : "impressao")`; `precoPorQuantidade` deixa de receber o parâmetro de faixa e sempre usa `preco_pb` na cópia manual.
- `src/routes/precos.tsx`: coluna/seletor "Tipo" (Impressão/Cópia) por material, incluído no mapeamento de leitura e no salvamento; novo material criado com `categoria: "impressao"`.
- `src/routes/index.tsx`: trocar a ordem das duas colunas dentro do grid de "Dados do trabalho"; remover `usarFaixaCopiaManual` do estado inicial, do `useMemo` de cálculo, do bloco do Switch e da restauração de rascunho.
