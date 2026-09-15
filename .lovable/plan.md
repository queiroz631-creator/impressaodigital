# Clientes: enviar só quem realmente participa do sorteio

Hoje a sincronização da loja envia **todo cliente pessoa física** encontrado, varrendo por ordem de cadastro. Passa a enviar somente quem cumpre os três critérios ao mesmo tempo: CPF válido, telefone preenchido e pelo menos uma nota fiscal dentro do período do sorteio ativo.

Nada é apagado: cliente que deixa de ser elegível simplesmente não é enviado, e o cadastro que já existe no sistema continua intacto.

## Regras de elegibilidade

Um cliente só é enviado quando:

1. É pessoa física (cadastro em pessoa física da loja). Pessoa jurídica nunca entra — CNPJ fica totalmente fora.
2. Tem CPF preenchido e válido (somente dígitos, 11 dígitos, dígitos verificadores conferidos).
3. Tem telefone preenchido: celular (DDD + número) e, na falta dele, o telefone 1. Normalizado só com dígitos.
4. Tem ao menos uma nota fiscal no período do sorteio ativo, ligada a esse mesmo cliente pessoa física, não excluída, nas mesmas situações já usadas na sincronização de notas (normal ou cancelada).

Casos conferidos na consulta: CPF + telefone + nota no período envia; sem nota, sem telefone, sem CPF, pessoa jurídica ou nota fora do período não envia; dois telefones envia usando a preferência já definida (celular primeiro).

## Cliente antigo que compra de novo

Além da varredura por cadastro novo, passa a existir uma segunda passagem: a partir das notas fiscais do período, a API descobre os clientes que compraram agora, mesmo que o cadastro seja antigo. Assim um cliente de 2019 que comprou hoje é enviado, sem depender de cadastro novo.

**Marcadores independentes:** o marcador da sincronização de notas (`ultimo_id_nota`) é exclusivo das notas e nunca é lido nem alterado pela passagem de clientes. A segunda passagem tem marcador próprio (`ultimo_id_nota_cliente`) e trabalha numa faixa congelada: início = marcador da passagem, fim = maior número de nota existente na loja no instante do início do ciclo (capturado uma única vez, com uma consulta do tipo "maior nota", nunca consultando o marcador das notas). Notas emitidas depois da captura ficam para o ciclo seguinte.

Cada marcador avança e é gravado de forma independente, **somente depois** que o respectivo lote foi aceito pelo sistema. Erro, tempo esgotado ou lote recusado deixam o marcador onde estava, e a faixa é reprocessada.

As duas passagens não criam duplicidade: o mesmo cliente enviado duas vezes continua sendo o mesmo registro no sistema (identificação por identificador permanente da loja, depois CPF, depois telefone).


## Rede de segurança (reconciliação)

A rotina de reconciliação que já existe continua como proteção, agora também para o caso do cliente que tinha nota no período mas só ganhou CPF ou telefone depois. Ela não reenvia todo mundo: aplica exatamente os mesmos critérios (pessoa física, CPF válido, telefone válido e nota no período do sorteio ativo) e o envio segue idempotente.

## Período do sorteio

Quando a data final do sorteio vier sem horário, o limite passa a ser o começo do dia seguinte, garantindo que o último dia conte inteiro. O limite inicial continua inclusivo.


## Detalhes técnicos

Somente arquivos da API da loja (`api-local/`). Sem migração, sem alteração de constraint, sem mudança nas rotas do sistema, na fila, no cursor oficial, nas regras de validação ou na sincronização de notas.

- `app/repositories/clientes_repo.py`
  - `_SELECT` de clientes ganha `EXISTS` (não `JOIN`, para não multiplicar linhas) sobre `dbo.nota_fiscal` com `nf.id_entidade = e.id_entidade`, `ISNULL(nf.registro_excluido,0)=0`, `nf.data_hora_emissao >= ?` e `< ?`, `nf.id_situacao_documento_fiscal IN (1,3)`; mantém `INNER JOIN dbo.pessoa_fisica`; acrescenta filtros de CPF preenchido e de telefone preenchido (celular ou fone1). Tudo parametrizado.
  - nova função `elegiveis_por_nota(limite, inicio, fim, desde_id_nota, ate_id_nota)`: retorna clientes `DISTINCT` por `id_entidade` cujas notas do período estão na faixa de `id_nota_fiscal` informada, com os mesmos campos e os mesmos filtros de elegibilidade.
  - `por_origem_id` e `aplicar_alteracao` inalterados.
- `app/utils/normalizacao.py`: `cpf()` passa a validar os dígitos verificadores (rejeita 11 dígitos repetidos); novo `telefone()` exigindo pelo menos 10 dígitos.
- `app/services/notas.py`: `_periodo` passa a devolver limite superior exclusivo (dia seguinte quando a data final não tem horário) e fica reutilizável pelo serviço de clientes; a consulta SQL de notas não muda.
- `app/services/clientes.py`: `enviar_para_sistema` consulta o sorteio ativo uma vez, obtém o período, captura `ate_id_nota` uma única vez no início do ciclo (`estado.ler()["ultimo_id_nota"]`) e faz as duas passagens (cadastro novo por `id_entidade`; clientes das notas na faixa `ultimo_id_nota_cliente < id_nota_fiscal <= ate_id_nota`), descarta em Python quem não tem CPF válido, telefone válido ou nome, envia em lote e só avança cada marcador após o lote aceito — erro/timeout mantém os marcadores. Sem sorteio ativo, o ciclo termina sem enviar nada.
- `app/services/clientes.py`: nova `reconciliar_elegiveis()` reaproveitando a mesma consulta de elegibilidade sobre a faixa já processada (em blocos, com marcador próprio de revisão que recicla), chamada pela rotina de reconciliação já existente em `app/routes/reconciliar.py`. Mesmos critérios, mesmo envio idempotente, sem reenvio indiscriminado.
- `app/utils/estado.py`: novos marcadores locais `ultimo_id_nota_cliente` e `ultimo_id_cliente_revisado` (mesma gravação atômica, nunca retrocedem).
- `api-local/README.md`: seção de clientes descrevendo os critérios de elegibilidade, as duas passagens e a reconciliação.


Sem testes, sem dados fictícios, sem commit, push, deploy ou publicação.
