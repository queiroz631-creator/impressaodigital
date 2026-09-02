# Ignorar agradecimento após finalizar o atendimento

## Problema
Quando o atendimento é finalizado (manual ou pelo fluxo de finalização), se o cliente manda "obrigado", "valeu", "ok" etc., a conversa volta para triagem e o bot dispara novamente as regras de primeiro contato — como se fosse um atendimento novo.

## Solução
Adicionar uma "janela de encerramento" logo após a finalização: mensagens curtas de cortesia (agradecimentos/despedidas) recebidas nesse período são **ignoradas silenciosamente** pelo bot — não respondem, não reiniciam fluxo e não reabrem atendimento.

## O que será implementado

1. **Registrar o momento da finalização**
   - Salvar no contexto da conversa (`finalizadoEm`) toda vez que o atendimento for finalizado (por fluxo, por inatividade ou manualmente pelo atendente).

2. **Lista de mensagens de encerramento**
   - Nova configuração em **Configurações → Bot**: campo editável com a lista de frases de cortesia ignoradas (padrão: "obrigado", "obrigada", "valeu", "ok", "tá bom", "blz", "beleza", "agradeço", "grato", "grata", "show", "perfeito", "show de bola", "muito obrigado", "muito obrigada", "deus abençoe", "amém").
   - Comparação normalizada: sem acentos, minúsculo, ignorando pontuação e emojis; a mensagem precisa ser só a frase (ex.: "obrigado" conta; "obrigado, e quanto fica 10 cópias?" NÃO conta).

3. **Janela de encerramento configurável**
   - Campo numérico (minutos, padrão 30): quanto tempo após a finalização essas mensagens de cortesia são ignoradas.
   - Fora da janela, o "obrigado" volta a ser tratado normalmente (cliente pode iniciar um novo atendimento).
   - Valor 0 desativa o recurso.

4. **Comportamento no motor do bot** (`src/lib/bot.server.ts`)
   - Antes de qualquer triagem/fluxo: se `etapa === "finalizado"`, estiver dentro da janela e a mensagem for só cortesia → registrar na auditoria como `cortesia_ignorada` e sair sem responder, sem mexer em etapa/status e sem tocar em inatividade.
   - Arquivos (PDF/imagem) nunca são ignorados — mesmo na janela, um arquivo reabre atendimento normalmente.

## Detalhes técnicos
- Migração: adicionar colunas `ignorar_agradecimentos` (jsonb: `{ ativo, janela_minutos, frases[] }`) na tabela de configuração do bot.
- Alterações em `src/lib/bot.server.ts` (gravação de `finalizadoEm` + verificação de cortesia) e na tela de configurações do bot (nova seção "Encerramento de atendimento").
- Nenhum impacto em regras de primeiro contato existentes, fluxos, inatividade ou "Aguardando Finalização".
