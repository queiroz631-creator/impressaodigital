# Mensagem clara de "telefone já cadastrado" no portal do sorteio

## Objetivo

Hoje, quando a pessoa entra ou se cadastra no portal com um telefone que já pertence a outro cadastro, o portal responde com a mensagem genérica "Os dados informados não correspondem a um cadastro válido." — a pessoa não entende o motivo. A mudança: quando o telefone informado já estiver na base em nome de outro CPF, mostrar uma mensagem específica informando que o telefone já está cadastrado. A regra de telefone único não muda — continua bloqueado, só muda a explicação.

## Estado atual (verificado)

Três pontos em `src/lib/sorteios-publico.functions.ts` + helper em `src/lib/sorteios-publico.server.ts`:

1. **Entrar, CPF novo + telefone de outro cadastro** (`verificarTelefonePublico`, linha ~179): `garantirCpfLivre(porTelefone)` dispara `DADOS_NAO_CONFEREM` genérico.
2. **Entrar, CPF existente + telefone que não confere** (`verificarTelefonePublico`, linha ~215): dispara `DADOS_NAO_CONFEREM` genérico — mesmo quando o telefone digitado pertence a outro cadastro.
3. **Cadastro novo com telefone de outro cadastro** (`concluirCadastroPublico`, linha ~304): `garantirCpfLivre` genérico; e a função do banco `sorteio_portal_criar_participacao` dispara `CADASTRO_AMBIGUO`, que cai na mensagem genérica de erro.

O frontend do portal já exibe `mensagem` dos resultados com `ok: false` — basta o servidor enviar a mensagem certa com um código novo.

## Mudanças

### 1. Novo código de erro `TELEFONE_EM_USO`

- Mensagem: "Este telefone já está cadastrado por outra pessoa. Se o número é seu, procure a loja para atualizar seu cadastro." (sem revelar nome, CPF ou qualquer dado do outro cadastro).

### 2. Aplicar nos três pontos

- **CPF novo + telefone ocupado** (entrar): trocar o erro genérico de `garantirCpfLivre` pelo novo código/mensagem.
- **CPF existente + telefone não confere** (entrar): antes de responder o genérico, verificar se o telefone digitado pertence a outro cadastro (`buscarClientePorTelefone`); se pertencer a outra pessoa → `TELEFONE_EM_USO`; se não existir na base → mantém a mensagem genérica atual (não revela se o telefone é ou não do titular do CPF).
- **Cadastro novo + telefone ocupado**: `garantirCpfLivre` com o novo código; e mapear o erro `CADASTRO_AMBIGUO` da função do banco (caso de duas pessoas ao mesmo tempo) para a mesma mensagem, em vez do erro genérico.

### 3. Auditoria

- Registrar no detalhe da auditoria do portal, nesses casos, `motivo: "telefone_em_uso"` (sem dados do outro cadastro), reaproveitando os eventos de auditoria já existentes.

### 4. Frontend

- Nenhuma alteração estrutural: a mensagem aparece no lugar onde os erros do portal já aparecem hoje. Verificar apenas que o texto longo quebra bem no celular.

### 5. Não alterar

- Regra de telefone único, função `sorteio_portal_criar_participacao` (continua disparando `CADASTRO_AMBIGUO`), restrição do banco, sincronização Lojamix, notas, cupons, saldo, apuração — nada disso é tocado.

## Verificação

- TypeScript (`bunx tsgo --noEmit`) e build sem erros.
- Teste manual no portal (base de desenvolvimento): tentar entrar/cadastrar com telefone já existente e conferir a nova mensagem nos três caminhos.

## Pontos de atenção

- A mensagem revela apenas que aquele número de telefone já tem cadastro — não revela nome nem CPF de ninguém. Era exatamente o pedido.
- Sem commit, push, deploy ou publicação.
