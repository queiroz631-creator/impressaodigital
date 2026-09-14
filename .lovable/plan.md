# Etapa 3 — Múltiplas conexões de WhatsApp

Boa parte da base já está pronta de etapas anteriores. Confirmei no banco:

- A tabela de conexões já existe, com **1 conexão** chamada "Principal" (ordem 0, ativa) e endereço de webhook próprio já gerado. As credenciais dela estão **vazias** — hoje o sistema usa as credenciais guardadas no servidor (variáveis de ambiente), com esse caminho de reserva já funcionando.
- Todos os dados atuais já estão vinculados a essa conexão: conversas, configuração, horários, fluxos, respostas, menu, primeiro contato, números e status — **zero registros sem conexão**. Nenhum backfill novo é necessário.
- As regras de acesso por conexão já existem em conversas, mensagens e arquivos, mas hoje contêm uma exceção permissiva: atendente **sem** conexão vinculada vê tudo. Isso será removido nesta etapa.
- As rotinas automáticas (inatividade a cada minuto, status a cada 5 minutos) já existem e continuam sendo únicas.
- Os 2 usuários atuais ainda não têm conexão vinculada.

Então esta etapa é sobretudo **telas + isolamento das rotinas + segurança das credenciais**.

## 1. Regra definitiva de acesso e conexão atual

- **Administrador:** vê todas as conexões.
- **Atendente com conexão vinculada:** vê somente a conexão dele.
- **Atendente sem conexão vinculada:** não vê nenhuma conversa, mensagem ou arquivo — de nenhuma conexão. Na tela WhatsApp recebe: "Seu usuário ainda não possui uma conexão de WhatsApp vinculada. Solicite ao administrador."

Essa regra vale no banco, não só na tela: as regras de acesso deixam de ter a exceção "sem conexão vê tudo". Nenhum atendente existente fica com acesso amplo por estar sem vínculo — o administrador passa a escolher a conexão dele na tela Usuários. O administrador **não** é vinculado automaticamente a nenhuma conexão; continua vendo todas.

"Principal" passa a se chamar **Impressão Digital**, guardando o número atual. Nada mais muda nela: todo o histórico e toda a configuração continuam onde estão. O webhook dela **não** é reconfigurado por migração nem por publicação — só muda se você clicar em "Reconfigurar webhook".


## 2. Proteger as credenciais (correção importante)

Hoje qualquer pessoa logada consegue ler a lista de conexões inteira — inclusive os tokens da Z-API. Vou fechar isso:

- A leitura direta da tabela de conexões passa a ser exclusiva do administrador no servidor.
- As telas passam a ler uma lista sem credenciais (nome, número, cor, situação, ordem e endereço do webhook).
- Ao editar uma conexão, os campos de token aparecem em branco com aviso "deixe em branco para manter"; o valor salvo nunca volta para a tela.
- Cada pessoa recebe apenas as conexões que pode usar: administrador recebe todas (sem credenciais), atendente recebe só a dele, atendente sem vínculo recebe nenhuma.


## 3. Nova página Conexões (só administrador)

No grupo COMUNICAÇÃO do menu. Cartões com cor, nome, número, situação (Conectado / Desconectado / Inativa) e ações: **Testar conexão**, **Reconfigurar webhook**, **Editar**, **Copiar webhook** e **Excluir**.

- Criar conexão: nome, número, endereço da Z-API, Instance ID, Instance Token, Client Token, cor, ordem, ativa/inativa. O endereço do webhook é gerado pelo sistema.
- Excluir só é permitido em conexão sem nenhum dado vinculado; havendo histórico, o botão explica e oferece desativar.
- Testar conexão e reconfigurar webhook rodam no servidor, com as credenciais guardadas — nada de token no navegador nem em mensagens de erro.

## 4. Conexão nova nasce limpa

Ao criar a segunda conexão (ex.: Queiroz Papelaria), o sistema cria só a configuração básica dela: mensagens padrão, horários padrão e **bot desligado**. Sem fluxos, sem respostas, sem números — nada da Impressão Digital aparece lá.

