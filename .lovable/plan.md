# Corrigir a triagem do primeiro contato no WhatsApp

## O que foi verificado nas conversas reais

- A triagem está sendo executada, mas com "Oi" (sem palavra-chave) ela fica em silêncio — correto conforme sua escolha.
- O tempo de fallback está em **1 minuto**: a rotina automática inicia o fluxo inicial logo depois da primeira mensagem (ex.: Luciana escreveu "Oi" às 02:07 e o menu saiu às 02:09).
- Depois disso a conversa fica em `etapa = fluxo` e **nunca mais volta para a triagem** — por isso "Horário" (que tem resposta automática cadastrada) não dispara a pergunta "Você quer falar sobre Horário de funcionamento?".
- Os testes feitos pelo número da própria loja não acionam o bot (continua assim, por sua escolha).

## O que muda

1. **Marcar quando o fluxo foi iniciado pelo fallback.** Ao iniciar o fluxo inicial por tempo (nada reconhecido), a conversa guarda essa marcação no contexto.
2. **Triagem volta a valer nesse caso.** Se a conversa está num fluxo iniciado pelo fallback e o cliente escreve algo que bate com uma resposta automática, o bot interrompe o fluxo e pergunta "Você quer falar sobre *X*?" com SIM/NÃO — seguindo as ações configuradas em Se SIM / Se NÃO.
3. **Fluxos escolhidos pelo cliente não são interrompidos.** Quem entrou em Fazer orçamento, Currículo etc. (por opção do menu ou por arquivo) continua no fluxo normalmente, mesmo escrevendo uma palavra-chave.
4. **Saudação simples continua em silêncio**, e o fallback por tempo segue como está (1 minuto, configurável na aba Inatividade).
5. **Fallback não se repete em looping.** Depois de iniciado pelo fallback, o mesmo atendimento não é reiniciado de novo pela rotina — hoje o menu é reenviado a cada novo atendimento/minuto ocioso.

## Detalhes técnicos

- `src/lib/bot.server.ts`:
  - `ContextoBot` ganha uma marca (`fluxoFallback: true`) gravada em `verificarInatividade` ao iniciar o fluxo inicial por tempo.
  - Em `rodarFluxo`, antes de repassar a mensagem ao motor de fluxos: se `ctx.fluxoFallback` for verdadeiro e `reconhecerResposta` encontrar uma resposta automática ativa, cai em `triagem()` (limpando `fluxo` e a marca) em vez de continuar o fluxo.
  - A marca é apagada quando o cliente escolhe uma opção que muda de fluxo ou quando o atendimento termina.
- Sem mudanças de banco, sem alterar cálculo de orçamento, currículo, pedidos, Z-API ou as telas.
