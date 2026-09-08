# Melhoria 27 — Editar e apagar mensagens enviadas (WhatsApp)

Permitir que o atendente edite ou apague uma mensagem já enviada ao cliente, direto na tela de conversa.

## Como vai funcionar

- Passando o mouse sobre uma mensagem enviada pela loja aparece um menu (ícone de três pontos) com **Editar** e **Apagar**.
- **Editar**: abre uma caixa com o texto atual; ao salvar, o texto é corrigido no WhatsApp do cliente e na conversa, e a mensagem passa a exibir a marca "editada".
- **Apagar**: pede confirmação; a mensagem é apagada no WhatsApp do cliente e continua visível na conversa em tom bem claro e com traço sobre o texto, indicando "mensagem apagada".
- Só vale para mensagens enviadas pela loja/bot (não para mensagens do cliente) e apenas para mensagens de texto quando for edição. Apagar vale também para arquivos e imagens enviados pela loja.
- O WhatsApp só aceita edição por tempo limitado; se recusar, aparece um aviso explicando e nada é alterado.
- Mensagens apagadas deixam de contar como "última mensagem" nova e não podem ser editadas depois.

## Detalhes técnicos

Banco (`whatsapp_mensagens`), migração:
- `editada boolean not null default false`, `editada_em timestamptz`, `texto_original text`
- `apagada boolean not null default false`, `apagada_em timestamptz`

`src/lib/zapi.server.ts`:
- incluir `DELETE` nos métodos aceitos por `chamarZapi`.

`src/lib/whatsapp.functions.ts` (novas server functions com `requireSupabaseAuth`):
- `editarMensagemWhatsapp({ mensagemId, texto })` — busca a mensagem, valida `direcao = "saida"`, `tipo = "texto"`, não apagada e `whatsapp_message_id` presente; chama Z-API `edit-message` (`{ phone, messageId, message }`); em sucesso atualiza `texto`, `texto_original`, `editada`, `editada_em` e a `ultima_mensagem` da conversa quando for a última.
- `apagarMensagemWhatsapp({ mensagemId })` — valida `direcao = "saida"` e `whatsapp_message_id`; chama Z-API `messages` com método `DELETE` (`?messageId=...&phone=...&owner=true`); em sucesso marca `apagada`, `apagada_em`, limpa nada do histórico e ajusta `ultima_mensagem` para "Mensagem apagada" quando for a última.
- Ambas retornam `{ ok, erro }` e registram em `whatsapp_auditoria` (ações `mensagem_editada` / `mensagem_apagada`).

`src/routes/whatsapp.tsx` (somente a bolha de mensagem e diálogos):
- menu de ações na bolha de saída, diálogo de edição (Textarea + salvar/cancelar) e `ConfirmarExclusao` para apagar;
- bolha apagada: `opacity-60` + `line-through` no texto e rótulo "mensagem apagada"; bolha editada: sufixo "editada" ao lado da hora;
- invalidação da query de mensagens após cada ação; sem mudanças no layout geral, abas, notas ou bot.

Depois de validado (typecheck + build), marcar a melhoria 27 como executada, mantendo `status = 'pendente'`.
