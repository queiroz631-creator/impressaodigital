# Criação de clientes novos no Lojamix (somente API local)

Objetivo: quando o cliente vem do sistema sem ligação com a loja, encontrar pelo CPF ou criar de verdade o cadastro no Lojamix (entidade + pessoa física) usando os padrões confirmados no próprio Lojamix, e só então gravar a ligação.

Nada do site, das notas, da validação, dos cupons ou do saldo é alterado.

## O que muda

1. **Criação da pessoa física completa** — hoje a criação grava apenas ligação, CPF e data de nascimento. Passa a gravar também os valores confirmados no cadastro feito pela tela do Lojamix: sexo 1, indicador de inscrição 9, RG, inscrição, nome da mãe e nome do pai vazios.
2. **Data de nascimento** — usa a data real recebida do sistema; quando o sistema não tem data, usa 01/01/1900 (o mesmo que a tela do Lojamix grava). Nunca substitui uma data real.
3. **Criação da entidade** — continua gravando somente nome, e-mail, DDD e número do celular, deixando o Lojamix aplicar os padrões dele (data do cadastro, marcações de cliente, saldos, pontuação, telefone fixo, e-mail vazio etc.). Continua obrigatório devolver o identificador criado.
4. **Correção de uma falha real na criação** — a rotina de criação usa uma mensagem de erro que não está importada no arquivo; hoje, qualquer falha nesse caminho quebraria com erro interno em vez da mensagem correta. Será corrigido.
5. **Confirmação da pessoa física antes de concluir** — depois de gravar a pessoa física, a rotina confere que a linha foi realmente criada. Sem confirmação, desfaz tudo (nada de entidade órfã) e o cliente fica para a próxima tentativa, sem ligação e sem avanço de marcador.
6. **Simulação** — permanece ligada por padrão: consulta o CPF, informa que vincularia/atualizaria ou que criaria, e não grava nada na loja.

## Sequência de resolução (mantida)

```text
tem ligação (origem_id)?  -> atualiza nome/e-mail/telefone
nao -> existe CPF na loja? -> usa o id encontrado, atualiza contato, vincula
nao -> simulação ligada?   -> apenas conta como "simulado", nada é gravado
nao -> cria entidade + pessoa física em uma única transação, depois vincula
```

## Detalhes técnicos

Arquivos previstos:

- `api-local/app/sql_store.py` — SQL padrão de `cliente_criar_pessoa_fisica` passa a incluir `rg`, `ie`, `sexo`, `indicador_ie`, `nome_mae`, `nome_pai` com os valores confirmados como literais fixos (não são dados do cliente, portanto não viram parâmetros). Placeholders continuam `id_entidade`, `cpf`, `nascimento`, todos por parâmetro ODBC. `cliente_criar_entidade` fica como está (já usa `OUTPUT INSERTED.id_entidade` e é validada como gravação). Validações de gravação (sem DELETE/DROP/TRUNCATE/ALTER/CREATE, marcadores obrigatórios, obrigação de devolver o id) permanecem.
- `api-local/app/repositories/clientes_repo.py` — importar `ErroBanco` de `app.database`; em `criar(...)`, aplicar o padrão `1900-01-01` quando `nascimento` vier vazio; após o INSERT da pessoa física, validar `cursor.rowcount`/leitura de confirmação antes do `commit`; manter uma única conexão/cursor para os dois INSERTs, `rollback` completo em qualquer falha, e id inválido (≤ 0 ou ausente) tratado como erro.
- `api-local/app/services/clientes.py` — sem mudança de regra; apenas garantir que a criação só conta como `criados` após a vinculação no sistema e que falha na vinculação não gera novo cadastro no próximo ciclo (a próxima tentativa reencontra pelo CPF).

Inalterado: elegibilidade (pessoa física, CPF válido, telefone válido, participação em sorteio ativo, sem ligação), `enviar_pendentes_para_loja()` com varredura circular por `ultimo_id_cliente_pendente`, botão de reprocessar (zera apenas os quatro marcadores de clientes), contadores do relatório, normalização (CAIXA ALTA, sem acentos, CPF/telefone só dígitos), e todo o fluxo de notas (consultas, `ultimo_id_nota`, `ultimo_id_revisado`, cancelamento, validação, cupons, saldo).

Verificação final: compilação/imports do programa Python e conferência de que nenhum arquivo do fluxo de notas foi tocado. Sem criação real de cliente enquanto a simulação estiver ligada; sem commit, push, deploy ou publicação.
