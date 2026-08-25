# Controle de números do bot (nova aba em BOT)

Hoje o webhook busca o número da loja em Configurações e bloqueia o bot para ele direto no código. Isso sai. No lugar entra uma configuração visual onde você escolhe para quais números o bot responde.

## O que muda

### Nova aba "Números" na página BOT
- **Modo de operação** (escolha única):
  - *Todos os números* — bot responde a todos, exceto os que estiverem na lista de bloqueados.
  - *Somente liberados (modo teste)* — bot responde apenas aos números marcados como liberados.
- **Lista de números**: adicionar número (com nome/observação opcional), marcar como Liberado ou Bloqueado, editar e excluir.
- Cada linha mostra um switch Ativo/Inativo para ligar/desligar o bot naquele número sem apagar o registro.
- Números são normalizados (só dígitos, com DDI 55) para casar com o formato que chega do WhatsApp.

### Atalho na tela WhatsApp
- Em cada conversa, um botão "Bot ligado/desligado" que grava o número na lista, sem precisar ir até a página BOT.

### Fim do bloqueio fixo do número da loja
- O trecho que compara o telefone com o número da loja e devolve `proprio_numero` é removido.
- Se você quiser continuar ignorando o número da loja, basta adicioná-lo como bloqueado na nova lista (não será feito automaticamente).
- Mensagens enviadas pela própria loja pelo celular (`fromMe`) continuam ignoradas — isso evita loop do bot respondendo a si mesmo.

## Detalhes técnicos

- Nova tabela `bot_numeros`: `id`, `telefone` (único, normalizado), `nome`, `permitido` (bool), `ativo` (bool), `observacao`, timestamps. Com GRANTs e RLS (leitura/escrita para `authenticated`, `service_role` total).
- Novo campo em `bot_config` (ou tabela de configuração do bot já existente): `modo_numeros` = `todos` | `somente_liberados`, padrão `todos`.
- `src/routes/api/public/whatsapp/webhook.ts`: substituir a checagem `ehProprioNumero` por uma consulta a `bot_numeros` + `modo_numeros`; quando o número não estiver autorizado, a mensagem continua sendo registrada na conversa (histórico intacto), apenas o `processarBot` não roda, retornando `motivo: "numero_desativado"`.
- `src/routes/bot.tsx`: nova aba com o seletor de modo e o CRUD da lista.
- `src/routes/whatsapp.tsx`: botão de liga/desliga do bot por conversa gravando em `bot_numeros`.
