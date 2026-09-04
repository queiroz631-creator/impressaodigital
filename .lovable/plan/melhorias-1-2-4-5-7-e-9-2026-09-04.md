# Melhorias 1, 2, 4, 5, 7 e 9

## 1. Últimos Arquivos: só arquivos do cliente (WhatsApp)

Hoje o botão "Últimos Arquivos" seleciona todos os arquivos do último atendimento, inclusive os enviados pelo sistema, pelo WhatsApp do celular ou pelo WhatsApp Web.

- Passa a selecionar apenas os arquivos recebidos do cliente (mensagens de entrada) dentro do atendimento mais recente.
- Toda a lógica atual continua: abre o atendimento mais recente, respeita o separador "ATENDIMENTO n", seleção manual, download e envio para a calculadora seguem iguais.

## 2. Transcrever áudio (WhatsApp)

- Cada balão de áudio ganha um botão "Transcrever".
- Ao clicar, o sistema transcreve o áudio e mostra o texto em um modal (com opção de copiar). Nada é enviado ao cliente.
- A transcrição é guardada junto da mensagem, então reabrir mostra o texto já pronto sem gastar IA de novo.
- Erros (áudio indisponível, falha da IA) aparecem como aviso, sem quebrar a conversa.

## 3. Vários tipos de finalização (melhoria 4)

- Em Configurar Bot → Fluxos, cada fluxo ganha a opção "Aparecer nas opções de finalização".
- No WhatsApp, o botão "Finalizar" passa a abrir um modal com uma lista de escolha única:
  - "Finalizar agora" (comportamento atual, imediato);
  - um item para cada fluxo marcado.
- Escolhendo um fluxo, a conversa vai para "Aguardando Finalização" e é finalizada por aquele fluxo, respeitando o tempo de espera já configurado.
- O botão de bandeira atual (enviar para Aguardando Finalização com o fluxo padrão) continua existindo.

## 4. Iniciar conversa pelo sistema ou WhatsApp (melhoria 5)

- Quando uma mensagem sai (pelo sistema, celular ou WhatsApp Web) e a conversa está finalizada, é nova, em "Automático", "Aguardando Resposta" ou "Aguardando Finalização", o status passa automaticamente para "Em Atendimento".
- Conversas em "Pendente" ou já em "Em Atendimento" continuam como estão.

## 5. Fila "Esperando Impressão" (melhoria 7)

- Novo status de conversa "Esperando Impressão", com aba própria no WhatsApp (ícone de impressora, contagem e destaque de não lidas como as demais).
- Enquanto a conversa estiver nesse status, o bot não responde (fila humana), igual a "Pendente".
- Nova ação disponível em: etapas e opções de fluxo, respostas automáticas (SIM/NÃO) e regras de primeiro contato — "Enviar para Esperando Impressão", com versão silenciosa (sem mensagem).
- Botão no cabeçalho da conversa para mover manualmente para essa fila.

## 6. Filtrar conversas finalizadas (melhoria 9)

- Na aba "Finalizado", por padrão aparecem só as conversas finalizadas hoje, com um botão "Mostrar todas" para ver o histórico completo.
- A pesquisa passa a buscar em todas as conversas, independentemente da data e do status: ao pesquisar, só as abas que contêm o cliente pesquisado ficam com resultados e a contagem reflete a busca.
- A busca aceita nome, telefone e também palavras que apareçam nas mensagens da conversa.

## 7. Destaque de melhorias implementadas (tela Melhorias)

- Ao finalizar a implementação de uma melhoria, ela passa a aparecer na lista com **borda esverdeada**, indicando que já foi executada.
- O status continua "pendente": só o botão "Concluir" (manual) fecha a melhoria de fato. O destaque verde não mexe no status nem no fluxo de Reabrir/Concluir.
- Regra válida daqui em diante: toda melhoria implementada é marcada com esse destaque ao final do trabalho.

## Detalhes técnicos

- Banco (uma migração):
  - `whatsapp_mensagens.transcricao text null` (cache da transcrição de áudio);
  - `bot_fluxos.mostrar_finalizacao boolean not null default false`;
  - `melhorias.executada boolean not null default false` (marca "implementada, aguardando conclusão manual");
  - novo valor de status `esperando_impressao` (coluna é texto, sem enum a alterar).
- `src/routes/melhorias.tsx`: borda verde (`border-green-500/60`) quando `executada` for verdadeira; ao implementar, marco via banco.
- `src/lib/whatsapp-comum.ts`: incluir `esperando_impressao` em `StatusConversa`, `STATUS_CONVERSA` e rótulos.
- `src/routes/whatsapp.tsx`: filtro de entrada em "Últimos Arquivos"; botão/modal de transcrição; modal de finalização com radiobuttons; nova aba e botão de "Esperando Impressão"; filtro de finalizados do dia + busca global por nome/telefone/mensagem.
- Busca por conteúdo: consulta adicional em `whatsapp_mensagens` (`ilike` no texto) só quando houver termo, com debounce, retornando os `conversa_id` correspondentes.
- Transcrição: novo server function em `src/lib/whatsapp.functions.ts` + helper server-only que baixa o áudio pela rota `api/public/whatsapp/midia` e chama o Lovable AI Gateway com `openai/gpt-5.6-sol`; grava em `whatsapp_mensagens.transcricao`.
- `src/lib/bot-fluxos.ts`: novas ações `esperando_impressao` e `esperando_impressao_silencioso` em `ACOES_ETAPA`, `ACOES_OPCAO`, `ACOES_RESPOSTA` e `ACOES_PRIMEIRO_CONTATO` (+ `ACOES_SISTEMA`).
- `src/lib/bot.server.ts`: tratar o novo status como fila humana (bot não responde), executar a nova ação com/sem mensagem, e definir "Em Atendimento" ao registrar mensagem de saída em conversa nova/finalizada/automática (também em `src/routes/api/public/whatsapp/webhook.ts` para envios fora do sistema).
- `src/components/bot/FluxoConfigurador.tsx` / `FluxosPainel.tsx`: switch "Aparecer nas opções de finalização".
- Sem mudanças de layout geral, na calculadora, orçamentos ou currículos.
