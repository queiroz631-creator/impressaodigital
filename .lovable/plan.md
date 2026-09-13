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

Regras de acesso (Painel sempre liberado, sem permissão obrigatória nesta etapa):

- Administrador (`user_roles`) → acesso total, mesmo que o perfil divirja.
- Usuário ativo sem perfil → Painel permitido; demais páginas bloqueadas.
- Usuário ativo com perfil → Painel + o que o perfil permitir.
- Usuário inativo → páginas protegidas bloqueadas.

### 2. Chaves de permissão

Todas derivadas de `src/lib/modulos.ts`, sem lista paralela. O catálogo ganha:

- chave do grupo (`modulo.operacao`, `modulo.comunicacao`, `modulo.marketing`, `modulo.administracao`) — já existe;
- um bloco de permissões sensíveis: `pedido.excluir`, `precos.alterar`, `conexoes.gerenciar`, `usuarios.gerenciar`;
- item **Usuários** ativado, apontando para a nova página.

### 3. Permissões no aplicativo

- `usePermissoes` consulta o banco (administrador, usuário ativo, perfil e suas chaves) com cache curto em memória, revalidado quando a sessão/usuário carrega de novo e após qualquer alteração de perfis ou usuários. Nada é guardado no navegador de forma manipulável. Mesma assinatura de hoje (`pode`, `isAdmin`), então o menu não muda de forma.
- O menu lateral continua idêntico no visual e com os grupos recolhíveis; só passa a esconder o que o usuário não pode ver.

### 4. Proteção de acesso direto por URL

Um único componente de proteção envolvendo o conteúdo dentro do `AppLayout`: cada página informa a chave que exige e, sem permissão, aparece uma tela de "Acesso negado" com botão para o Painel. Sem duplicar lógica página por página. Usuário inativo recebe a mesma tela em qualquer página protegida. O Painel não exige permissão.

### 4b. Segurança no banco (não só na tela)

Trocar perfil de usuário, ativar/desativar usuário, criar/editar/desativar perfil e alterar permissões de perfil só funcionam para administrador confirmado no banco. Esconder botões é apenas conveniência: quem tentar pela API direta recebe erro. As regras atuais de administrador já cobrem isso e serão mantidas; o gatilho fecha a brecha da atualização da própria linha.

### 5. Nova página Usuários (`/usuarios`), só para administrador

**Aba Usuários:** nome, e-mail, perfil, situação (ATIVO/INATIVO) e ações — trocar o perfil e ativar/desativar. Sem qualquer exclusão. Sem vínculo com conexão de WhatsApp.

**Aba Perfis:** lista dos perfis com criar, editar, ativar/desativar. Na edição, as permissões aparecem agrupadas por módulo (Operação, Comunicação, Marketing, Administração) mais o bloco Permissões sensíveis, com caixas de seleção geradas a partir do catálogo.

## Detalhes técnicos

- Migração nova em `supabase/migrations/`, idempotente (`if not exists`, `insert ... where not exists`, `update` por mapa de chaves). Nada destrutivo; migrações antigas intactas. Antes de aplicar, conferência da estrutura e das regras atuais: nenhuma regra existente ainda necessária será apagada ou recriada sem motivo.
- Gatilho `profiles_bloquear_escalada` (BEFORE UPDATE, security definer) barra mudança de `perfil_id`/`ativo` por não administrador; `profiles_update_own` continua para o próprio nome.
- `tem_permissao` já existe e será mantida (administrador por `user_roles` sempre verdadeiro; senão a chave no perfil, exigindo usuário e perfil ativos); ajuste apenas se as chaves novas exigirem.
- Novos arquivos: `src/routes/usuarios.tsx`, `src/components/usuarios/UsuariosPainel.tsx`, `src/components/usuarios/PerfisPainel.tsx`, `src/components/PermissaoGuard.tsx`.
- Modificados: `src/lib/modulos.ts` (permissões sensíveis + item Usuários ativo), `src/hooks/usePermissoes.ts` (consulta real), `src/components/AppLayout.tsx` (apenas aceitar a chave da página e envolver o conteúdo no guard), e cada rota passa a declarar sua chave — uma linha por rota, sem tocar em regra de negócio.
- Sem alterações em WhatsApp, Z-API, Gemini, Storage, calculadora, orçamentos, clientes, currículos, preços (além do controle de acesso), `.env` ou segredos.
- Ao final: typecheck, lint e build; validação no preview com o administrador atual; nenhum commit ou push.

## Teste com segundo usuário

Nenhum usuário novo será criado nesta etapa. A validação será feita com o administrador atual e com as regras do banco; o teste de Atendente fica para um passo separado, quando você quiser.
