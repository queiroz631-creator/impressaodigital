# Corrigir IA na VPS (importação de currículo, transcrição e bot)

## Diagnóstico

O erro "Não foi possível interpretar o currículo agora" na VPS acontece porque toda a IA do sistema passa pelo gateway do Lovable (`ai.gateway.lovable.dev`) com a `LOVABLE_API_KEY`, que **só funciona dentro do ambiente Lovable**. Na VPS a chamada falha e a importação de currículo, a transcrição de áudio e a interpretação das respostas do bot param.

São 3 pontos afetados (todos com o mesmo padrão de chamada):
- `src/lib/curriculo-import.server.ts` — interpretar currículo (PDF/DOC/DOCX)
- `src/lib/whatsapp.functions.ts` — transcrever áudio do WhatsApp
- `src/lib/ia.server.ts` — interpretar respostas do cliente no bot (SIM/NÃO, opções, quantidades)

## Solução

Adicionar suporte a uma **chave própria do Google (Gemini)**, usada automaticamente quando existir. No Lovable nada muda (a chave nova não existirá aqui, então continua usando o gateway atual).

## O que será alterado

1. **Novo helper `src/lib/ia-chave.server.ts`** — centraliza a chamada de IA:
   - Se `GEMINI_API_KEY` estiver definida → chama direto a API do Google (`generativelanguage.googleapis.com`, modelo `gemini-2.5-flash`).
   - Senão → comportamento atual (gateway Lovable + `LOVABLE_API_KEY`).
   - Suporta texto puro (com/sem resposta JSON obrigatória) e entrada de áudio (base64).
2. **`src/lib/curriculo-import.server.ts`** — troca a chamada direta pelo helper (mesmo prompt, mesma normalização do resultado).
3. **`src/lib/ia.server.ts`** — idem para as 3 funções de interpretação do bot.
4. **`src/lib/whatsapp.functions.ts`** — idem para a transcrição de áudio (formato OGG/Opus convertido para o formato aceito pelo Gemini).
5. **`deploy/.env.example` e `deploy/README.md`** — documentar `GEMINI_API_KEY`: como gerar grátis no Google AI Studio (aistudio.google.com → Get API key) e onde colocar no `.env` da VPS.

## Passo a passo para você (depois da alteração)

1. Criar a chave grátis em https://aistudio.google.com (botão "Get API key").
2. Na VPS, adicionar no `.env`: `GEMINI_API_KEY=<sua-chave>`.
3. `pm2 reload impressaodigital` e testar a importação de currículo novamente.

## Garantias

- No ambiente Lovable o comportamento fica **idêntico** ao de hoje (a chave nova só é usada se existir).
- Nenhuma mudança de layout, banco de dados ou lógica do bot — apenas a camada de chamada da IA.
- O plano gratuito do Gemini atende folgadamente o volume de uma gráfica (importação de currículos, transcrições e interpretações do bot).