## 5. Endereço de webhook por conexão

Nova rota que identifica a conexão pelo endereço, confere se ela está ativa e trata a mensagem com a configuração e a Z-API daquela conexão. **O endereço atual continua funcionando** para a Impressão Digital — nada precisa ser mexido na Z-API dela.

## 6. Tela WhatsApp

- Atendente: vê apenas a conexão vinculada a ele, sem seletor. Sem vínculo, aviso: "Seu usuário ainda não possui uma conexão de WhatsApp vinculada. Solicite ao administrador."
- Administrador: seletor no topo da lista de contatos com "Todas" e cada conexão; a escolha fica salva no navegador.
- Abas, contadores, busca e lista respeitam a conexão escolhida.
- Envio de texto, arquivo, áudio e mensagem rápida usa sempre a conexão da conversa aberta.

## 7. Configuração do Bot

Seletor de conexão no topo (atendente vê só a sua). Tudo que a tela mostra e salva — mensagens, horários, menu, fluxos, respostas, primeiro contato, números, status — pertence à conexão escolhida.

## 8. Rotinas automáticas

Continua **um cron de cada rotina**. Fila, inatividade e status passam a percorrer as conexões ativas, uma a uma, usando a configuração e a Z-API de cada uma. Envio de currículo e link público passam a usar a conexão da conversa.

## Detalhes técnicos

- Migração nova (sem apagar nada): renomear a conexão inicial; substituir a policy de leitura aberta de `whatsapp_conexoes` por leitura restrita a administrador; view/RPC `whatsapp_conexoes_publicas` (sem tokens) com `security invoker` para a lista das telas; índices em `conexao_id` onde faltarem. Nenhuma credencial real dentro de migração.
- `zapi.server.ts` já expõe `credenciaisDaConexao(conexaoId)` e `chamarZapi({ conexaoId })` com reserva nas variáveis de ambiente — mantidos. Passar `conexaoId` em todos os chamadores restantes: `whatsapp.functions.ts` (enviar texto/arquivo/rápida/editar/apagar/status/webhook), `status-whatsapp.server.ts`, `link-dados.server.ts`, `curriculo.functions.ts` e as chamadas de "digitando" ainda sem conexão em `bot.server.ts`.
- Novas server functions em `src/lib/conexoes.functions.ts` com `requireSupabaseAuth` + verificação de administrador via `has_role`: listar (sem tokens), criar (cria também a config padrão), atualizar (token vazio = mantém), ativar/desativar, excluir (bloqueia com dados vinculados), testar e reconfigurar webhook.
- Nova rota `src/routes/api/public/whatsapp/webhook/$token.ts` resolvendo a conexão pelo `webhook_token`; `webhook.ts` atual permanece como compatibilidade.
- `bot.server.ts` / `status-whatsapp.server.ts`: fila, inatividade e status iteram conexões ativas; `carregarDadosBot`/`carregarFluxos` já aceitam `conexaoId`.
- Novos arquivos de tela: `src/routes/conexoes.tsx` + `src/modules/comunicacao/conexoes/` (painel e diálogo); item Conexões ativado em `src/lib/modulos.ts`; seletor em `src/routes/whatsapp.tsx` (chave de conexão nas queryKeys) e em `ConfiguracaoBot.tsx`.
- Sem alterações em Calculadora, Orçamentos, Clientes, Preços e Currículos além da conexão no envio.

## Verificação

Typecheck, lint e build; teste no preview com a conexão atual (receber, enviar, arquivo, bot, fila, áudio, status) e conferência de isolamento entre um atendente vinculado e o administrador. Sem commit e sem push.

## Ponto que precisa de decisão sua

As credenciais da Impressão Digital hoje ficam nas variáveis de ambiente, não no banco. Deixo o caminho de reserva funcionando, mas o ideal é você colar as credenciais dela na tela Conexões depois de publicada — assim as duas conexões passam a funcionar do mesmo jeito.
