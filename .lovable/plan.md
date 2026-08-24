# Reestruturar Configurações → Bot

Transformar a aba Bot numa tela visual e simples, e ligar essas configurações ao atendimento automático já existente (Z-API + fluxo de orçamento + currículo + pedidos). Nada da integração técnica sai do lugar: Instance ID, tokens, webhook e status de conexão continuam na aba WhatsApp/Z-API.

## O que existe hoje (verificado)

- A aba Bot é só uma lista de 7 textareas (`msg_inicial`, `msg_boas_vindas`, `msg_transferencia`, `msg_finalizacao`, `msg_orcamento_gerado`, `msg_revisao`, `msg_orcamento_confirmado`) gravadas na tabela `whatsapp_config`, mais alguns switches.
- O bot (`src/lib/bot.server.ts`) é uma máquina de estados fixa: nome → arquivos → tipo → formato → material → cópias → frente/verso → acabamento → orçamento. Não existe menu, palavras-chave, horário nem respostas automáticas.
- Já existe interpretação por IA (Lovable AI) para opção/sim-não/quantidade, e a tela de Atendimento já tem "assumir" e "devolver para o bot".

## Banco (novas tabelas, reaproveitando `whatsapp_config`)

Campos novos em `whatsapp_config` (nada removido): bot 24h, mensagem fora do horário, mensagem "não entendi", minutos de inatividade, mensagem/flag de finalização e "1x por dia", flag de usar IA, e controle de saudação diária por conversa.

Tabelas novas (com RLS + GRANTs no padrão do projeto):
- `bot_horarios` — um registro por dia da semana: abre, fecha, fechado.
- `bot_menu_opcoes` — nome, ação (orcamento / consultar_pedido / curriculo / atendente / mensagem), mensagem, ordem, ativo, permitir palavra-chave.
- `bot_respostas` — respostas automáticas: título, texto da resposta, ativo, ordem.
- `bot_palavras_chave` — palavras/frases ligadas a uma opção de menu **ou** a uma resposta automática.

Ao ativar o bot pela primeira vez, é criada a configuração padrão pronta: boas-vindas, horários seg–sex 08–18, sáb 08–13, dom fechado, e o menu com Fazer orçamento / Consultar pedido / Currículo / Falar com atendente.

## Tela (Configurações → Bot)

Cabeçalho fixo: "Configuração do Bot", status 🟢/⚫ do bot, status 🟢/🔴 do WhatsApp (vindo da integração atual), switch Bot ativo, indicador "● Alterações não salvas" / "✓ Tudo salvo" e botão fixo Salvar alterações.

Desktop: configuração à esquerda, Prévia do WhatsApp à direita (atualiza sozinha). Mobile: prévia abaixo. Seções em cards expansíveis:

1. Horário de atendimento — switch 24 horas; senão, um dia por linha com abre/fecha/fechado e botão "Copiar horário para os outros dias".
2. Mensagem fora do horário — textarea + Restaurar padrão (enviada quando o atendimento for encaminhado para humano fora do horário).
3. Mensagem de boas-vindas — textarea com chips clicáveis `{nome}` `{telefone}` `{saudacao}` inseridos na posição do cursor; e a mensagem de retorno usada quando o cliente escreve de novo no mesmo dia.
4. Menu principal — cards por opção (nome, ação, mensagem, palavras-chave, ativo), reordenáveis por setas ↑/↓ e arrastar, com confirmação ao excluir.
5. Respostas automáticas — título, texto e lista de palavras/frases, com botões "+ Palavra/frase" e "+ Nova resposta".
6. Sem resposta reconhecida — tempo (min) e mensagem de oferta de atendente; após o mesmo tempo sem resposta, encaminha para Aguardando resposta.
7. Mensagem de finalização — textarea, enviar ao finalizar, e limitar a 1 envio por dia.
8. Usar IA para entender mensagens — switch (OFF = palavras-chave e regras).
9. Testar bot — simulador em diálogo, com Reiniciar conversa; roda as mesmas regras sem enviar nada pelo WhatsApp.

## Comportamento do bot

Prioridade a cada mensagem recebida: atendimento humano ativo → não responde; fluxo em andamento (orçamento/currículo) → continua; resposta automática reconhecida → responde; opção de menu reconhecida → confirma e executa; IA (se ligada) → identifica intenção; senão, ignora e aguarda a próxima, até o tempo de inatividade.

- Boas-vindas apenas na primeira mensagem do dia; nas demais, mensagem de retorno. As duas terminam com SIM/NÃO para abrir o menu.
- Palavra-chave sempre pede confirmação ("É isso que você procura? SIM/NÃO") antes de mudar o fluxo. NÃO = ignora e tenta na próxima mensagem.
- Cliente que já inicia enviando arquivo: bot pergunta se é para orçamento e, com SIM, entra no fluxo de orçamento existente (sem duplicar a calculadora).
- Currículo usa o módulo Currículo Vitae já existente: identifica por CPF se já há currículo e oferece Criar / Atualizar / Voltar. CPF nunca aparece no currículo.
- Consultar pedido usa a tabela `pedidos` atual.
- Falar com atendente move para Aguardando resposta e o bot para de responder; fora do horário, envia a mensagem fora do horário.
- "Voltar ao menu principal" disponível em todos os submenus.
- Assumir atendimento pausa o bot (Em atendimento); Devolver para bot retoma na etapa guardada — comportamento já existente, apenas preservado.

## Detalhes técnicos

- Botões SIM/NÃO via endpoint de botões da Z-API, com fallback automático para lista numerada em texto quando a instância não suportar.
- Casamento de palavras-chave sem exigir texto exato: normalização (minúsculas, sem acento/pontuação) + similaridade por tokens; com IA ligada, usa `src/lib/ia.server.ts` para escolher a intenção.
- Os disparos por tempo (5 min sem resposta) exigem verificação agendada: rota pública `/api/public/whatsapp/inatividade` protegida por token, chamada por agendamento no banco.
- Todas as mensagens passam a vir das configurações; nenhum texto importante fica fixo em `bot.server.ts`.
- Sem dados mockados; ao final, verificação de TypeScript, imports, RLS/GRANTs, salvamento, simulador e responsividade.

## Entrega em etapas

1. Banco + configuração padrão.
2. Nova tela do Bot (cards, prévia, salvamento).
3. Motor do bot: horários, saudação diária, menu, palavras-chave, respostas automáticas, prioridade.
4. Ações (orçamento, pedido, currículo, atendente), inatividade e simulador.
