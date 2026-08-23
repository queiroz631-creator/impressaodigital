# Corrigir credenciais da Z-API

## Contexto
O webhook estava configurado, mas o teste de envio devolveu **"Instance not found"**.
O usuário forneceu o endpoint completo de envio da Z-API:

```
https://api.z-api.io/instances/3F816FA44EEC429D5061328DB7AF658C/token/81EB90572C17146EB3A7408C/send-text
```

O código (`src/lib/zapi.server.ts`) monta a URL assim:
`{baseUrl}/instances/{instanceId}/token/{instanceToken}/{caminho}`

- **baseUrl** = `https://api.z-api.io` → já é o padrão no código, **não precisa alterar**.
- **instanceId** atual (salvo) está errado → deve ser `3F816FA44EEC429D5061328DB7AF658C`
- **instanceToken** atual (salvo) está errado → deve ser `81EB90572C17146EB3A7408C`

## Plano

1. Atualizar os segredos via formulário seguro (`update_secret`):
   - `ZAPI_INSTANCE_ID` → `3F816FA44EEC429D5061328DB7AF658C`
   - `ZAPI_INSTANCE_TOKEN` → `81EB90572C17146EB3A7408C`
   - `ZAPI_CLIENT_TOKEN` → manter o já configurado (não veio na URL; se o teste falhar com erro de Client-Token, pedir ao usuário).
   - `ZAPI_BASE_URL` → confirmar/definir como `https://api.z-api.io` (opcional, pois já é o padrão).
2. Testar a conexão chamando o endpoint `send-text` (ou `status`) via `curl`/função de teste, enviando uma mensagem de verificação para o número conectado.
3. Confirmar o resultado (sucesso ou novo erro) e ajustar se necessário.

## Observações
- Nenhuma alteração de código-fonte é necessária — `src/lib/zapi.server.ts` já usa `https://api.z-api.io` como padrão e constrói a URL corretamente.
- O `Client-Token` (cabeçalho `Client-Token`) é separado do `instanceToken` (path); se faltar, o teste indicará.
