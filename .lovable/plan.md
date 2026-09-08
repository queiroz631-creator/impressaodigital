# Ajuste no plano de deploy — .gitignore e variáveis de ambiente

## Contexto
O `.gitignore` do projeto deve proteger arquivos `.env` reais, mas permitir que `deploy/.env.example` continue versionado como template. Essa configuração já foi declarada pelo usuário e o plano de deploy será ajustado para deixar isso explícito.

## O que será feito

1. **Garantir regras no `.gitignore`**
   - Adicionar (ou confirmar) o bloco:
     ```text
     # Variáveis de ambiente
     .env
     .env.*
     !.env.example
     ```
   - Isso ignora `.env` e `.env.production`, mas mantém `deploy/.env.example` no repositório.

2. **Atualizar `deploy/README.md`**
   - Deixar claro que `deploy/.env.example` é um template versionado.
   - Instruir a cópia para `.env` na VPS antes do primeiro deploy:
     ```bash
     cp deploy/.env.example deploy/.env
     # editar deploy/.env com os valores reais
     ```
   - Alertar que `.env` nunca deve ser commitado.

3. **Atualizar `deploy/deploy.sh`**
   - Adicionar uma checagem que aborta (ou avisa) se `deploy/.env` não existir.
   - Exibir mensagem lembrando que credenciais reais ficam apenas na VPS, não no Git.

4. **Validar no fim**
   - Typecheck e build continuam OK.
   - Confirmar que `deploy/.env.example` aparece no git e que `.env` continua ignorado.

## Fora de escopo
- Não alterar a estrutura de deploy, scripts de setup, Nginx, PM2 ou Supabase.
- Não mover senhas reais para o repositório.
