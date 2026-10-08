# CONTEXT.md

## Contexto
- Projeto: Impressao Digital TanStack Start
- Objetivo: rodar localmente sem alterar o codigo do aplicativo
- Data: 07/10/2026

## Feito
- `npm install` executado
- Variaveis de ambiente copiadas de `D:\Python\impressaodigital-main\.env` para `.env` na raiz do projeto
- `.env.example` criado como backup do `.env` original
- Ajustes pontuais em `.env`: `SITE_URL` para `http://localhost:3000` e cabecalho trocado para execucao local
- Servidor de desenvolvimento iniciado com `npm run dev -- --host --port 3000`
- VITE iniciou na porta 3001 porque 3000 estava em uso

## Observacoes
- Nao foram alterados arquivos de codigo do projeto
- Supabase URL local: `http://127.0.0.1:54321`

## Regras
- Antes de executar qualquer comando que modifique o sistema (instalar/desinstalar pacotes, alterar arquivos, matar processos, limpar cache, etc.), mostrar o plano ao usuario e solicitar autorizacao antes de executar.

## Diagnostico 07/10/2026 (spinner infinito)
- Sintoma: pagina travada no spinner de `AppLayout` em `localhost:3000`, em qualquer navegador
- Causa raiz: pacote `pdf-lib` corrompido em `node_modules` (faltavam `cjs/utils`, `es/`) -> `vite optimize` falhava com `UNRESOLVED_IMPORT ... ./utils/index` e nao gerava `node_modules/.vite/deps` -> requisicoes de modulos client travavam -> React nao hidratava
- Correcao: reinstalar `pdf-lib@1.17.1`, apagar `node_modules\.vite` e `.vite-temp`, reiniciar `npm run dev -- --host --port 3000`
- Futuro: se o spinner voltar, verificar `node_modules\.vite\deps` tem arquivos e rodar `npx vite optimize --force`
