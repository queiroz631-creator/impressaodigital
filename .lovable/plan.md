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

Além da varredura por cadastro novo, passa a existir uma segunda passagem: a partir das notas fiscais recém-lidas no período, a API descobre os clientes que compraram agora, mesmo que o cadastro seja antigo. Assim um cliente de 2019 que comprou hoje é enviado, sem depender de cadastro novo.

As duas passagens usam marcadores locais próprios que só avançam depois do envio aceito, e o mesmo cliente enviado duas vezes continua sendo o mesmo registro no sistema (identificação por identificador permanente da loja, depois CPF, depois telefone) — nunca duplica.

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
- `app/services/clientes.py`: `enviar_para_sistema` consulta o sorteio ativo uma vez, obtém o período e faz as duas passagens (cadastro novo por `id_entidade`; clientes das notas recentes por faixa de `id_nota_fiscal`), descarta em Python quem não tem CPF válido, telefone válido ou nome, envia em lote e só depois avança os marcadores. Sem sorteio ativo, o ciclo termina sem enviar nada.
- `app/utils/estado.py`: novo marcador local `ultimo_id_nota_cliente` (mesma gravação atômica, nunca retrocede).
- `api-local/README.md`: seção de clientes descrevendo os critérios de elegibilidade e as duas passagens.

Sem testes, sem dados fictícios, sem commit, push, deploy ou publicação.
