# Enviar clientes do sistema para o Lojamix (inclusive cadastros novos)

## O que está acontecendo hoje

- Só uma alteração de cliente entrou na fila do sistema para a loja (o cadastro feito no portal) e ela foi marcada como sincronizada.
- Mas nada mudou no Lojamix: o programa da loja só sabe **atualizar** quem já existe lá (procura pela ligação `origem_id`). Como o cadastro nasceu no portal, não tem ligação — o programa pula em silêncio e ainda avança o marcador.
- Os clientes antigos do sistema nunca entraram nessa fila (ela passou a existir depois), então também nunca foram enviados.

## Ponto que precisa da sua decisão antes de codar (cursor)

Você pediu paginação `id > ultimo_id_cliente_pendente` com `ORDER BY id ASC`. Na tabela de clientes do sistema o `id` **não é numérico, é um identificador aleatório (uuid)**. A comparação `>` e a ordenação funcionam, e são determinísticas, mas como o identificador é aleatório um cadastro novo pode "nascer" antes do ponto onde o marcador já está e ficar para trás.

Proposta (sem inventar outro cursor): manter exatamente `id > ultimo_id_cliente_pendente` + `ORDER BY id ASC` + limite, com o marcador guardando o maior `id` processado no lote, e **ao esgotar a lista o marcador volta ao início** — mesma varredura circular já usada na revisão de clientes. Assim nada fica preso para sempre. Nada será implementado nesse ponto até você confirmar.

## Elegibilidade (Sistema → Lojamix)

Só entram clientes que atendam **ao mesmo tempo**:

- pessoa física (CNPJ/pessoa jurídica segue fora);
- CPF com 11 dígitos e dígitos verificadores válidos;
- telefone com 10 dígitos ou mais;
- sem ligação com a loja (`origem_id` vazio);
- **com participação em pelo menos um sorteio ATIVO**.

Nota fiscal **não** é critério aqui. Ter só CPF e telefone **não** basta.

## Como o envio vai funcionar

```text
cliente do sistema
   |
   A. tem ligacao (origem_id)?  --sim-->  localiza pelo origem_id e ATUALIZA
   |                                       so nome, e-mail e telefone
   nao
   |
   B. existe no Lojamix com o mesmo CPF?  --sim-->  usa o id encontrado,
   |                                                atualiza contato e VINCULA
   nao
   |
   C. modo simulacao ligado?  --sim-->  nao grava nada, conta como "simulados"
   |                                     e continua disponivel para depois
   nao
   |
   D. CRIA em UMA transacao: entidade -> obtem id_entidade -> pessoa fisica
      (qualquer falha = rollback total, sem sucesso, sem vinculo, marcador
       nao avanca, tenta no proximo ciclo)
      |
      E. chama clientes-vincular no sistema (clienteId + origemId).
         Só depois disso o cliente conta como concluido.
```

Vinculação e anti-eco: a ligação é gravada como permanente e marcada como alteração vinda da LOJA, então ela não gera um novo envio de volta.

## Clientes antigos

Um passo novo de **envio pendente** no ciclo: pede ao sistema, em blocos, os clientes elegíveis (regras acima) e aplica o mesmo fluxo A–E. Marcador próprio `ultimo_id_cliente_pendente`, que avança só quando o bloco termina com sucesso e nunca toca nos marcadores de notas. O botão "Reprocessar clientes" passa a zerar também esse marcador (nunca `ultimo_id_nota` nem `ultimo_id_revisado`) e continua recusando quando um ciclo de clientes está rodando.

## Segurança da gravação no Lojamix

