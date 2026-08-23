# Botão "Link para novo currículo" (autoatendimento do cliente)

Objetivo: na tela **Currículo Vitae**, um botão gera um link que o cliente abre e **cria sozinho** um currículo novo — digitando ele mesmo nome, CPF e telefone, e depois preenchendo o restante pelo formulário. O link público continua sem as ações internas (editar, imprimir, PDF, WhatsApp).

Hoje não é possível porque todo link público exige um currículo já criado (`curriculo_links.curriculo_id` é `NOT NULL` e `curriculos.cpf` é `NOT NULL`/único). Precisamos de uma pequena mudança no banco.

## 1. Migração (banco)

Tornar `curriculo_links.curriculo_id` anulável, para permitir um link de "criação" sem currículo atrelado:

```sql
ALTER TABLE public.curriculo_links ALTER COLUMN curriculo_id DROP NOT NULL;
```

Sem novas tabelas, sem novas policies (a tabela já tem RLS e grants para `authenticated`/`service_role`). O `service_role` (usado pelas server functions) continua acessando normalmente.

## 2. Server functions (`src/lib/curriculo.functions.ts`)

- `gerarLinkNovoCurriculo` (POST, `requireSupabaseAuth`): insere uma linha em `curriculo_links` com `curriculo_id = NULL`, token novo, validade 24h. Retorna `{ url, expiraEm }`. Registra em `whatsapp_auditoria`.
- `criarCurriculoPublico` (POST, público): valida `{ token, nome, cpf, telefone }` com Zod + `cpfValido`. Verifica unicidade do CPF; se já existir, devolve erro amigável. Cria o `clientes` (se necessário) e o `curriculo` (status `rascunho`) e atualiza o link para apontar `curriculo_id` ao novo registro. Retorna os `DadosPublicos` para o formulário continuar.

## 3. Lógica de servidor (`src/lib/curriculo.server.ts`)

- `gerarLinkNovo()`: mesma lógica de `gerarLink`, mas com `curriculo_id` NULL.
- `carregarPublico(token)`: quando o link tiver `curriculo_id` NULL, retorna `{ novo: true, empresaNome, expiraEm }` (sem dados do currículo). Continua retornando os dados normais quando já houver `curriculo_id`.
- `criarPublico(token, { nome, cpf, telefone })`: cria cliente/currículo, valida CPF, atualiza o link e devolve `DadosPublicos`.

## 4. Página pública (`src/routes/curriculo.publico.$token.tsx`)

- Quando `data.novo === true`, exibe uma etapa de **identificação** (nome, CPF, telefone) com validação cliente + server.
- Ao confirmar, chama `criarCurriculoPublico`; em sucesso, carrega o `FormularioCurriculo` (modo `publico`) com os dados retornados e segue o fluxo existente.
- Em CPF duplicado, mostra o erro sem criar nada.

## 5. Tela Currículo Vitae (`src/routes/curriculos.index.tsx`)

- Novo botão **"Link para novo currículo"** no cabeçalho (ao lado de "Novo currículo").
- Ao clicar: chama `gerarLinkNovoCurriculo`, copia o link para a área de transferência e abre um diálogo com o link + validade (mesmo padrão do "Gerar link" do detalhe).

## Fora de escopo

- Sem alterar calculadora, pedidos, PDF, WhatsApp ou demais módulos.
- A tela de detalhe (`curriculos.$id.tsx`) mantém o botão "Gerar link" existente (que continua gerando link para o currículo em edição).
