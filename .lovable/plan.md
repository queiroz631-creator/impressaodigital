# Link de preenchimento para o cliente

Objetivo: facilitar o envio do link em que o cliente apenas preenche o currículo, sem as ações internas (editar, imprimir, PDF, WhatsApp).

## 1. Lista de currículos (tela Currículo Vitae)

- Nova ação "Link do cliente" em cada linha da lista.
- Ao clicar: gera o link (mesma função já usada no detalhe), copia para a área de transferência e mostra um aviso com a validade.
- Pequeno diálogo com o link em texto e botão "Copiar", para quem preferir copiar manualmente.

## 2. Tela do currículo (detalhe)

- Mantém o botão existente "Gerar link", apenas com rótulo mais claro ("Link do cliente") e o mesmo diálogo/aviso de validade da lista.
- Nenhuma outra ação da tela é alterada.

## 3. Página que o cliente abre

- Permanece somente com o formulário de preenchimento em etapas, sem editar, imprimir, PDF ou WhatsApp (comportamento atual mantido).

## Notas técnicas

- Reutiliza `gerarLinkCurriculo` de `src/lib/curriculo.functions.ts`; nenhuma mudança no banco de dados e nenhuma migração.
- Arquivos tocados: `src/routes/curriculos.index.tsx` (botão + diálogo de link) e `src/routes/curriculos.$id.tsx` (rótulo e diálogo de link).
- Nenhuma alteração em cálculo, pedidos, PDF ou demais módulos.
