# LOJAMIX_SYNC_TOKEN — autenticação separada do Lojamix Sync

Verificação feita no código e no ambiente:

- Hoje as rotas da Etapa 6 usam `tokenValido` (`src/lib/sorteios-sync-token.server.ts`), que compara com `webhook_token` da tabela `whatsapp_config`. **`LOJAMIX_SYNC_TOKEN` não existe** no ambiente (só `LOVABLE_API_KEY` e segredos Z-API).
- Rotas protegidas hoje por `tokenValido`: `notas-lote`, `notas-confirmar`, `notas-situacao`, `clientes-receber`, `clientes-alteracoes`, `clientes-confirmar`, `sorteio-ativo` (em `sync/`) e `reconciliar`.
- `validar-notas` usa `webhook_token` diretamente e só é chamada pela rotina agendada — **fica fora desta alteração**.

## Alteração aprovada: autenticações separadas, sem mistura

1. **Criar o segredo `LOJAMIX_SYNC_TOKEN`** no ambiente de desenvolvimento (valor aleatório gerado pela plataforma, nunca exibido). Você copia em **Configurações do projeto → Secrets** e cola em `SISTEMA_TOKEN=` no `.env` da API local.

2. **Nova função `tokenLojamixSyncValido`** em `src/lib/sorteios-sync-token.server.ts`:
   - lê exclusivamente `process.env.LOJAMIX_SYNC_TOKEN` (dentro da função);
   - rejeita se a variável não existir ou estiver vazia;
   - comparação em tempo constante;
   - nunca registra nem retorna o token;
   - **sem fallback para `webhook_token`**.
   - `tokenValido` (webhook_token) permanece inalterado para as rotinas internas.

3. **Rotas do Lojamix Sync passam a usar exclusivamente `tokenLojamixSyncValido`** (sem alterar endereços):
   - `POST /api/public/sorteios/sync/notas-lote`
   - `POST /api/public/sorteios/sync/notas-confirmar`
   - `POST /api/public/sorteios/sync/notas-situacao`
   - `POST /api/public/sorteios/sync/clientes-receber`
   - `POST /api/public/sorteios/sync/clientes-alteracoes`
   - `POST /api/public/sorteios/sync/clientes-confirmar`
   - `POST /api/public/sorteios/sync/sorteio-ativo`
   - `POST /api/public/sorteios/reconciliar`

4. **Rotina interna de reconciliação (cron, a cada 15 min):** hoje o agendamento chama `POST /api/public/sorteios/reconciliar` com `webhook_token` — com a separação, essa chamada deixaria de funcionar. Solução sem misturar autenticações:
   - nova rota interna `POST /api/public/sorteios/reconciliar-interno`, protegida pelo `tokenValido` existente (webhook_token), que executa a mesma função `reconciliar()`;
   - migration ajustando o agendamento para chamar `reconciliar-interno`;
   - a rota `/reconciliar` usada pelo Lojamix Sync exige exclusivamente `LOJAMIX_SYNC_TOKEN`.
   - Nenhum endereço existente é alterado; apenas uma rota interna nova é adicionada.

5. **API local:** sem alteração de código — o novo valor vai em `SISTEMA_TOKEN` no `.env` da loja.

## Fora do escopo

- Sem deploy na VPS, sem commit/push/publicação.
- Sem alterar WhatsApp, Z-API, `validar-notas`, regras do sorteio ou a lógica de sincronização.
- Valor do segredo nunca exibido em resposta, log ou código.

## Relatório final (após implementar)

Informar: rotas que usam `LOJAMIX_SYNC_TOKEN`; rotinas que continuam com `webhook_token`; confirmação de que o segredo está configurado; confirmação de que as regras de sincronização não mudaram.
