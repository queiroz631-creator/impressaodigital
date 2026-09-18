# Corrigir o aviso "Numero_Endereco" ao abrir/salvar o cliente no Lojamix

## Por que a mensagem aparece

O aviso vem do próprio Lojamix, não do sistema: ao gravar o cadastro, ele exige
que o campo **Número do endereço** tenha algum valor. No cliente criado pela
sincronização esse campo ficou **vazio de verdade (nulo)**, porque o comando de
criação não o preenche — ele foi deixado para o padrão do banco, e no seu banco
local esse padrão não coloca nada.

Verificado no comando de criação do cliente: ele preenche logradouro, bairro e
CEP como texto vazio, mas **não** inclui número do endereço nem complemento.

## O que será ajustado

Um único arquivo do programa da loja (`api-local/app/sql_store.py`), no comando
de criação do cliente:

- passar a gravar **número do endereço** como texto vazio (`''`);
- passar a gravar **complemento** como texto vazio (`''`), pelo mesmo motivo —
  é o outro campo de endereço que hoje pode ficar nulo.

Nada mais muda: cidade 260, os demais valores fixos, o retorno obrigatório do
código da entidade, a transação única com a pessoa física, o desfazimento total
em caso de erro, o vínculo por CPF e o modo simulação continuam iguais.

## Cadastros já criados

Os clientes que já foram criados continuam com esses campos nulos e vão repetir
o aviso na tela do Lojamix. Se quiser, faço em seguida uma correção pontual
desses cadastros existentes (preencher os campos de endereço com vazio) — diga
se prefere que eu inclua isso.

## Depois de aplicar

Na loja: se você editou esse comando na tela de configuração, clique em
"restaurar padrão" nele; gere o executável novamente e sincronize com a
simulação desligada.

## Fora de escopo

Notas, validação, cancelamento, cupons, saldo, cursores, elegibilidade, rotas,
banco do sistema e telas do site. Sem commit, envio ou publicação.
