# Transcrição fixa abaixo do áudio, com destaque de cor

## O que muda para você

Hoje, ao transcrever um áudio no WhatsApp, o texto abre numa janela (modal) que some ao fechar. Com este ajuste:

- A transcrição passa a ficar **fixada logo abaixo do player de áudio**, dentro da própria mensagem — visível o tempo todo, sem abrir janela.
- O texto transcrito aparece num **cartão com cor diferente** (fundo âmbar/dourado suave, com ícone de microfone e o rótulo "Transcrição"), para ficar claro que aquele texto veio de um áudio transcrito.
- O botão **"Copiar transcrição"** continua disponível, agora ao lado do texto fixado.
- Enquanto a IA transcreve, o botão mostra "Transcrevendo..." como hoje; se falhar, o aviso de erro continua aparecendo.
- Vale para áudios já transcritos antes (eles já têm o texto salvo) e para novos.

## O que NÃO muda

- A transcrição em si (servidor, IA, gravação no banco, cache) — nada disso é tocado.
- Player de áudio, botão de baixar, imagens, documentos, seleção múltipla e o resto da tela do WhatsApp.
- No modo de seleção de arquivos (para baixar/imprimir), o cartão de transcrição não aparece, mantendo a seleção limpa.

## Detalhes técnicos

- Arquivo: `src/routes/whatsapp.tsx`, componente `MidiaMensagem` (bloco de áudio, ~linhas 2301-2356).
- Remover o `Dialog` de transcrição e o estado `transcricaoAberta`; no sucesso de `transcreverAudio()`, apenas gravar o texto no estado (o cartão aparece sozinho).
- Renderizar, quando `transcricao` existir e não estiver em modo seleção, um cartão fixo abaixo dos botões:

```text
┌─────────────────────────────────────┐
│ 🎙 Transcrição          [Copiar]    │
│ "texto transcrito do áudio..."      │
└─────────────────────────────────────┘
  fundo: bg-amber-50 / border-amber-300 / text-amber-900
  (dark: bg-amber-950/40, border-amber-800, text-amber-100)
```

- Botão "Ver transcrição" deixa de existir (o texto já está visível); quando não há transcrição, mantém o botão "Transcrever".
- Cores fixas (âmbar) por ser um destaque funcional, fora dos tokens de status — mesmo padrão já usado em avisos da tela.
- Verificação: `bunx tsgo --noEmit`, build e conferência visual com Playwright numa conversa com áudio transcrito.
- Sem commit, push, deploy ou publicação.
