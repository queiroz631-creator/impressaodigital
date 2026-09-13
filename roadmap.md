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
- [ ] Próxima etapa: múltiplas conexões de WhatsApp (não iniciada)
