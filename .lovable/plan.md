# Configuração do LOJAMIX_SYNC_TOKEN (Etapa 6 — desenvolvimento)

Verificação feita no código e nas variáveis do ambiente:

- **Hoje as rotas da Etapa 6 NÃO usam `LOJAMIX_SYNC_TOKEN`.** Todas usam `tokenValido` (`src/lib/sorteios-sync-token.server.ts`), que compara com `webhook_token` da tabela `whatsapp_config`.
- **`LOJAMIX_SYNC_TOKEN` NÃO existe** nas variáveis do ambiente de desenvolvimento (só existem `LOVABLE_API_KEY` e os segredos da Z-API).
- Rotas protegidas por esse token hoje: `notas-lote`, `notas-confirmar`, `notas-situacao`, `clientes-receber`, `clientes-alteracoes`, `clientes-confirmar`, `sorteio-ativo` (em `src/routes/api/public/sorteios/sync/`) e `reconciliar` (em `src/routes/api/public/sorteios/`).
- `validar-notas` usa o `webhook_token` diretamente e só é chamada pela rotina agendada — não entra nesta alteração.

## O que será feito

1. **Criar o segredo `LOJAMIX_SYNC_TOKEN`** no ambiente (valor aleatório gerado pela plataforma, nunca exibido na conversa). Você copia o valor em **Configurações do projeto → Secrets** e cola no `.env` da API local (`SISTEMA_TOKEN=`).

2. **Alterar `src/lib/sorteios-sync-token.server.ts`**:
   - `tokenValido` passa a aceitar o `LOJAMIX_SYNC_TOKEN` (lido de `process.env` dentro da função) com a mesma comparação de tempo constante.
   - O `webhook_token` continua aceito **apenas como alternativa interna**, porque a rotina agendada de reconciliação (a cada 15 minutos, rodada dentro do banco) chama `reconciliar` com esse token e não tem acesso às variáveis de ambiente. A API local passa a usar somente o `LOJAMIX_SYNC_TOKEN` — o `webhook_token` deixa de ser o segredo da sincronização.
   - Nenhum token é registrado em log nem devolvido em resposta.

3. **Nenhuma rota muda de endereço ou de lógica.** Todas as 8 rotas da Etapa 6, incluindo `POST /api/public/sorteios/sync/sorteio-ativo`, passam a aceitar o `LOJAMIX_SYNC_TOKEN` automaticamente por usarem o mesmo `tokenValido`.

4. **API local:** sem alteração de código — o valor novo vai em `SISTEMA_TOKEN` no `.env` da loja.

## Fora do escopo

- Sem deploy na VPS, sem commit/push/publicação.
- Sem alterar WhatsApp, Z-API, regras do sorteio ou a lógica de sincronização.
- Sem exibir o valor do token em nenhuma resposta.
