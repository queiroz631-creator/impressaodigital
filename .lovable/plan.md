# Últimos Arquivos — selecionar apenas o atendimento mais recente

## Problema
O botão **Últimos Arquivos** seleciona todos os arquivos da conversa inteira. Mas os atendimentos (ex.: "ATENDIMENTO 48", "ATENDIMENTO 49") são trechos dentro da mesma conversa, delimitados por mensagens de sistema com texto `ATENDIMENTO <n>` (inseridas em `src/routes/api/public/whatsapp/webhook.ts`). Resultado: arquivos de atendimentos anteriores também são selecionados.

## Correção (somente `src/routes/whatsapp.tsx`)
Na função `abrirUltimosArquivos()` (e no efeito que seleciona após trocar de conversa):

1. Buscar as mensagens da conversa mais recente **ordenadas por `data_hora` crescente**.
2. Localizar a **última mensagem de sistema** com `tipo === "sistema"` e texto no formato `ATENDIMENTO <n>` — ela marca o início do atendimento mais recente.
3. Selecionar **apenas os arquivos (mensagens com `arquivo_url`) posteriores a essa marca**.
4. Se não existir nenhuma marca de atendimento (conversa antiga), selecionar todos os arquivos da conversa (comportamento atual como fallback).

A lógica de qual conversa é a mais recente (maior `atendimento_numero`, desempate por `created_at`) **não muda**. Nome do botão, layout e demais funcionalidades (Baixar, Calculadora) permanecem iguais.

## Validação
- Typecheck e build.
- No preview: abrir a conversa do Eduardo (que tem ATENDIMENTO 48 e 49), clicar em **Últimos Arquivos** e confirmar que só os arquivos do ATENDIMENTO 49 ficam selecionados.
