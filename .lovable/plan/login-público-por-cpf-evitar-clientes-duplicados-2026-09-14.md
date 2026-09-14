# Login público por CPF + evitar clientes duplicados

Altera somente a entrada do portal público de Sorteios (CPF → telefone → cadastro). Termos, sessão, painel, notas, cupons, informações, administração e demais módulos ficam intactos.

## Como fica para o participante

**Tela 1 — CPF**
Digita o CPF, clica em Continuar. O servidor valida o CPF e procura o cadastro.

**Tela 2 — Telefone**
- Cadastro encontrado: mostra "Olá, João da Silva!", "Confirmamos que encontramos seu cadastro." e "Telefone cadastrado termina em: ****-1234". Pede o telefone completo.
- Cadastro não encontrado: apenas "Digite seu telefone:".

Nunca aparece CPF, telefone completo, dados de terceiros ou identificadores internos. Nada disso vai para o endereço da página.

**Depois do telefone**
- CPF encontrado e telefone confere: segue como hoje (completa dados faltantes, termos ou painel).
- CPF encontrado e telefone não confere: "Os dados informados não correspondem ao cadastro. Confira o CPF e o telefone."
- CPF não encontrado e telefone já pertence a um cadastro **sem CPF**: reaproveita esse cadastro, grava o CPF nele e pede só o que falta (nome e/ou nascimento). O cadastro original é preservado.
- CPF não encontrado e telefone já pertence a um cadastro **com outro CPF**: "Os dados informados não correspondem a um cadastro válido." Nada é alterado.
- CPF e telefone inexistentes: cadastro novo (nome + nascimento), como hoje.

## Detalhes técnicos

**`src/lib/sorteios-publico.functions.ts`**
- `iniciarAcessoPublico`: após validar CPF e sorteio, consulta `clientes` por CPF e retorna `{ sorteio, cadastro: { encontrado: boolean, nome?: string, telefone_final?: string } }`. `telefone_final` = 4 últimos dígitos de `telefone_normalizado`/`telefone`; nenhum id retornado.
- `verificarTelefonePublico`: quando não há cliente por CPF, passa a buscar por telefone normalizado antes de mandar para o cadastro:
  - achou sem CPF (`cpf IS NULL`) → nova etapa `vincular` (com `faltantes` calculados desse cliente) ou entrada direta quando nome e nascimento já existem, gravando o CPF nesse cliente;
  - achou com qualquer CPF não nulo (igual ou diferente) → `ErroPortal("DADOS_NAO_CONFEREM", "Os dados informados não correspondem a um cadastro válido.")`; nenhum CPF existente é alterado ou sobrescrito em nenhuma hipótese;
  - não achou → `{ etapa: "cadastro" }` como hoje.
- `concluirCadastroPublico`: mesma ordem de identificação (CPF → telefone normalizado → criar). No reaproveitamento, o CPF só é gravado quando o campo está nulo; nome/nascimento só quando vazios; `clientes.id`, telefone, e-mail e observações preservados. Auditoria `participanteCriado` só para cliente realmente novo; reaproveitamento registra evento de vínculo com CPF mascarado.
- Normalização de telefone reaproveita a lógica existente (`telefoneConfere` / normalização de dígitos), extraída como helper exportado em `sorteios-publico.server.ts` para busca por `telefone_normalizado`.

**Migração — adaptar a função transacional existente**
`public.sorteio_portal_criar_participacao` passa a receber a busca por telefone: dentro da mesma transação, procura por CPF, depois por `telefone_normalizado`; se achar cliente com `cpf IS NULL` preenche o CPF (`UPDATE ... WHERE id = _cliente_id AND cpf IS NULL`); se achar com qualquer CPF não nulo levanta exceção sem alterar nada; senão insere. Usa `pg_advisory_xact_lock` sobre o hash do telefone normalizado para que duas tentativas simultâneas não criem dois clientes. Sem novas tabelas, colunas ou alteração de RLS; sem migração dos clientes existentes.

**Telas**
- `src/routes/sorteios-publico.index.tsx`: guarda no fluxo da aba (sessionStorage) o resultado do CPF (`encontrado`, `nome`, `telefone_final`) apenas para exibição/continuidade visual — nada na URL.
- `src/routes/sorteios-publico.telefone.tsx`: exibe saudação com nome e "termina em ****-1234" quando encontrado; trata a etapa `vincular` mandando para a tela de cadastro apenas com os campos faltantes.
- `src/modules/sorteios/services/fluxo-publico.ts`: campos extras opcionais no tipo do fluxo.

**Autoridade do servidor**: nada guardado na aba (`encontrado`, `nome`, `telefone_final`, CPF, identificadores) é usado para identificar ou autorizar. A cada passo o servidor refaz a identificação a partir da sessão e dos dados enviados naquele passo; valores do navegador servem apenas de entrada a ser validada.

**Rate limit** e validações de CPF mantidos como estão.


## Verificação

Cenários A–J do pedido (CPF existente com/sem telefone correto, reaproveitamento sem CPF, bloqueio com outro CPF, cadastro novo, dados parciais, mesmo `clientes.id`, sem duplicidade, sem dados em URL), com dados de teste removidos no final. Depois: typecheck, lint e build. Sem commit, push ou deploy.
