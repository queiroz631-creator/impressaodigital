# Clientes: tela completa + exclusão de currículo sem afetar o cliente

## 1. Excluir currículo não exclui cliente

Verificado no banco: a ligação atual é `curriculos.cliente_id → clientes`, sem exclusão em cascata para o cliente. Ao excluir um currículo, apenas o currículo e seus dados filhos (telefones, cursos, formações, experiências, habilidades e links) são removidos — o cliente permanece cadastrado.

Ajuste apenas no texto de confirmação da exclusão (em `curriculos/$id`), deixando explícito que **o cadastro do cliente será mantido**. Nenhuma outra lógica muda.

## 2. Nova tela "Clientes" (CRUD completo)

Novo item no menu lateral, entre Currículo Vitae e Histórico.

**Lista**
- Busca por nome, telefone ou e-mail.
- Colunas: Nome, Telefone, E-mail, Cadastrado em, Ações (Ver / Editar / Excluir).
- Paginação no mesmo padrão da lista de currículos.
- Botão "Novo Cliente".

**Cadastrar / Editar** (modal)
- Campos: Nome (obrigatório), Telefone, E-mail, Observação.
- Telefone salvo também no formato normalizado, como já é feito hoje no cadastro automático.

**Detalhes do cliente** (modal ou painel)
- Dados cadastrais.
- Currículos vinculados (com link para abrir o currículo).
- Orçamentos e pedidos vinculados, com número, data, valor e status.

**Excluir cliente**
- Confirmação obrigatória.
- Se o cliente tiver currículos, orçamentos ou pedidos vinculados, a exclusão é bloqueada com aviso explicando o motivo (evita quebrar registros existentes).

## Detalhes técnicos

- Nova rota `src/routes/clientes.tsx` usando `AppLayout`, `PageHeader`, Card/Table e Dialog, seguindo o padrão visual de `curriculos.index.tsx`.
- Leitura/escrita via cliente Supabase do navegador na tabela `clientes` (a política atual já permite acesso a usuários autenticados) — sem mudanças de banco de dados.
- Contagens de vínculo consultadas em `curriculos`, `orcamentos` e `pedidos` pelo `cliente_id`.
- Item de navegação adicionado em `src/components/AppLayout.tsx`.
- `head()` próprio na nova rota com título e descrição específicos.
- Nenhuma alteração em calculadora, preços, orçamentos, WhatsApp ou no restante do fluxo de currículos.
