# Duas conexões de WhatsApp independentes + Usuários e permissões

Hoje o sistema funciona com um único número: as credenciais da Z-API ficam fixas no servidor, existe uma só configuração de bot e um só conjunto de fluxos, horários e respostas. O plano abre isso para várias conexões, cada uma com o seu próprio bot, e passa a controlar por atendente qual conexão ele vê.

## Nova página "Conexões"

Para cadastrar e gerenciar os números (visível apenas para administrador):

- Adicionar conexão com apelido (ex.: "Loja", "Orçamentos"), número e as credenciais da Z-API daquela instância.
- Cartão por conexão com status (conectado / desconectado), número, cor de identificação e switch Ativa/Inativa.
- Botões: **Testar conexão**, **Reconfigurar webhook** (grava na Z-API o endereço exclusivo daquele número), **Editar** e **Excluir**, além do endereço do webhook para copiar.

A conexão que já existe hoje entra automaticamente como a primeira da lista, com todo o histórico e toda a configuração atual preservados.

## Nova página "Usuários" (com aba Perfil)

- **Aba Usuários:** lista de todos os atendentes com nome, e-mail, perfil, conexão vinculada e situação (ativo/inativo). Permite escolher o perfil e a conexão de cada um.
- **Aba Perfis:** cadastro de perfis (ex.: Administrador, Atendente, Financeiro) com as permissões do sistema marcadas em caixas de seleção — uma por tela (Calculadora, Orçamentos, Currículos, Clientes, WhatsApp, Mensagens Rápidas, Bot, Conexões, Preços, Configurações, Usuários, Melhorias) e as ações sensíveis (excluir pedido, alterar preços, gerenciar conexões, gerenciar usuários).
- O menu lateral passa a mostrar apenas as telas permitidas ao perfil do usuário logado, e cada página bloqueia o acesso direto de quem não tem permissão.
- O primeiro administrador atual mantém acesso total.

## Conexão por atendente

- Cada usuário tem uma conexão vinculada. Na tela WhatsApp ele vê apenas as conversas, abas e contadores daquela conexão.
- O administrador pode ver todas e trocar com um seletor no topo da lista de contatos; a escolha fica salva.
- O envio de mensagens, arquivos e mensagens rápidas usa a conexão da conversa aberta.
- Usuário sem conexão vinculada recebe um aviso na tela WhatsApp pedindo que o administrador faça o vínculo.

## Bot separado por conexão

Cada conexão passa a ter configuração completa e independente: horários, mensagens do sistema, inatividade, fluxos, respostas automáticas, primeiro contato, números liberados/bloqueados e Status do WhatsApp.

- Na página de configuração do bot entra um seletor de conexão no topo (atendente vê só a sua; administrador vê todas).
- Toda a configuração de hoje continua vinculada à primeira conexão. A segunda nasce com horários e mensagens padrão e sem fluxos — você monta do zero.

## Detalhes técnicos

- Nova tabela `whatsapp_conexoes`: `nome`, `telefone`, `cor`, `base_url`, `instance_id`, `instance_token`, `client_token`, `webhook_token` (único), `ativo`, `ordem`, timestamps. GRANTs + RLS: leitura de dados não sensíveis para `authenticated`, escrita só para administrador; credenciais lidas apenas no servidor pelo cliente admin.
- Coluna `conexao_id` (FK) em `whatsapp_config`, `whatsapp_conversas`, `bot_fluxos`, `bot_respostas`, `bot_horarios`, `bot_menu_opcoes`, `bot_primeiro_contato`, `bot_numeros`, `bot_status_whatsapp`. A migração cria a conexão inicial a partir das variáveis de ambiente atuais e faz backfill de todas as linhas para ela.
- Novas tabelas `perfis_acesso` (`nome`, `permissoes` jsonb, `ativo`) e colunas em `profiles`: `perfil_id`, `conexao_id`, `ativo`. `user_roles` continua sendo a fonte de verdade para administrador (nada de papel dentro de `profiles`). Função `tem_permissao(_user_id, _chave)` em SQL `security definer` para uso nas policies.
- RLS de `whatsapp_conversas`, `whatsapp_mensagens`, `whatsapp_arquivos` passa a exigir administrador ou `conexao_id` igual à conexão do usuário.
- `src/lib/zapi.server.ts`: `chamarZapi` recebe as credenciais da conexão, com fallback para as variáveis de ambiente. Ajustar os chamadores (`whatsapp.functions.ts`, `bot.server.ts`, `status-whatsapp.server.ts`, `curriculo.functions.ts`, `link-dados.server.ts`).
- Webhook: nova rota `src/routes/api/public/whatsapp/webhook/$token.ts` resolvendo a conexão pelo `webhook_token`; a rota atual continua funcionando como primeira conexão (compatibilidade com o que já está na Z-API).
- `bot-dados.server.ts` e `bot.server.ts` filtram por `conexao_id`; fila, inatividade e status iteram cada conexão ativa (as rotas de cron mantêm um único token).
- Novos `src/routes/conexoes.tsx` e `src/routes/usuarios.tsx`; novo hook `usePermissoes` e filtro de itens no `AppLayout`; seletor de conexão em `ConfiguracaoBot.tsx` e `whatsapp.tsx`.
- Nada muda na calculadora, orçamentos, pedidos, currículos e preços além do controle de acesso.
