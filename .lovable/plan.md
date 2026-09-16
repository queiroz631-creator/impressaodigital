# Criação de clientes no Lojamix a partir do cadastro real 9942

Objetivo: montar a criação do cliente no Lojamix com base em todos os campos realmente exigidos pela tabela `dbo.entidade` e nos valores observados no cadastro de teste real (9942), sem duplicar o que o Lojamix já preenche por padrão.

## Campos obrigatórios (analisados a partir da estrutura enviada)

Obrigatórios que JÁ têm padrão no Lojamix — não serão preenchidos pela API:

| Campo | Padrão |
| --- | --- |
| data_hora_cadastro | data/hora atual |
| receber_email_promocao | 0 |
| saldo_valor_pontuacao | 0 |
| saldo_pontuacao | 0 |
| pontuacao_acumulada | 0 |
| flag_cliente | 1 |
| flag_profissional | 0 |
| flag_medico | 0 |
| flag_laboratorio | 0 |

Obrigatórios SEM padrão — precisam ser preenchidos pela API:

| Campo | Valor no teste 9942 | Origem na API |
| --- | --- | --- |
| tipo_entidade | 1 | fixo 1 |
| nome | "teste" | vem do sistema |
| id_usuario_cadastro | 2 | fixo 2 |
| id_potencial | 1 | fixo 1 |
| flag_fornecedor | 0 | fixo 0 |
| flag_guia | 0 | fixo 0 |
| flag_transportadora | 0 | fixo 0 |
| flag_funcionario | 0 | fixo 0 |
| situacao_replicacao_multiloja | 1 | fixo 1 |
| limite_credito | 0.00 | fixo 0 |
| cep | 260 | a confirmar (ver abaixo) |
| logradouro | vazio no teste | a confirmar |
| bairro | vazio no teste | a confirmar |
| site | vazio no teste | a confirmar |
| observacao | vazio no teste | a confirmar |
| id_cidade | não informado | a confirmar |

## Falta um dado para fechar

Seis campos são obrigatórios e não têm padrão, e os valores exatos deles no cadastro 9942 não vieram (ou vieram sem certeza): `logradouro`, `bairro`, `cep`, `site`, `observacao` e `id_cidade`. Não vou inventar nenhum deles. Preciso do resultado desta consulta somente-leitura no banco da loja:

```text
SELECT logradouro, bairro, cep, id_cidade, site, observacao
  FROM dbo.entidade
 WHERE id_entidade = 9942
```

Com esses seis valores eu completo o comando de criação exatamente como o Lojamix criou o cadastro real. Enquanto não vierem, a implementação fica pronta com os demais campos e esses seis entram no mesmo formato do cadastro real (texto vazio para os textuais e o número real de cidade/CEP), sem qualquer valor imaginado.

## Campos opcionais preenchidos por espelho do cadastro real

Não são obrigatórios, mas foram observados no cadastro criado pela própria tela do Lojamix, então serão gravados igual para o registro nascer no mesmo estado:

`Ativo` = 1, `celular_whatsapp` = 0, `cadastro_incompleto` = 1, `exibir_agenda` = 0, `id_forca_vendas` = 0, `valor_pontuacao` = 0, `quantidade_pontos` = 0, `valor_faixa_pontuacao` = 0, `valor_sobra_acumulado` = 0, `id_transportadora_padrao` = -1, `valor_limite_compra` = 0, `periodo_limite_compra` = -2, `cobrar_juros_recebimento` = 1, `cobrar_multa_recebimento` = 1, `entidade_estrangeira` = 0, `id_pais` = 0, `bloquear_consignacao` = 0, `bloquear_pedido_venda` = 0.

## Dados que continuam vindo do sistema

`nome`, `celular_ddd`, `celular_numero`, `email_principal` (vazio quando não houver — e-mail nunca bloqueia), e em pessoa física o `cpf` e a `data_nascimento` (1900-01-01 apenas quando não houver data).

## Pessoa física

Preservada como está: `id_entidade`, `cpf`, `data_nascimento`, `rg` = '', `ie` = '', `sexo` = 1, `indicador_ie` = 9, `nome_mae` = '', `nome_pai` = ''.

## Criação

Sem mudança na mecânica atual: mesma conexão e mesma transação — entidade com `OUTPUT INSERTED.id_entidade` → pessoa física com o identificador devolvido → conferência de que existe exatamente um registro de pessoa física para esse identificador → confirmação. Qualquer falha desfaz tudo; nada é vinculado e nenhum marcador avança. O identificador é sempre o próximo gerado pela própria tabela — o 9942 é só referência.

## Vínculo e simulação

Vínculo pelo fluxo atual, sem alterar a regra por CPF. Simulação preservada: ligada, consulta o CPF, informa o que faria, não grava, não vincula, não confirma a fila e não avança o processamento.

## Escopo técnico

Arquivo alterado: apenas `api-local/app/sql_store.py` (comando `cliente_criar_entidade` — valores fixos escritos no próprio comando, apenas os dados do cliente como parâmetros). Nada muda no site, banco, rotas, migrações, elegibilidade, participação, fila, cursores, notas, validação, cancelamento, cupons, saldo ou cron. Nenhum cadastro de teste novo, nenhuma criação real durante a implementação, sem commit, envio ou publicação.

## Ao final eu apresento

- o comando final de criação da entidade;
- todos os campos preenchidos explicitamente e seus valores;
- os campos deixados para o padrão do Lojamix;
- a confirmação de que todos os obrigatórios sem padrão foram tratados;
- a confirmação de `OUTPUT INSERTED.id_entidade`, da transação única e do desfazimento em qualquer erro.
