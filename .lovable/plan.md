# Melhoria 27 — Assumir atendimento + envio de anexos na conversa

## Parte 1 — Assumir atendimento abre a conversa
Ao assumir um atendimento (pelo botão "Assumir" ou quando ele passa para atendimento humano), ir direto para a conversa do cliente já aberta, em vez de fechar a conversa e deixar o usuário na aba anterior.

- Ao clicar em "Assumir": a aba muda para "Em atendimento" e a conversa continua aberta, pronta para digitar.
- Se o robô transferir para atendimento humano uma conversa que já está aberta na tela, ela permanece aberta e a aba acompanha o novo status.
- Demais ações (Devolver ao bot, Pendente, Fila de impressão, Finalizar) continuam como hoje: a conversa fecha e a aba atual é mantida.

## Parte 2 — Caixa de mensagem
- Ao abrir qualquer conversa, o cursor já fica na caixa de digitação (foco automático), inclusive ao trocar de conversa.
- Novo botão de clipe ao lado da caixa de texto para escolher arquivos do computador (imagens, PDF e documentos).
- Arrastar e soltar arquivos sobre a caixa de texto anexa automaticamente, com destaque visual durante o arraste.
- Os anexos aparecem como uma lista acima da caixa, cada um com opção de remover.
- Enter (ou o botão de enviar) envia os anexos; o texto digitado vai como legenda do primeiro arquivo. Shift+Enter continua quebrando linha.
- Enquanto envia, mostra progresso e bloqueia envios duplicados; sucesso e erro aparecem em avisos como já acontece hoje.

## Detalhes técnicos
`src/routes/whatsapp.tsx`:
- `alterarStatus` ganha um parâmetro opcional para, após mudar para `em_atendimento`, chamar `onAbrirConversa(conversa.id, "em_atendimento")` — mesmo callback já usado por "Últimos Arquivos". Usado só no botão "Assumir".
- No efeito que fecha a conversa aberta quando o status deixa de bater com a aba, abrir exceção para `em_atendimento`: trocar a aba e manter aberta.
- `useRef` no `Textarea` + `useEffect` com foco ao montar/trocar `conversa.id`.
- Estado `anexos: File[]`; `<input type="file" multiple hidden>` acionado pelo botão de clipe; handlers `onDragOver`/`onDragLeave`/`onDrop` no contêiner da caixa de texto.
- No envio: para cada anexo, ler como base64 (`FileReader`) e chamar `enviarArquivoWhatsapp`; se houver texto sem anexos, mantém o fluxo atual de `enviarTexto`. Invalidação das queries de mensagens/conversas como hoje.

`src/lib/whatsapp.functions.ts`:
- `enviarArquivoWhatsapp` passa a aceitar também documentos genéricos (`tipo: "documento"`), usando `send-document/{extensão}` da Z-API com o mime type real, mantendo o comportamento atual de `pdf` e `imagem` intacto.

Sem mudanças de banco de dados, lógica do bot ou layout geral da tela. Ao final, marcar a melhoria como executada.
