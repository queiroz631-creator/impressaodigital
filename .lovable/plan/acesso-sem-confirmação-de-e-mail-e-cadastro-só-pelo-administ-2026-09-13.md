# Acesso sem confirmação de e-mail e cadastro só pelo administrador

## Objetivo
Ninguém cria conta sozinho. O administrador cria os usuários na página Usuários, e quem é criado já entra direto com e-mail e senha, sem link de confirmação.

## O que muda

### 1. Tela de acesso (/auth)
- Sai a aba "Criar conta". Fica somente "Entrar" com e-mail e senha.
- Texto de apoio informando que o acesso é criado pelo administrador.

### 2. Página Usuários
- Novo botão "Novo usuário" na aba Usuários, aberto só para administrador.
- Formulário com nome, e-mail, senha inicial e perfil de acesso.
- Ao salvar, a conta é criada já confirmada e ativa, com o perfil escolhido, e aparece na lista imediatamente.
- Erros claros: e-mail já usado, senha curta, sem permissão.

### 3. Confirmação de e-mail
- Contas nascem confirmadas: o usuário entra na primeira tentativa com a senha informada.
- Cadastro público desativado no próprio sistema de contas, então mesmo por fora ninguém consegue se registrar.

## O que não muda
- Login, sessão, perfis, permissões, menu recolhível, WhatsApp, orçamentos, currículos e preços seguem iguais.
- Nenhum usuário existente é alterado ou removido.

## Pontos de atenção
- Você define a senha inicial e passa ao atendente; recomendo pedir que ele troque depois. Recuperação de senha por e-mail não faz parte desta etapa.
- Nenhum usuário de teste será criado automaticamente.

## Detalhes técnicos
- `configure_auth`: `auto_confirm_email: true` e `disable_signup: true`.
- `src/routes/auth.tsx`: remover as abas e o formulário de cadastro (`signUp`), manter apenas `signInWithPassword`.
- Nova server function em `src/lib/usuarios.functions.ts`: valida com Zod, usa `requireSupabaseAuth`, confirma no banco que o chamador é administrador (`has_role`) e só então importa `supabaseAdmin` dentro do handler para `auth.admin.createUser({ email_confirm: true })`; em seguida grava nome, `perfil_id` e `ativo` em `profiles`. Cliente comum nunca recebe a chave privilegiada.
- `src/components/usuarios/UsuariosPainel.tsx`: diálogo de criação chamando a server function via `useServerFn` + mutation, invalidando `usuarios-lista` e `CHAVE_PERMISSOES`.
- Sem migração de banco e sem alteração de RLS.
- Ao final: typecheck, lint e build. Sem commit e sem push.
