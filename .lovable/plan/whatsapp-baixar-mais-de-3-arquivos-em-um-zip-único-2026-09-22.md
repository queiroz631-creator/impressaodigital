# WhatsApp: baixar mais de 3 arquivos em um ZIP único

## O que muda

Na conversa do WhatsApp, ao usar "Baixar selecionados":

- Até 3 arquivos: continua como hoje, um download por arquivo.
- 4 arquivos ou mais: o sistema junta tudo em **um único arquivo ZIP** e baixa apenas ele.
- Enquanto prepara o ZIP, o botão fica desabilitado e aparece um aviso de progresso ("Preparando 12 arquivos...").
- Nome do ZIP: `atendimento-<numero>-<data>.zip` (ou `arquivos-<data>.zip` quando não houver número de atendimento).
- Cada arquivo dentro do ZIP mantém o nome original; nomes repetidos ganham sufixo `(2)`, `(3)` etc. Arquivo sem nome recebe `arquivo-1`, `arquivo-2`.
- Se algum arquivo falhar ao ser buscado, ele é ignorado e um aviso informa quantos não entraram; o ZIP com os demais é baixado normalmente.

Nada mais muda: seleção, envio para a calculadora, impressão, abas e mensagens seguem iguais.

## Detalhes técnicos

1. Adicionar a dependência `jszip`.
2. `src/routes/whatsapp.tsx`, função `baixarSelecionados()`:
   - Mantém o laço atual de âncoras quando `ids.length <= 3`.
   - Acima disso: `fetch(urlMidia(id, true))` para cada id (em pequenos lotes, ~4 simultâneos), lê `blob()`, resolve o nome a partir de `arquivo_nome` da mensagem já carregada (fallback para o `Content-Disposition` da resposta), adiciona ao `JSZip` e gera `blob` com compressão padrão.
   - Download via `URL.createObjectURL` + âncora, seguido de `revokeObjectURL`.
   - Estado local `preparandoZip` para desabilitar o botão e exibir o progresso; `toast` de sucesso/aviso ao final; ao concluir, limpa a seleção como hoje.
3. Sem alteração na rota `/api/public/whatsapp/midia`, no banco, no bot ou no layout geral.
