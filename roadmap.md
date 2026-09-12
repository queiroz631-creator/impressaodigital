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
