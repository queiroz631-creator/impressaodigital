# Melhoria 25 — Botão de imprimir nas mensagens (WhatsApp)

Nas conversas, mensagens que contêm **PDF ou imagem** ganham um botão de
impressão, tanto nos arquivos recebidos do cliente quanto nos enviados por nós.

## Como fica

- Ao passar o mouse sobre a mensagem, aparece um botão de impressora ao lado dos
  já existentes (editar / excluir). Hoje esses botões só aparecem nas mensagens
  enviadas; o de imprimir aparece também nas recebidas do cliente.
- O botão só aparece quando o arquivo é PDF ou imagem (áudio e outros tipos ficam
  como estão).
- Ao clicar, o arquivo é aberto e a janela de impressão do navegador abre
  automaticamente, sem precisar baixar o arquivo antes.
- Enquanto o arquivo carrega, o botão mostra um indicador de carregando; se
  falhar, aparece um aviso.

## Detalhes técnicos

- Arquivo único: `src/routes/whatsapp.tsx`.
- Novo helper de impressão: cria um `<iframe>` oculto apontando para
  `urlMidia(id)` (proxy já existente em `/api/public/whatsapp/midia`); no
  `onload`, chama `contentWindow.print()` e remove o iframe depois. Para imagens,
  o iframe recebe um documento HTML mínimo com a imagem em largura total, para a
  impressão sair na página inteira.
- O botão é renderizado no mesmo grupo de ações já existente (linha do hover),
  com a condição de exibição ampliada para mensagens de entrada quando houver
  `arquivo_url` de PDF/imagem; editar/excluir continuam restritos às mensagens
  enviadas.
- Escondido no modo de seleção de arquivos, como os demais botões.
- Sem mudanças em banco, layout geral, bot ou demais telas.
- Ao final: marcar a melhoria "Botão de Imprimir" como executada.
