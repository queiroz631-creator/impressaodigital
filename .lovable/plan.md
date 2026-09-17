# Por que os participantes continuam como "Pendente"

## Diagnóstico (confirmado no banco)

Os 7 participantes do sorteio ativo **já estão ligados ao cadastro da loja** (todos com identificador de origem: 78, 25, 75, 74, 26, 76, 77) e a fila de sincronização de clientes está toda como SINCRONIZADO.

A coluna "Sincronização" da tela de participantes lê o campo `sorteio_participantes.sincronizacao_status`. Esse campo foi criado com valor inicial "PENDENTE" e **nenhum ponto do sistema o atualiza** — não existe nenhuma escrita nesse campo em todo o código. Por isso ele fica "Pendente" para sempre, mesmo com a ligação feita.

Ou seja: não é falha de sincronização, é um indicador que nunca é atualizado.

## Correção

Ao concluir a ligação do cliente com o cadastro da loja (`vincularOrigemCliente` em `src/lib/sorteios-sync.server.ts`), marcar os participantes desse cliente como sincronizados:

- `sincronizacao_status = 'SINCRONIZADO'` e `sincronizado_em = agora` em `sorteio_participantes` onde `cliente_id` for o cliente vinculado e o status ainda não for SINCRONIZADO.
- Também quando o cliente já estava vinculado (caso em que a função retorna "vinculado" sem alterar nada hoje), para regularizar os registros existentes.
- Falha ao atualizar o indicador nunca desfaz a ligação: a ligação é o dado oficial e permanente; o indicador é informativo.

Além disso, uma atualização única dos participantes cujo cliente já possui ligação com a loja, para os 7 registros atuais deixarem de aparecer como "Pendente".

## Fora do escopo

Nada de elegibilidade, notas, validação, cupons, saldo, cursores, fila, rotas ou programa da loja. Nenhuma mudança de estrutura no banco. Sem commit, envio ou publicação.
