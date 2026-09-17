# SQL atual de criação de cliente no Lojamix (somente informativo)

Nenhuma alteração no sistema. O usuário pediu apenas os comandos completos de inserção usados hoje pela API local; eles foram exibidos no chat, copiados de `api-local/app/sql_store.py` (`cliente_criar_entidade` e `cliente_criar_pessoa_fisica`).

- Entidade: INSERT com 36 colunas, parâmetros nome/email/DDD/celular, `OUTPUT INSERTED.id_entidade`, sem `id_pais` (usa o padrão do Lojamix), cidade 260.
- Pessoa física: INSERT com id_entidade devolvido, CPF e data de nascimento (1900-01-01 quando ausente); demais campos fixos observados no cadastro real.
- Transação única com rollback total em qualquer erro.
