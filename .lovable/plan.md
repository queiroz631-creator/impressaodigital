# Deploy do projeto em VPS Hostinger (com GitHub já conectado)

## Pré-requisitos assumidos
- Repositório GitHub sincronizado com o Lovable.
- VPS Hostinger com acesso SSH e usuário root/sudo.
- Domínio apontado para o IP da VPS (opcional, mas recomendado).

## Passos

### 1. Preparar a VPS
- Conectar via SSH à VPS.
- Instalar Node.js 20 LTS (ou 22) e gerenciador de pacotes (npm ou bun).
- Instalar Git e PM2 (opcional, mas recomendado para manter o app rodando).
- Instalar Nginx ou Caddy como proxy reverso.

### 2. Clonar o repositório
- Clonar o repo do GitHub na VPS (ex.: `/var/www/impressaodigital`).
- Garantir que a branch correta está ativa (normalmente `main`).

### 3. Instalar dependências e fazer o build
- Rodar `npm install` ou `bun install`.
- Rodar `npm run build` para gerar a versão de produção.
- Verificar se há variáveis de ambiente necessárias para o build.

### 4. Configurar variáveis de ambiente
- Copiar `.env.example` para `.env` (ou criar manualmente).
- Preencher:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (se houver funções do servidor)
  - Outras chaves opcionais: Z-API, PIX, etc.
- O banco continuará sendo o Lovable Cloud/Supabase; a VPS não hospedará o banco.

### 5. Iniciar o app com PM2
- Criar um arquivo `ecosystem.config.cjs` ou rodar PM2 diretamente.
- Exemplo de comando: `pm2 start npm --name "impressaodigital" -- run start`.
- Configurar PM2 para iniciar automaticamente com o sistema (`pm2 startup && pm2 save`).

### 6. Configurar proxy reverso
- Com Nginx: criar um server block apontando para `localhost:3000` (ou a porta que o app usar).
- Com Caddy: Caddyfile com reverse_proxy para a porta do app e SSL automático.
- Habilitar SSL (Let's Encrypt via Certbot ou Caddy automático).

### 7. Configurar DNS e firewall
- Apontar domínio/subdomínio para o IP da VPS.
- Liberar portas 80, 443 e a porta do app (se necessário) no firewall da Hostinger/UFW.

### 8. Verificar deploy
- Acessar o domínio configurado.
- Testar login, orçamento, currículo e WhatsApp (se usar Z-API).
- Verificar logs com `pm2 logs` e ajustar conforme necessário.

## Entregáveis sugeridos
- Script de setup automatizado para VPS (opcional).
- Arquivos de configuração: `ecosystem.config.cjs`, `nginx.conf` ou `Caddyfile`.
- Checklist final de validação.

## Dúvidas para o usuário
1. Qual gerenciador de pacotes prefere usar na VPS: `npm` ou `bun`?
2. Qual servidor web prefere: `Nginx` ou `Caddy`?
3. Já possui um domínio próprio apontado para a VPS?
4. Quer que eu gere um script de deploy automatizado, ou prefere comandos passo a passo?
