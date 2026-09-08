# Melhoria 8 — Mensagens Rápidas

## Objetivo
Cadastrar mensagens rápidas (como os atalhos "/" do WhatsApp) em uma nova página abaixo de WhatsApp no menu, e usá-las na tela de conversa por atalho "/" ou por um botão que abre um modal de seleção.

## O que será feito

### 1. Nova tabela `mensagens_rapidas` (banco de dados)
- Campos: `id`, `titulo` (nome da mensagem), `atalho` (texto digitado após "/"), `tipo` (`texto`, `imagem`, `texto_imagem`), `texto`, `imagem_path`/`imagem_nome` (imagem no armazenamento), `mostrar_no_botao` (bool), `ativo`, `ordem`, timestamps.
- GRANTs para `authenticated`/`service_role`, RLS habilitado com política para usuários autenticados e trigger `set_updated_at`.

### 2. Nova página `/mensagens-rapidas`
- Novo arquivo `src/routes/mensagens-rapidas.tsx` no padrão da tela Melhorias: formulário à esquerda, lista à direita.
- Cadastro/edição: título, atalho (sem a "/"), tipo, texto (obrigatório para texto e texto+imagem), envio de imagem (obrigatória para imagem e texto+imagem), opção "Mostrar no botão da conversa", ordem e ativo.
- Imagem enviada para bucket privado de armazenamento (`mensagens-rapidas`).
- Lista com ações de editar, ativar/desativar e excluir.
- Item "Mensagens Rápidas" adicionado no menu (`src/components/AppLayout.tsx`) logo abaixo de "WhatsApp".

### 3. Uso na conversa do WhatsApp (`src/routes/whatsapp.tsx`)
- **Atalho "/"**: ao digitar "/" seguido de texto na caixa de mensagem, aparece uma lista suspensa com as mensagens rápidas cujo atalho/título combine; clicar (ou Enter) insere o texto no campo — para mensagens com imagem, selecionar abre confirmação para enviar direto.
- **Botão no compositor**: ícone ao lado da caixa de texto abre um modal (semelhante ao modal de finalização) listando apenas as mensagens com `mostrar_no_botao = true`; ao escolher, a mensagem é enviada imediatamente para a conversa aberta.
- Envio reutiliza as funções existentes: texto via `enviarTextoWhatsapp`; imagem/texto+imagem via nova função `enviarMensagemRapidaWhatsapp` (lê a imagem do armazenamento, converte para base64 e chama `send-image` da Z-API com legenda), registrando a mensagem na conversa e promovendo para "Em atendimento", como hoje.

## Fora de escopo
- Sem alterações no bot, webhook, layout da conversa ou demais telas.
- Mensagens rápidas são por sistema (visíveis a todos os usuários logados), não por atendente.

## Validação
- Typecheck e build.
- Marcar a melhoria 8 como executada (mantendo status pendente, como nas anteriores).
