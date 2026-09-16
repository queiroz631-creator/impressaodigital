# Criação de clientes no Lojamix a partir do cadastro real 9942

Objetivo: montar a criação do cliente com base em todos os campos realmente exigidos pela tabela `dbo.entidade` e nos valores observados no cadastro de teste real (9942), sem duplicar o que o Lojamix já preenche por padrão.

## Obrigatórios que já têm padrão — a API não preenche

`data_hora_cadastro` (data/hora atual), `receber_email_promocao` (0), `saldo_valor_pontuacao` (0), `saldo_pontuacao` (0), `pontuacao_acumulada` (0), `flag_cliente` (1), `flag_profissional` (0), `flag_medico` (0), `flag_laboratorio` (0).

## Obrigatórios SEM padrão — a API preenche

| Campo | Valor |
| --- | --- |
| tipo_entidade | 1 (observado) |
| nome | vem do sistema |
| id_usuario_cadastro | 2 (observado) |
| logradouro | '' (fica vazio) |
| bairro | '' (fica vazio) |
| cep | '' (fica vazio) |
| site | '' (fica vazio) |
| observacao | '' (fica vazio) |
| id_cidade | 260 — a confirmar (ver abaixo) |
| id_potencial | 1 (observado) |
| flag_fornecedor | 0 (observado) |
| flag_guia | 0 (observado) |
| flag_transportadora | 0 (observado) |
| flag_funcionario | 0 (observado) |
| situacao_replicacao_multiloja | 1 (observado) |
| limite_credito | 0.00 (observado) |

## Único ponto a confirmar: id_cidade

`id_cidade` é obrigatório, não tem padrão e é numérico. No relato do cadastro 9942 apareceu o número 260 associado ao campo "cep", mas `cep` é texto e ficou vazio — então esse 260 é, com muita probabilidade, o código de cidade do cadastro real. Preciso da confirmação com esta leitura:

```text
SELECT cep, id_cidade FROM dbo.entidade WHERE id_entidade = 9942
```

Se confirmar 260, uso 260. Se vier outro número, uso o número real. Não vou inventar valor nenhum para esse campo.

## Opcionais preenchidos por espelho do cadastro real

`Ativo` = 1, `celular_whatsapp` = 0, `cadastro_incompleto` = 1, `exibir_agenda` = 0, `id_forca_vendas` = 0, `valor_pontuacao` = 0, `quantidade_pontos` = 0, `valor_faixa_pontuacao` = 0, `valor_sobra_acumulado` = 0, `id_transportadora_padrao` = -1, `valor_limite_compra` = 0, `periodo_limite_compra` = -2, `cobrar_juros_recebimento` = 1, `cobrar_multa_recebimento` = 1, `entidade_estrangeira` = 0, `id_pais` = 0, `bloquear_consignacao` = 0, `bloquear_pedido_venda` = 0.

Os demais campos opcionais continuam vazios, como no cadastro real.

## Dados que continuam vindo do sistema

`nome` (limitado a 80 caracteres, como a coluna), `celular_ddd` (2), `celular_numero` (18), `email_principal` (100 — vazio quando não houver; e-mail nunca bloqueia), e na pessoa física o `cpf` e a `data_nascimento` (1900-01-01 só quando não houver data).

## Pessoa física

Preservada como está: `id_entidade`, `cpf`, `data_nascimento`, `rg` = '', `ie` = '', `sexo` = 1, `indicador_ie` = 9, `nome_mae` = '', `nome_pai` = ''.

## Criação

Mecânica atual mantida: mesma conexão e mesma transação — entidade com `OUTPUT INSERTED.id_entidade` → pessoa física com o identificador devolvido → conferência de que existe exatamente um registro de pessoa física para esse identificador → confirmação. Qualquer falha desfaz tudo, nada é vinculado e nenhum marcador avança. O identificador é sempre o próximo gerado pela própria tabela; o 9942 é só referência.

## Vínculo e simulação

Vínculo pelo fluxo atual, sem alterar a regra por CPF. Simulação preservada: ligada, consulta o CPF, informa o que faria, não grava, não vincula, não confirma a fila e não avança o processamento.

## Escopo técnico

Arquivo alterado: apenas `api-local/app/sql_store.py` (comando `cliente_criar_entidade` — valores fixos escritos no próprio comando, só os dados do cliente como parâmetros). Nada muda no site, banco, rotas, migrações, elegibilidade, participação, fila, cursores, notas, validação, cancelamento, cupons, saldo ou cron. Nenhum cadastro de teste novo, nenhuma criação real durante a implementação, sem commit, envio ou publicação.

## Ao final eu apresento

- o comando final de criação da entidade;
- todos os campos preenchidos explicitamente e seus valores;
- os campos deixados para o padrão do Lojamix;
- a confirmação de que todos os obrigatórios sem padrão foram tratados;
- a confirmação de `OUTPUT INSERTED.id_entidade`, da transação única e do desfazimento em qualquer erro.
