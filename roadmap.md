# Roadmap

## Em andamento: Deploy em VPS Hostinger
- [x] `deploy/setup-vps.sh` — instalação inicial da VPS
- [x] `deploy/deploy.sh` — script de atualização/publicação
- [x] `deploy/nginx.conf` — proxy reverso (app + Supabase)
- [x] `deploy/ecosystem.config.cjs` — configuração PM2
- [x] `deploy/.env.example` — variáveis necessárias
- [x] `deploy/README.md` — passo a passo em português
- [x] `deploy/aplicar-migracoes.sh` + `deploy/migrations-baseline.txt` — migrações
      automáticas do banco no deploy (baseline sem reaplicar as antigas)

## Etapa 2 — Usuários, Perfis e Permissões (concluída)
- [x] `descricao` em perfis_acesso, chaves padronizadas, perfis Administrador/Atendente/Financeiro
- [x] Gatilho `profiles_bloquear_escalada` (só administrador muda perfil/situação/conexão)
- [x] `usePermissoes` ligado ao banco; menu filtrado por permissão
- [x] Proteção centralizada de página via `AppLayout permissao="..."`
- [x] Página `/usuarios` com abas Usuários e Perfis
- [ ] Testar com um segundo usuário (Atendente) — pendente, sem criar usuário automaticamente

## Etapa 3 — Múltiplas conexões de WhatsApp (concluída)
- [x] Conexão inicial renomeada para "Impressão Digital" (histórico preservado)
- [x] Isolamento no banco: administrador OU conexão do usuário; sem vínculo, sem acesso
- [x] Página `/conexoes` (só administrador): criar, editar, testar, reconfigurar webhook, copiar, excluir
- [x] Webhook por conexão (`/api/public/whatsapp/webhook/<token>`); endereço antigo continua válido
- [x] Envio sempre pela conexão da conversa (texto, arquivo, mensagem rápida, currículo, orçamento)
- [x] Bot, fila, inatividade e status por conexão; um único cron de cada rotina
- [x] Seletor de conexão no WhatsApp e na Configuração do Bot; vínculo do atendente na tela Usuários
- [ ] Colar as credenciais da Z-API da Impressão Digital na tela Conexões (hoje usa as variáveis do servidor)
- [ ] Reconfigurar o webhook da conexão atual quando quiser migrar para o novo endereço

## Correção — Configuração do Bot por conexão
- [x] Isolar todas as abas e simuladores pela conexão selecionada
- [x] Validar no servidor todo acesso e alteração pela conexão autorizada
- [x] Reforçar RLS das tabelas do bot por conexão
- [x] Mostrar a cor cadastrada no seletor de conexão
- [ ] Validar administrador, atendente, telas e compilação
