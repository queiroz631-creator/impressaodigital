# Arquivos Word: contagem manual obrigatória

Hoje o sistema tenta ler as páginas de arquivos `.docx` pelos metadados internos do Word. Esses metadados costumam estar ausentes ou desatualizados (Google Docs, LibreOffice, arquivos `.doc` antigos), então o arquivo entra com contagem errada e sem aviso claro — o aviso atual é apenas um toast que some rápido.

## O que muda

1. **Todo arquivo Word (.doc e .docx) entra como pendente de contagem manual**
   - Não usamos mais a leitura automática de páginas do Word.
   - O arquivo é anexado com o campo de páginas em branco/zerado e marcado como pendente.

2. **Aviso fixo e visível**
   - Faixa de alerta fixa no topo da lista de arquivos: "X arquivo(s) Word aguardando a quantidade de páginas".
   - No card de cada arquivo pendente: borda e campo de páginas destacados, com o texto "Informe a quantidade de páginas deste arquivo".
   - O aviso só desaparece quando o usuário digita a quantidade daquele arquivo.

3. **Cálculo bloqueado enquanto houver pendência**
   - "Valores de impressão" e o resumo do cálculo ficam ocultos, com a mensagem indicando o que falta, do mesmo jeito que já ocorre com acabamento e frente/verso.
   - O botão de adicionar ao pedido também fica bloqueado nessa situação.

4. **PDF e imagens continuam iguais** — contagem automática normal.

## Detalhes técnicos

- `src/lib/contagem.ts`: remover `paginasDocx` e o uso de `fflate`; todo `.doc`/`.docx` retorna `paginas: 0` e `paginasManuais: true`, entrando também em `manuais`.
- `src/routes/index.tsx`:
  - Novo derivado `arquivosPendentes = estado.arquivosLista.filter(a => a.paginasManuais || a.paginas < 1)`.
  - Incluir `arquivosPendentes.length === 0` na condição `mostrarTabela` e na validação de adicionar item, com mensagem própria.
  - Faixa de alerta acima da lista de arquivos e destaque no card/input do arquivo pendente.
  - Ao digitar páginas ≥ 1, limpar `paginasManuais` (comportamento já existente).
  - `aplicarArquivos` continua recalculando páginas/cópias adicionais; arquivos com 0 páginas não somam nada até serem preenchidos.

## Aviso de leitura automática no gerar orçamento

- Sempre que o usuário anexar arquivos pelo botão de leitura (PDF/imagem lidos automaticamente), marcar o cálculo como "leitura automática".
- No diálogo de gerar orçamento, exibir em destaque (faixa amarela/atenção, texto forte) o aviso:
  "Quantidade de páginas foi lida automaticamente, favor verificar se há divergência!"
- O aviso é apenas informativo: não bloqueia a geração.
- Técnico: flag derivada da lista de arquivos (existe arquivo lido automaticamente, ou seja, sem `paginasManuais`), renderizada no topo do diálogo de orçamento em `src/routes/index.tsx`.

## Botões com cor mais forte

- Reforçar os tokens de cor em `src/styles.css` (tema claro e escuro): `--primary` mais saturado/escuro, `--ring` combinando, mantendo o contraste do texto branco.
- Em `src/components/ui/button.tsx`: manter o peso de fonte semibold e aumentar levemente sombra/contraste dos estados hover e das variantes `outline`/`secondary`, para que os botões se destaquem em todas as telas.
- Apenas tokens e variantes de botão são alterados — nenhuma tela precisa ser reescrita.
