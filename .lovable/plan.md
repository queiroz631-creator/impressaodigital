# Visualizar imagens e baixar arquivos na conversa do WhatsApp

## Objetivo
Na tela WhatsApp, quando o cliente enviar uma imagem, ela aparece direto no balão da conversa. Documentos (PDF, Word, etc.) aparecem como um cartão de arquivo com botão de download. Hoje só aparece o texto "📎 nome-do-arquivo".

## O que muda na tela
- Balão com imagem: miniatura clicável (abre em tamanho grande num modal) + botão de baixar.
- Balão com documento: ícone, nome do arquivo e botão de baixar.
- Balão com áudio: player simples para ouvir.
- Nada mais no layout muda: abas, ações, envio por Enter e comportamento atual permanecem iguais.

## Detalhes técnicos
1. Nova rota de mídia `src/routes/api/public/whatsapp/midia.ts`:
   - Recebe o id da mensagem, busca `arquivo_url`/`mime_type` em `whatsapp_mensagens` pelo cliente admin e repassa o conteúdo do arquivo.
   - Suporta `?download=1` para forçar `Content-Disposition: attachment` com o `arquivo_nome`.
   - Necessária porque as URLs da Z-API não são confiáveis para exibição direta no navegador (CORS/expiração) e para não expor a URL bruta.
2. `src/routes/whatsapp.tsx` (apenas o bloco de renderização de mensagem):
   - Adicionar `mime_type` à interface `Mensagem`.
   - Renderizar por `m.tipo`: `imagem` → `<img>` com lazy loading apontando para a rota de mídia; `documento` → cartão com nome + botão download; `audio` → `<audio controls>`; demais tipos mantêm o texto atual.
   - Modal (Dialog já existente no projeto) para ampliar a imagem, com link de download.
3. Sem alteração de banco, bot, webhook ou lógica de status.
