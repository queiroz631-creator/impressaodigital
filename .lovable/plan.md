# Primeiro contato: ações silenciosas

Na aba **Primeiro contato** (Configuração do Bot), adicionar no campo **"O que o bot faz"** as opções:
- **Finalizar atendimento (sem mensagem)**
- **Transferir para atendente (sem mensagem)**

Nenhuma outra alteração de layout, banco de dados ou comportamento.

## O que muda

1. O dropdown de ação da regra passa a listar os dois novos valores.
2. Quando o bot executa a regra:
   - **Finalizar silencioso**: finaliza o atendimento (status `finalizado`, limpa contexto, registra auditoria), mas **não envia** a mensagem de despedida configurada em "Mensagens".
   - **Transferir silencioso**: muda o status para `aguardando` / etapa `aguardando_atendente`, registra o motivo e auditoria, mas **não envia** a mensagem de transferência configurada.

## Detalhes técnicos

- `src/lib/bot-fluxos.ts`: adicionar `finalizar_silencioso` e `transferir_silencioso` ao catálogo `ACOES_PRIMEIRO_CONTATO`.
- `src/lib/bot.server.ts`: no `switch` de `executarAcaoResposta`, expandir o case `atendente` para também tratar `transferir_silencioso`, chamando `transferir(..., true)`.
- Sem alteração de banco de dados: a coluna `acao` da tabela `bot_primeiro_contato` já armazena texto livre.
- A função `finalizar`/`finalizar_silencioso` já existe em `executarAcaoResposta`, então não precisa de novos cases.
