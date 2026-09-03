# Enviar arquivos do WhatsApp direto para a calculadora

## Objetivo
No WhatsApp, usando o seletor de arquivos já existente na conversa, permitir enviar os arquivos marcados para a Calculadora. A calculadora abre limpa (como se fosse um novo pedido) já com esses arquivos anexados, sem baixar nada para o computador.

## O que muda na tela
- Na barra de seleção da conversa (onde hoje aparece "Baixar"), entra um botão "Enviar para a calculadora".
- Ao clicar: sai do modo seleção e navega para a Calculadora.
- Na Calculadora, qualquer dado do cálculo em andamento é limpo (mesmo efeito do botão "Novo Pedido": formulário e lista zerados, rascunho descartado) e os arquivos selecionados entram na lista de anexos.
- A contagem de páginas segue a regra atual: PDF/imagem contam automaticamente; Word pede a quantidade manual.
- O botão "Baixar" continua igual. Nenhuma outra parte do layout muda.

## Detalhes técnicos
1. `src/routes/whatsapp.tsx` (apenas o bloco de seleção):
   - Novo botão que grava em `sessionStorage` uma chave (ex.: `calc-arquivos-whatsapp`) com a lista de `{ id, nome }` das mensagens selecionadas e navega para `/` com o router já existente.
   - Sem download, sem alteração no banco, no bot ou no webhook.
2. `src/routes/index.tsx` (calculadora):
   - Ao montar, se a chave existir no `sessionStorage`, ela é lida e removida.
   - Antes de anexar, o estado atual é limpo com a mesma rotina do "Novo Pedido" (estado inicial + limpeza do rascunho salvo).
   - Para cada id, `fetch` na rota já existente `/api/public/whatsapp/midia?id=...` (mesma origem, sem `download=1`), converte a resposta em `File` e reaproveita exatamente o fluxo atual de `anexar()`: `contarPaginas()` de `src/lib/contagem.ts`, upload dos PDFs no bucket `orcamento-arquivos` e `aplicarArquivos(novos)`.
3. Sem alteração de banco, da rota de mídia, do bot ou do layout geral.
