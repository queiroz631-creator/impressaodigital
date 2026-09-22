# Corrigir mensagem que deforma a tela do WhatsApp

A conversa do telefone **(27) 99695-8591** foi localizada e conferida. A tela está criando rolagem lateral: a largura medida ficou maior que a janela, e mensagens com texto/link longo podem forçar o balão a crescer em vez de quebrar corretamente.

## Ajuste proposto

- Conter cada linha de mensagem dentro da largura da conversa, sem deixar o texto empurrar a página para os lados.
- Fazer textos longos, links, códigos e palavras sem espaço quebrarem automaticamente dentro do balão.
- Manter o visual atual dos balões, horários, botões de editar/apagar/imprimir e mídia.
- Aplicar a mesma correção para mensagens recebidas e enviadas.
- Manter a conversa do dia e o botão de carregar mensagens anteriores como estão.

## Detalhes técnicos

- Alterar apenas `src/routes/whatsapp.tsx`.
- No bloco que renderiza cada mensagem:
  - adicionar `min-w-0` no contêiner da linha;
  - deixar o balão com `min-w-0`, `max-w-full` e limite responsivo adequado;
  - trocar o texto para quebrar com regra mais forte (`overflow-wrap: anywhere` / equivalente Tailwind) além do `whitespace-pre-wrap`.
- Revisar também o cartão de transcrição e mídia para não criarem largura maior que o painel.
- Verificar novamente a conversa do telefone informado em desktop e confirmar que não há rolagem lateral.

## Fora do escopo

- Não alterar mensagens salvas, histórico, status, bot, envio, anexos, ZIP, transcrição ou banco de dados.
