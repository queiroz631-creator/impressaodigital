# Corrigir o `npm ci` do deploy na VPS

## O que aconteceu
- As 13 migrações foram aplicadas com sucesso (inclusive `configuracao_ia`).
- O deploy parou na etapa "Instalando dependências": o `deploy/deploy.sh` roda `npm ci` quando existe `package-lock.json`.
- Na VPS existe um `package-lock.json` antigo (sobra de versões passadas) que não corresponde ao `package.json` atual: faltam `jszip`, `drizzle-kit`, `drizzle-orm`, `postgres` e a versão nova do `@lovable.dev/vite-tanstack-config`.
- No repositório atual não há `package-lock.json` (só `bun.lock`), então o arquivo da VPS é um resto antigo.

## Correção
1. Gerar um `package-lock.json` novo e sincronizado com o `package.json` atual (`npm install --package-lock-only`), e deixar o arquivo versionado no projeto.
2. Garantir que o `npm ci` passa com esse lock (`npm ci --dry-run` ou validação equivalente).
3. Na VPS, o usuário remove o lock antigo antes de atualizar, ou o pull já traz o lock novo por cima:
   - `cd /var/www/impressaodigital`
   - `git pull` (traz o `package-lock.json` novo)
   - `bash deploy/deploy.sh`
4. Deploy deve então concluir: migrações (já aplicadas, serão puladas) → `npm ci` → build → PM2.

## Observações
- Manter `deploy.sh` como está (a lógica `npm ci` quando há lock é boa e reproduzível).
- Sem alterar código do sistema, sem publish no Lovable.
