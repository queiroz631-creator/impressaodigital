# Duas conexões de WhatsApp independentes

Hoje o sistema funciona com um único número: as credenciais da Z-API ficam fixas no servidor e existe uma só configuração de bot, um só conjunto de fluxos, horários e respostas. O plano abre isso para várias conexões, cada uma com o seu próprio bot.

## Nova página "Conexões"

Uma página nova (abaixo de Configurações) para cadastrar e gerenciar os números:

- Adicionar conexão com: nome/apelido (ex.: "Loja", "Orçamentos"), número de telefone e as credenciais da Z-API daquela instância.
- Cartão por conexão mostrando: status (conectado / desconectado), número, apelido, cor de identificação e um switch Ativa/Inativa.
- Botões por conexão: **Testar conexão**, **Reconfigurar webhook** (grava na Z-API o endereço exclusivo daquele número), **Editar** e **Excluir**.
- O endereço do webhook de cada conexão é exibido para copiar, caso você prefira colar manualmente no painel da Z-API.

A conexão que já existe hoje entra automaticamente como a primeira da lista, com todo o histórico e toda a configuração atual preservados.

## Bot separado por conexão

Cada conexão passa a ter a sua própria configuração completa e independente:

- Horários de funcionamento, mensagens do sistema, inatividade, fluxos, respostas automáticas, primeiro contato, números liberados/bloqueados e Status do WhatsApp.
- Na página de configuração do bot entra um seletor de conexão no topo. Tudo que aparece abaixo passa a ser daquele número; trocar o seletor troca todo o conteúdo.
- Toda a configuração de hoje continua vinculada à primeira conexão. A segunda conexão nasce com horários e mensagens padrão e sem fluxos — você monta do zero.

## Tela WhatsApp separada por conexão

- Um seletor de conexão no topo da lista de contatos. As abas, contadores e conversas mostram apenas o número selecionado.
- A conexão escolhida fica salva e é reaberta na próxima visita.
- O envio de mensagem, arquivos, mensagens rápidas e ações usam a conexão da conversa aberta.
- Conversas existentes ficam vinculadas à primeira conexão.

## Detalhes técnicos

- Nova tabela `whatsapp_conexoes`: `id`, `nome`, `telefone`, `cor`, `base_url`, `instance_id`, `instance_token`, `client_token`, `webhook_token` (único), `ativo`, `ordem`, timestamps. GRANTs + RLS restritos a `authenticated`/`service_role` (leitura das credenciais só no servidor via admin client).
- Coluna `conexao_id` (FK) adicionada em `whatsapp_config`, `whatsapp_conversas`, `bot_fluxos`, `bot_respostas`, `bot_horarios`, `bot_menu_opcoes`, `bot_primeiro_contato`, `bot_numeros`, `bot_status_whatsapp`. Migração cria a conexão inicial a partir das variáveis de ambiente atuais e faz backfill de todas as linhas existentes para ela.
- `src/lib/zapi.server.ts`: `chamarZapi` passa a receber as credenciais da conexão (`chamarZapi(cred, caminho, opcoes)`), com fallback para as variáveis de ambiente quando não houver conexão informada. Ajustar todos os chamadores (`whatsapp.functions.ts`, `bot.server.ts`, `status-whatsapp.server.ts`, `curriculo.functions.ts`, `link-dados.server.ts`).
- Webhook: nova rota `src/routes/api/public/whatsapp/webhook/$token.ts` resolvendo a conexão pelo `webhook_token`; a rota atual continua funcionando e é resolvida como a primeira conexão (compatibilidade com o que já está gravado na Z-API).
- `src/lib/bot-dados.server.ts` e `src/lib/bot.server.ts`: todas as leituras passam a filtrar por `conexao_id`; a fila, inatividade e status percorrem cada conexão ativa.
- Rotas de cron (`fila`, `inatividade`, `status`) continuam com um único token e passam a iterar as conexões ativas.
- Novo `src/routes/conexoes.tsx` + item de menu no `AppLayout`. Seletor de conexão em `ConfiguracaoBot.tsx` e em `whatsapp.tsx` (preferência salva no navegador).
- Nada é alterado na calculadora, orçamentos, pedidos, currículos ou preços.
