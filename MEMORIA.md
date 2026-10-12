# MEMORIA.md

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

## Ambiente / Git (07/10/2026)
- Branch `desenvolvimento` criada a partir de `main` e publicada no GitHub
- `main` local atualizada com 24 commits do GitHub e merge feita em `desenvolvimento` sem conflitos
- Commit local: "contexto, env example sanitizado e ajustes de dev local"
- `.env.example` sanitizado: chaves reais (Z-API, Gemini, service_role, publishable) substituidas por placeholders; considerar rotacionar essas credenciais pois estavam expostas
- Recomendado: nunca commitar o `.env` real
- Ollama com modelo `qwen3` baixado; `ollama launch opencode --model qwen3` abre em nova janela via Start-Process
- Credencial do GitHub no Windows Credential Manager foi renovada para permitir push (opcao 1)

## Teste WhatsApp (07/10/2026)
- Supabase local sem conversas; conversa de teste criada: telefone `5573999990001`, nome `Cliente Teste Aleatorio`, id `ecb65247-4e7c-4aee-b361-cfd7e9f1228f`
- Mensagem de teste inserida em `whatsapp_mensagens` (saida, texto, enviada)
- RLS da tabela `whatsapp_conversas` exige admin OU `conexao_id` igual ao do perfil do usuario -> preenchido `profiles.conexao_id` do usuario `eduqueiroz` com a conexao "Impressao Digital" (`4c1d096d-...`), e a conversa de teste recebeu o mesmo `conexao_id`
- Status validos de conversa: `automatico|aguardando|em_atendimento|pendente|esperando_impressao|aguardando_finalizacao|finalizado` (a UI filtra por aba; status invalido nao aparece em nenhuma aba); teste usa `automatico`

## Atualizacao Git (10/10/2026)
- Atualizacao via `git fetch origin main:main` (nao troca de branch, preserva working tree) + `git merge main` em `desenvolvimento`
- `main` local: 00371be -> a2b4069; merge commit `7dc5887` criado **sem conflitos**
- 19 arquivos integrados (+593/-106): curriculos no atendimento do WhatsApp (`CurriculoClienteDialog`, `whatsapp-curriculo.functions`, curriculo-dados, testes), backup API movida `deploy/servidor-backup` -> `deploy/backup-api` (app.py, backup-api.service, backup-impressaodigital.sh, requirements.txt), ajustes na impressao do WhatsApp, orientacao da foto no FOTO EXPRESS (`transformacaoFoto.ts`), roadmap.md e AGENTS.md
- Branch `desenvolvimento` esta **68 commits a frente de `origin/desenvolvimento`** (nada foi publicado — deixado de proposito; para publicar: `git push origin desenvolvimento`)
- Mudancas locais preservadas: `CONTEXT.md` modificado e `supabase/.temp/` nao rastreado

## Diagnostico 10/10/2026 (login falhando)
- Sintoma: login em `localhost:3000` falha com `AuthRetryableFetchError: Failed to fetch` no console do Vite (falha de rede, nao de credenciais)
- Causa raiz: **portas 54321-54324 do Supabase caem na faixa de exclusao dinamica do Windows (Hyper-V/WSL)** — `netsh interface ipv4 show excludedportrange protocol=tcp` mostra reserva `54268-54367` (alem de `54368-54467`, `55232-55331`, etc.)
- Consequencia 1: containers do Supabase rodavam mas `.NetworkSettings.Ports` vazio (Docker Desktop nao publicava as portas) -> `127.0.0.1:54321` inacessivel
- Consequencia 2: ao recriar (`npx supabase stop` + `npx supabase start`), o container `supabase_db_*` falhou com erro 10013 (`ports are not available: ... bind: permissões de acesso`) na porta 54322; `supabase_vector_*` ficava em restart loop
- Na 1a tentativa o `supabase start` estourou timeout de 300s porque o CLI baixou imagens novas (realtime v2.140.10, postgres 17.11.0.004, studio 2026.10.05, etc.); rodar em background evita o corte
- Observacao: existe PostgreSQL nativo no Windows segurando a porta 5432 (nao conflita com o Supabase, que usa 54322 no host)
- URL e portas so aparecem em `.env`/`.env.example` e `CONTEXT.md` (nada hard-coded no codigo do app) — mover porta nao exige mudar codigo

## Correcao executada (11/10/2026) — portas do Supabase movidas (Opcao A)
- **Executado:** moveu as portas do Supabase para a faixa livre, adicionando ao `supabase/config.toml`:
  - `[api] port = 54521`, `[db] port = 54522`, `[studio] port = 54523`, `[inbucket] port = 54524`
- `.env` e `.env.example` atualizados: `SUPABASE_URL` e `VITE_SUPABASE_URL` → `http://127.0.0.1:54521`
- Chaves publishable/service_role **nao mudaram** — continuam identicas as ja presentes no `.env`
- Limpeza: `npx supabase stop` + remocao de 19 containers orfaos de tentativas quebradas antigas (dois stacks sobrepostos)
- `npx supabase start` rodou com sucesso em background (restaurou o banco do backup). URLs finais: API `54521`, DB `54522` (postgres), Studio `54523`, Mailpit/Inbucket `54524`
- Validacao: `GET /auth/v1/health` na 54521 → 200 (GoTrue v2.197.0); Studio 54523 → 200; pagina do app → 200 **sem `AuthRetryableFetchError`**; chamada ao endpoint de login devolve 400 (credenciais invalidas) em vez de falha de rede
- Servidor dev reiniciado para recarregar os envs (`npm run dev -- --host --port 3000`); Vite reinicia sozinho quando `.env` muda ("`.env changed, restarting server...`")
- Observacao 1: as faixas de exclusao dinamica do Windows mudam a cada boot — hoje nao existe faixa reservada cobrindo 54521-54524 (`netsh interface ipv4 show excludedportrange protocol=tcp`), mas convem re-checar no futuro
- Observacao 2: `npx supabase start` emite aviso de deprecacao: secao `[inbucket]` deve ser `[local_smtp]`. A porta configurada foi aceita, mas o config.toml ainda usa o nome antigo (pendente de ajuste)

## Plano anterior (10/10/2026) — substituido pela correcao acima
- **Opcao B (nao usada):** tentar liberar a faixa reiniciando Docker Desktop + WinNAT ou reboot — precisa de admin e nao e garantido (faixas dinamicas retornam a cada boot)
- O app usa a URL via environment: nenhum arquivo de codigo mudou
