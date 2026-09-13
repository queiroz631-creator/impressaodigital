# Acesso sem confirmação de e-mail

## Objetivo
Quem cria uma conta entra direto no sistema, sem precisar clicar no link enviado por e-mail.

## O que muda
- Ativar a confirmação automática de e-mail no cadastro: a conta já nasce confirmada e a sessão é criada na hora.
- Na tela de acesso (`/auth`), o cadastro passa a levar o usuário direto para o painel, já autenticado — sem mensagem de "verifique seu e-mail".

## O que não muda
- Login por e-mail e senha continua igual.
- Usuários já existentes continuam funcionando normalmente.
- Perfis, permissões, menu, WhatsApp, orçamentos e preços não são alterados.

## Ponto de atenção
Com a confirmação desativada, qualquer e-mail digitado é aceito sem validação (inclusive inexistente). Como o cadastro é usado apenas internamente, isso é aceitável; se preferir, depois podemos desativar o cadastro público e criar usuários só pela página Usuários.

## Detalhes técnicos
- Chamar `configure_auth` com `auto_confirm_email: true` (mantendo as demais opções atuais).
- Ajuste pequeno em `src/routes/auth.tsx`: mensagem de sucesso do cadastro e navegação imediata para `/`, sem `emailRedirectTo` obrigatório.
- Sem migração de banco, sem alteração de RLS.
