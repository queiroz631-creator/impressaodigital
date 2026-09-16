# Criação de clientes no Lojamix a partir do cadastro real 9942

Objetivo: montar a criação da entidade usando todos os dados confiáveis observados no cadastro de teste real (id_entidade 9942), sem duplicar o que o próprio Lojamix já preenche por padrão, e sem tocar em nada do fluxo de notas.

## Ponto que precisa ser confirmado antes

A definição da tabela `dbo.entidade` só existe no banco da loja (SQL Server na máquina da loja). Daqui não é possível ler quais colunas são obrigatórias nem quais possuem padrão. Portanto o plano tem duas partes:

1. Uma consulta somente-leitura de estrutura, executada no banco da loja, para listar todas as colunas obrigatórias e seus padrões.
2. O ajuste da criação, montado com os valores observados no cadastro 9942.

Consulta de estrutura (somente leitura, nenhuma alteração):

```text
SELECT c.name AS coluna, t.name AS tipo, c.is_nullable, c.is_identity,
       d.definition AS padrao
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.default_constraints d ON d.parent_object_id = c.object_id
                                    AND d.parent_column_id = c.column_id
 WHERE c.object_id = OBJECT_ID('dbo.entidade')
 ORDER BY c.column_id
```

Com esse resultado eu fecho a lista definitiva: para cada coluna obrigatória, se tem padrão, qual foi o valor no 9942, e se a API preenche ou deixa o Lojamix preencher. Enquanto isso não vier, valho-me apenas dos valores realmente observados — nenhum valor inventado.

## Comando de criação da entidade (proposto)

Preenchido explicitamente pela API — dados do sistema:

- `nome`, `email_principal` (vazio quando não houver), `celular_ddd`, `celular_numero`

Preenchido explicitamente com valores observados no cadastro real 9942 (sem padrão confirmado):

- `tipo_entidade` = 1
- `id_usuario_cadastro` = 2
- `id_potencial` = 1
- `situacao_replicacao_multiloja` = 1
- `limite_credito` = 0.00
- `Ativo` = 1
- `celular_whatsapp` = 0
- `cadastro_incompleto` = 1
- `flag_fornecedor` = 0, `flag_guia` = 0, `flag_transportadora` = 0, `flag_funcionario` = 0
- `exibir_agenda` = 0
- `id_forca_vendas` = 0
- `valor_pontuacao` = 0, `quantidade_pontos` = 0, `valor_faixa_pontuacao` = 0, `valor_sobra_acumulado` = 0
- `id_transportadora_padrao` = -1
- `valor_limite_compra` = 0, `periodo_limite_compra` = -2
- `cobrar_juros_recebimento` = 1, `cobrar_multa_recebimento` = 1
- `entidade_estrangeira` = 0, `id_pais` = 0
- `bloquear_consignacao` = 0, `bloquear_pedido_venda` = 0

Deixados para o padrão do Lojamix (padrão já confirmado — não repetir):

- `data_hora_cadastro`, `flag_contador`, `num_insc_crc`, `fone1_ddd`, `fone1_numero`,
  `receber_email_promocao`, `saldo_valor_pontuacao`, `saldo_pontuacao`, `pontuacao_acumulada`,
  `flag_cliente`, `flag_profissional`, `flag_medico`, `flag_laboratorio`

Observação sobre `cep`: no cadastro 9942 apareceu o valor 260. Só incluo essa coluna se a consulta de estrutura mostrar que ela é obrigatória e sem padrão — não vou assumir.

`OUTPUT INSERTED.id_entidade` continua obrigatório e a validação que já existe no programa continua recusando qualquer comando de criação que não devolva o identificador.

## Pessoa física

Preservada exatamente como está hoje: `id_entidade`, `cpf` (do sistema), `data_nascimento` (do sistema, ou 1900-01-01 quando não houver), `rg` = '', `ie` = '', `sexo` = 1, `indicador_ie` = 9, `nome_mae` = '', `nome_pai` = ''.

## Transação

Sem mudança na mecânica já existente: mesma conexão, entidade → identificador → pessoa física → conferência de que existe exatamente um registro para o identificador criado → confirmação. Qualquer falha desfaz tudo e nada é considerado criado, nada é vinculado e nenhum marcador avança.

## Vínculo e simulação

Vínculo pelo fluxo atual, sem alterar a regra por CPF. Simulação preservada: ligada, consulta o CPF, informa o que faria e não grava, não vincula, não confirma a fila e não avança o processamento.

## Escopo técnico

Arquivos alterados: apenas `api-local/app/sql_store.py` (comando `cliente_criar_entidade`, com os valores fixos escritos direto no comando e apenas os dados do cliente como parâmetros) e, se necessário para o novo passo de conferência de estrutura, uma consulta somente-leitura adicional em `api-local/app/sql_store.py` + `api-local/app/repositories/clientes_repo.py`.

Nada muda no site, no banco do sistema, em rotas, migrações, elegibilidade, participação, fila, cursores, notas, validação, cancelamento, cupons, saldo ou cron. Nenhum cadastro de teste novo, nenhuma criação real executada durante a implementação, e nenhum commit, envio ou publicação.

## Ao final eu apresento

- o comando final de criação da entidade;
- a lista completa de colunas preenchidas explicitamente com seus valores;
- as colunas deixadas para o padrão do Lojamix;
- a confirmação de que todas as colunas obrigatórias sem padrão foram tratadas;
- a confirmação de `OUTPUT INSERTED.id_entidade`, da transação única e do desfazimento em qualquer erro.
