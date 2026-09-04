# Corrigir a transcrição de áudio do WhatsApp

## O que está acontecendo

A transcrição chama o serviço de IA com um modelo que **não aceita áudio** como entrada (`openai/gpt-5.6-sol` só entende texto e imagem). Por isso todo pedido volta com erro e a tela mostra "A transcrição falhou. Tente novamente." — independentemente do áudio.

Além disso, os áudios do WhatsApp chegam no formato OGG/Opus, que os modelos de transcrição da OpenAI recusam; então a correção precisa usar um modelo que entenda esse formato.

## Correção

- Trocar o modelo da transcrição para um que aceite áudio e OGG (Gemini 3.7 Flash).
- Informar o formato real do áudio a partir do tipo do arquivo (padrão `ogg`), sem sufixos como `;codecs=opus`.
- Melhorar a mensagem de erro: quando a IA recusar, mostrar o motivo devolvido pelo serviço em vez de um texto genérico, e registrar o detalhe no log do servidor para facilitar diagnóstico futuro.
- Manter tudo o mais igual: o botão "Transcrever" no balão de áudio, o modal com o texto, o botão de copiar e o cache da transcrição na mensagem (não gasta IA de novo ao reabrir).

## Verificação

Depois da mudança, testo a chamada de verdade com um áudio existente da conversa e confirmo que volta texto, não erro.

## Detalhes técnicos

- Arquivo alterado: `src/lib/whatsapp.functions.ts`, apenas o handler `transcreverAudioWhatsapp`.
- `model: "google/gemini-3.7-flash"` em `POST https://ai.gateway.lovable.dev/v1/chat/completions`, mantendo o bloco `input_audio` com `data` em base64 e `format` derivado de `mime_type` (`audio/ogg; codecs=opus` → `ogg`).
- Tratamento de status conforme o contrato do gateway: 429/5xx são temporários (mensagem "tente novamente em instantes"), 402/403 indicam créditos/permissão e são mostrados como tal, 400 mostra a mensagem devolvida.
- Sem alterações de banco, layout, bot ou outras telas.
