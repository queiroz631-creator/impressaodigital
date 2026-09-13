# Etapa 2 — Usuários, Perfis e Permissões

## O que já existe hoje (verificado no banco)

- Tabela `perfis_acesso` já existe, com `nome`, `permissoes` (lista JSON), `ativo`, datas e gatilho de atualização.
- Já existem 2 perfis: **Administrador** (todas as permissões) e **Atendente**. Falta **Financeiro**.
- `profiles` já tem `perfil_id` (ligado a perfis) e `ativo`. Também já tem `conexao_id`, criada antes — não será usada nesta etapa.
- A função de verificação `tem_permissao` já existe: administrador vê tudo; senão confere a chave no perfil, exigindo usuário ativo e perfil ativo.
- `user_roles` continua sendo a fonte de verdade do administrador (nada muda).
- As chaves gravadas nos perfis hoje são curtas (`calculadora`, `precos`, `alterar_precos`), enquanto o catálogo de módulos usa `calculadora.visualizar`. Isso precisa ser unificado.
- Ponto de segurança encontrado: a regra atual de `profiles` permite o próprio usuário atualizar sua linha inteira — inclusive perfil e ativo/inativo. Precisa ser bloqueado.
- A tela Usuários ainda não existe, e o menu ainda usa a regra provisória (tudo liberado, exceto Configurar Preços).

## O que será feito

### 1. Banco (uma migração nova, sem apagar nada)

- Adicionar `descricao` em `perfis_acesso` (texto opcional).
- Criar o perfil **Financeiro** só se ainda não existir, e garantir que **Administrador** tenha todas as chaves. Nada é duplicado se rodar de novo.
- Converter as chaves dos perfis existentes para o padrão do catálogo (`calculadora` → `calculadora.visualizar`, `alterar_precos` → `precos.alterar`, etc.), mantendo as permissões que cada perfil já tinha.
- Garantir que o administrador atual fique com o perfil Administrador e ativo.
- Bloquear escalada de privilégio: um gatilho impede que alguém que não seja administrador altere o próprio perfil ou o próprio ativo/inativo (pode continuar ajustando nome). Regras de leitura e de administração permanecem.
- Índices em `profiles.perfil_id` e no nome do perfil.

Comportamento seguro para usuário sem perfil: nenhum acesso além do Painel — só o administrador (por `user_roles`) escapa dessa regra. Isso ficará documentado no código.

### 2. Chaves de permissão

Todas derivadas de `src/lib/modulos.ts`, sem lista paralela. O catálogo ganha:

- chave do grupo (`modulo.operacao`, `modulo.comunicacao`, `modulo.marketing`, `modulo.administracao`) — já existe;
- um bloco de permissões sensíveis: `pedido.excluir`, `precos.alterar`, `conexoes.gerenciar`, `usuarios.gerenciar`;
- item **Usuários** ativado, apontando para a nova página.

### 3. Permissões no aplicativo

- `usePermissoes` passa a carregar, uma vez por sessão, se o usuário é administrador, se está ativo e quais chaves o perfil concede (respeitando perfil inativo). Mesma assinatura de hoje (`pode`, `isAdmin`), então o menu não muda de forma.
- O menu lateral continua idêntico no visual e com os grupos recolhíveis; só passa a esconder o que o usuário não pode ver.

### 4. Proteção de acesso direto por URL

Um único componente de proteção envolvendo o conteúdo dentro do `AppLayout`: cada página informa a chave que exige e, sem permissão, aparece uma tela de "Acesso negado" com botão para o Painel. Sem duplicar lógica página por página. Usuário inativo recebe a mesma tela em qualquer página protegida.

### 5. Nova página Usuários (`/usuarios`), só para administrador

**Aba Usuários:** nome, e-mail, perfil, situação (ATIVO/INATIVO) e ações — trocar o perfil e ativar/desativar. Sem qualquer exclusão. Sem vínculo com conexão de WhatsApp.

**Aba Perfis:** lista dos perfis com criar, editar, ativar/desativar. Na edição, as permissões aparecem agrupadas por módulo (Operação, Comunicação, Marketing, Administração) mais o bloco Permissões sensíveis, com caixas de seleção geradas a partir do catálogo.

## Detalhes técnicos

- Migração nova em `supabase/migrations/`, idempotente (`if not exists`, `insert ... where not exists`, `update` por mapa de chaves). Nada destrutivo; migrações antigas intactas.
- Gatilho `profiles_bloquear_escalada` (BEFORE UPDATE, security definer) barra mudança de `perfil_id`/`ativo` por não administrador; `profiles_update_own` continua para o próprio nome.
- Novos arquivos: `src/routes/usuarios.tsx`, `src/components/usuarios/UsuariosPainel.tsx`, `src/components/usuarios/PerfisPainel.tsx`, `src/components/PermissaoGuard.tsx`.
- Modificados: `src/lib/modulos.ts` (permissões sensíveis + item Usuários ativo), `src/hooks/usePermissoes.ts` (consulta real), `src/components/AppLayout.tsx` (apenas aceitar a chave da página e envolver o conteúdo no guard), e cada rota passa a declarar sua chave — uma linha por rota, sem tocar em regra de negócio.
- Sem alterações em WhatsApp, Z-API, Gemini, Storage, calculadora, orçamentos, clientes, currículos, preços (além do controle de acesso), `.env` ou segredos.
- Ao final: typecheck, lint e build; testes no preview como administrador; nenhum commit ou push.

## Ponto a confirmar antes da próxima etapa

Para testar de verdade um Atendente é preciso um segundo usuário. Posso validar administrador e as regras do banco; se você quiser, crio um usuário de teste e faço a verificação completa do menu restrito e do bloqueio por URL.