- As três novas instruções (procurar por CPF, criar entidade, criar pessoa física) ficam na tela de consultas configuráveis, com padrão pronto — você ajusta campos obrigatórios do seu Lojamix sem mexer no programa. Sempre com parâmetros, nunca com o texto colado dentro do SQL; comandos destrutivos são recusados; as duas de criação são classificadas como gravação.
- Criar entidade **tem que devolver** o identificador; se não devolver um identificador válido, é tratado como erro (não conta como criado).
- **Modo simulação** ligado na primeira instalação: consulta por CPF, mostra quem seria vinculado, atualizado ou criado, mas não cria nada. Você confere e desliga para valer.
- Nunca apaga cliente (nem na loja, nem no sistema); atualiza apenas nome, e-mail e telefone. Textos em CAIXA ALTA sem acentos; CPF e telefone só dígitos; CPF completo, token e senha nunca vão para log.

## Relatório do ciclo

Contadores: `criados`, `vinculados`, `atualizados`, `simulados`, `ignorados`, `erros`. Motivos de descarte visíveis: `semNome`, `semCpf`, `cpfInvalido`, `semTelefone` e o novo `semParticipacaoAtiva`. Cada cliente conta em um único motivo por processamento.

## Fora do escopo (fluxo de notas intacto)

Nada muda em: consultas de notas, `ultimo_id_nota`, `ultimo_id_revisado`, validação, cancelamentos, cupons, saldo, portal público. Notas continuam sincronizando mesmo sem cliente elegível e não passam a depender de CPF, telefone ou participação. Sem tabelas paralelas, sem dados fictícios, sem teste que crie ou altere cliente real no Lojamix, sem commit, push, deploy ou publicação. Verificação final: apenas compilação/estrutura.

## Onde cada mudança entra

Site (`src/`) — só o mínimo previsto, sem mudança de banco:
- `src/lib/sorteios-sync.server.ts`: `vincularOrigemCliente({ clienteId, origemId })` grava `origem_id` + `origem_alteracao='LOJA'`; `listarClientesSemOrigem({ desdeId, limite })` filtra `origem_id IS NULL`, CPF com 11 dígitos, telefone com 10+ dígitos e `EXISTS` de participação em sorteio com status ATIVO (`sorteio_participantes` × `sorteios`), com `id > desdeId ORDER BY id ASC LIMIT`.
- Novas rotas protegidas exclusivamente por `LOJAMIX_SYNC_TOKEN`: `POST /api/public/sorteios/sync/clientes-vincular` e `POST /api/public/sorteios/sync/clientes-pendentes-loja`.

Programa da loja (`api-local/`):
- `app/sql_store.py`: chaves `cliente_por_cpf` (select), `cliente_criar_entidade` e `cliente_criar_pessoa_fisica` (write, com `OUTPUT INSERTED.id_entidade`/`SCOPE_IDENTITY()`); validação de placeholders e bloqueio de comandos destrutivos; `WRITE_KEYS` atualizado.
- `app/repositories/clientes_repo.py`: `por_cpf(cpf)` e `criar(nome, cpf, telefone, email, nascimento) -> id_entidade` em transação única (commit só com id válido, senão rollback e erro).
- `app/services/clientes.py`: `aplicar_alteracoes` passa a resolver a ligação (origem_id → CPF → criar) e chamar a vinculação; novo `enviar_pendentes_para_loja()` com bloco e marcador; `reprocessar()` inclui o novo marcador; contadores e motivos no resumo.
- `app/services/sistema.py`: rotas `CLIENTES_VINCULAR` e `CLIENTES_PENDENTES`.
- `app/utils/estado.py`: `ultimo_id_cliente_pendente` (texto, pois é identificador aleatório) incluído em `MARCADORES_CLIENTES`.
- `app/schemas/sync.py`: `criados`, `vinculados`, `atualizados`, `simulados`, `ignorados`, `erros`, `semParticipacaoAtiva`.
- `app/settings_store.py`: `criar_cliente_no_lojamix`, `simulacao_criacao_cliente` (padrão ligado), `pendentes_bloco`.
- `app/worker.py`: passo de pendentes sob a mesma trava do fluxo de clientes.
- `app/routes/controle.py` e `gui/main.py`: disparo manual, opções de criação/simulação, contadores e as novas consultas na aba de SQL.
