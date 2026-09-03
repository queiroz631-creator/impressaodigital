# Baixar vários arquivos de uma conversa do WhatsApp

## Objetivo
Na tela WhatsApp, permitir selecionar mais de um arquivo (imagem/documento/áudio) recebido ou enviado na conversa aberta e baixar todos de uma vez. Hoje só é possível baixar um por vez, clicando no botão de download de cada balão.

## O que muda na tela
- No cabeçalho da conversa aberta, aparece um botão "Selecionar arquivos" (ícone de download/check).
- Em modo seleção: cada balão com arquivo ganha uma caixa de seleção; imagens/documentos/áudios podem ser marcados/desmarcados. Toque/clique no balão alterna a seleção; visualização e modal ficam suspensos nesse modo.
- Uma barra no topo da conversa mostra quantos arquivos foram selecionados, com botões "Baixar selecionados" e "Cancelar".
- Os downloads acontecem em sequência pelo navegador, reaproveitando a rota de mídia já existente (`?download=1`), sem mudar o layout normal da conversa.
- Nada mais muda: envio por Enter, abas, ações de status e demais comportamentos permanecem iguais.

## Detalhes técnicos
1. `src/routes/whatsapp.tsx` apenas:
   - Estado `selecionandoMidia` (boolean) e `selecionados` (Set de ids de mensagens) na conversa aberta, zerados ao trocar de conversa/aba.
   - No cabeçalho: botão para entrar/sair do modo seleção + barra com contagem e botão de baixar.
   - Em `MidiaMensagem`: quando em modo seleção, renderizar checkbox e bloquear clique de ampliar/download individual; selecionar clicando no balão.
   - Função `baixarSelecionados()`: percorre os ids selecionados e dispara `urlMidia(id, true)` em sequência (pequeno intervalo entre downloads via âncora oculta), reutilizando a rota existente.
2. Sem alteração de banco, rota de mídia, bot, webhook ou layout geral.
