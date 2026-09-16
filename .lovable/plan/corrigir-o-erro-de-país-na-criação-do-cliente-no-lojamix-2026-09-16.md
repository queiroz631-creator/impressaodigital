# Corrigir o erro de país na criação do cliente no Lojamix

## O que o resultado mostra
As duas etapas de clientes (sistema → loja) falharam com o mesmo erro do SQL Server: o valor de país enviado (0) não existe na tabela de países do Lojamix, então a criação foi recusada e desfeita (`fk_entidade_pais_exportacao`). Nenhum cliente foi criado, nenhum vínculo foi feito e nenhum marcador avançou — o comportamento de segurança funcionou.

Também aparece "Clientes pendentes: recebidos 3" — os cadastros prontos estão sendo encontrados corretamente; só a gravação falhou.

## Correção
1. Em `api-local/app/sql_store.py`, no comando de criação da entidade (`cliente_criar_entidade`): remover o campo de país da lista de campos e do seu valor, deixando o Lojamix aplicar o próprio padrão da coluna (ela é obrigatória, mas tem padrão definido no banco). Assim nenhum valor inválido é enviado.
2. Nada mais muda no comando: continua com `OUTPUT INSERTED.id_entidade`, os dados do cliente vindos do sistema (nome, e-mail quando existir, DDD, celular) como parâmetros, e os demais valores fixos já espelhados do cadastro real.
3. Pessoa física, transação única, conferência de exatamente um registro antes de confirmar, rollback total em qualquer erro, vínculo por CPF e modo simulação: tudo preservado.

## Ponto de atenção (pode gerar o próximo erro igual)
O comando envia cidade = 260. Se esse número não for um código de cidade válido no Lojamix, o próximo teste falhará com o mesmo tipo de erro, agora apontando cidade. Se acontecer, aplico a mesma solução: deixar a cidade em branco/padrão do Lojamix.

## Fora do escopo
Site, banco de dados, rotas, sincronização de notas, validação, cupons, saldo, cursores e regras de elegibilidade não são tocados. Sem commit, envio ou publicação.

## Depois de aplicar
Se você já editou esse comando na tela de configuração do programa, clique em "restaurar padrão" nele; depois desligue a simulação e clique em "Sincronizar Agora".
