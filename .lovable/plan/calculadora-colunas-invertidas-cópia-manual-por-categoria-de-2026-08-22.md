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

3. **Botão Cópia Manual vira apenas filtro**
   - Ativado: a tabela "Valores de impressão" mostra somente materiais da categoria **Cópia**.
   - Desativado: mostra somente materiais da categoria **Impressão**.
   - A antiga lógica de cálculo da cópia manual é removida: nada mais de "cada arquivo conta 1 página", nem preço unitário sem faixas, nem ignorar o valor por arquivo. O cálculo passa a ser sempre o padrão (arquivos + páginas adicionais + cópias adicionais, com as faixas cadastradas), independentemente do botão.

4. **Remoção do "Usar faixa de quantidade"**
   - O botão e a opção somem da tela e deixam de existir no estado, nos rascunhos e no cálculo.


Todo o resto (acabamentos, pedidos, orçamentos, impressão, WhatsApp, currículos) permanece intacto.

## Detalhes técnicos

- Migração: `ALTER TABLE public.materiais ADD COLUMN categoria text NOT NULL DEFAULT 'impressao'` com `CHECK (categoria IN ('impressao','copia'))`; linhas existentes recebem `'impressao'` pelo default.
- `src/lib/calc.ts`: adicionar `categoria: "impressao" | "copia"` em `Material`; em `EntradaCalculo` remover `usarFaixaCopiaManual` e usar `copiaManual` apenas como filtro `(m.categoria ?? "impressao") === (entrada.copiaManual ? "copia" : "impressao")`; remover os ramos de cálculo condicionados a `copiaManual` em `precoPorQuantidade`, no total de arquivos e no preço das cópias adicionais.
- `src/routes/precos.tsx`: coluna/seletor "Tipo" (Impressão/Cópia) por material, incluído no mapeamento de leitura e no salvamento; novo material criado com `categoria: "impressao"`.
- `src/routes/index.tsx`: trocar a ordem das duas colunas dentro do grid de "Dados do trabalho"; remover `usarFaixaCopiaManual` do estado inicial, do `useMemo` de cálculo, do bloco do Switch e da restauração de rascunho.
