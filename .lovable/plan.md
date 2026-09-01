# Modal de impressão de documentos + limpeza rápida na calculadora

## 1. Novo modal "Imprimir documentos" (componente compartilhado)

Um único componente reutilizado nas telas Orçamentos e Calculadora. Ao abrir, mostra:

- Lista rolável dos documentos (nome, cópias, páginas do arquivo, total de páginas = páginas x cópias).
- Rodapé com o total geral de páginas que será impresso.
- Seletor de impressora: vem preenchida com a impressora padrão das configurações (ou a do perfil), com opção de escolher outra da lista de impressoras detectadas.
- Botões Cancelar e Imprimir.

Ao clicar em Imprimir, o modal passa para o modo de progresso:

- Barra de progresso com "Enviando X de N" e o nome do arquivo atual.
- Etapas visíveis: baixando arquivo, enviando para a impressora, concluído/erro por documento.
- Ao final, resumo (enviados / falhas) e botão Fechar. Erros não interrompem os demais itens; cada falha é listada.

## 2. Tela Orçamentos

O botão "Imprimir documentos" do pedido deixa de imprimir direto: passa a abrir o modal já carregado com todos os arquivos do pedido (mesma seleção de perfil/material que existe hoje). A impressão só acontece após a confirmação no modal, usando a impressora escolhida.

## 3. Tela Calculadora — bloco "Arquivos anexados"

Na parte de cima do bloco, ao lado do botão de anexar, dois botões:

- **Remover todos**: com confirmação, remove todos os arquivos anexados e zera de uma vez Quantidade de arquivos, Páginas adicionais e Cópias adicionais.
- **Imprimir documentos**: abre o mesmo modal do item 1, com todos os arquivos anexados do orçamento atual, respeitando a quantidade de cópias de cada arquivo.

Nada mais muda: layout, cálculo, salvamento e demais configurações permanecem como estão.

## Detalhes técnicos

- Novo componente `src/components/impressao/ImprimirDocumentosDialog.tsx` com estado interno (seleção → progresso), usando `listarImpressoras()` e `imprimirDocumentos()` de `src/lib/impressora.ts`.
- Impressão passa a ser feita documento a documento (loop) para permitir progresso, em vez de um único `print` em lote; `imprimirDocumentos` continua sendo a função usada, recebendo 1 documento por chamada e a impressora escolhida como override.
- Download dos PDFs do bucket `orcamento-arquivos` acontece dentro do modal, alimentando a barra de progresso; na calculadora os arquivos já anexados usam o mesmo caminho salvo.
- `src/routes/orcamentos.tsx`: `imprimirDocumentosPedido` passa a apenas montar a lista de documentos + perfil e abrir o modal.
- `src/routes/index.tsx`: adiciona os dois botões no cabeçalho do bloco de arquivos e a ação de limpeza (`arquivosLista`, `arquivos`, `paginasAdicionais`, `copiasAdicionais`).
