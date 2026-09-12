# IA compatível com a VPS (Google Gemini via GEMINI_API_KEY)

## Objetivo

Hoje toda a IA do sistema chama `ai.gateway.lovable.dev` com `LOVABLE_API_KEY`, que só funciona no Lovable Cloud — na VPS a importação de currículo, a transcrição de áudio e a interpretação do bot falham. Criar suporte ao Google Gemini via `GEMINI_API_KEY`, mantendo compatibilidade total com o Lovable.

## Regras

- Se `GEMINI_API_KEY` existir → chamar diretamente a API do Google (`generativelanguage.googleapis.com`, modelo `gemini-2.5-flash`).
- Se não existir → comportamento atual, inalterado (gateway Lovable + `LOVABLE_API_KEY`).
- Sem alteração de banco de dados, layout ou regras de negócio.
- `GEMINI_API_KEY` somente no servidor, nunca no frontend.

## Alterações

1. **Novo `src/lib/ia-chave.server.ts`** — helper central server-side que suporta:
   - prompts de texto;
   - respostas JSON quando solicitadas;
   - transcrição de áudio (base64), mantendo OGG/Opus do WhatsApp e convertendo para o formato aceito pelo Gemini.
2. **`src/lib/curriculo-import.server.ts`** — trocar a chamada direta ao gateway pelo helper (mesmo prompt e mesma normalização do resultado).
3. **`src/lib/ia.server.ts`** — idem nas 3 funções de interpretação do bot (opção, SIM/NÃO, quantidade).
4. **`src/lib/whatsapp.functions.ts`** — idem na transcrição de áudio (mensagens de erro por status preservadas).
5. **`deploy/.env.example` e `deploy/README.md`** — documentar `GEMINI_API_KEY=<sua-chave>` e como gerá-la no Google AI Studio.

## Verificação final

- Revisar todos os pontos que usam `ai.gateway.lovable.dev` / `LOVABLE_API_KEY` ligados à IA e confirmar a migração para o helper.
- Build + correção de erros TypeScript.
- Testar no Lovable (sem `GEMINI_API_KEY`): interpretação de currículo, interpretação do bot e transcrição de áudio devem continuar funcionando como antes.
