# Desvincular todos os clientes do Lojamix e refazer a sincronização do zero

## Situação atual (verificada agora)

- 577 clientes no sistema, **106 já com ligação** ao cadastro da loja.
- Fila Sistema → Loja: 3 itens concluídos e 1 pendente.
- Marcador de leitura da loja está na sequência 34.
- Existe uma proteção no banco que **impede apagar a ligação** depois de
  gravada: qualquer tentativa é revertida automaticamente. Por isso a limpeza
  precisa ser feita de forma controlada, e não por uma edição comum.

## O que será feito

### 1. Apagar a ligação dos 106 clientes

Uma operação única no banco que desativa temporariamente a proteção, limpa a
ligação de todos os clientes e liga a proteção de novo na mesma transação.
Nada é excluído: nome, CPF, telefone, e-mail, data de nascimento, participações,
notas e cupons ficam intactos. Apenas o campo de ligação com a loja é esvaziado.

Nenhum cadastro é apagado no Lojamix — os clientes que já existem lá continuam
existindo. Na próxima sincronização eles serão reencontrados pelo CPF e apenas
**revinculados** (não duplicados), porque a busca por CPF acontece antes de
qualquer criação.

### 2. Zerar a fila e o marcador Sistema → Loja

- Os itens da fila de clientes voltam para pendente, para serem reenviados.
- O marcador de leitura volta para o início, para que a loja releia tudo.
- A fila e o marcador de **notas não são tocados** (93 lotes já sincronizados
  permanecem como estão).

### 3. No programa da loja (feito por você)

Depois da limpeza, no Lojamix Sync:

1. Clicar em "Reprocessar clientes" (zera só os marcadores de clientes).
2. Confirmar que a simulação está desligada.
3. Clicar em "Sincronizar Agora".

A cada ciclo o programa processa um bloco de clientes; repetir até os
contadores de "pendentes" pararem de crescer.

## O que não muda

Sincronização de notas, validação, cancelamento, cupons, saldo, regras de
elegibilidade, rotas, telas do site e permissões continuam exatamente iguais.
Nenhum código do site é alterado.

## Detalhes técnicos

- Migração única: `ALTER TABLE public.clientes DISABLE TRIGGER
  clientes_origem_id_permanente` → `UPDATE public.clientes SET origem_id = NULL
  WHERE origem_id IS NOT NULL` (com `origem_alteracao = 'LOJA'` para não gerar
  eco) → `ENABLE TRIGGER`. Tudo numa transação.
- `UPDATE public.sorteio_sincronizacao_fila SET status='PENDENTE', erro=NULL,
  processado_em=NULL, sequencia=nextval(...) WHERE tipo='CLIENTES_SUPABASE_LOJA'`.
- `UPDATE public.sorteio_sincronizacao_cursores SET sequencia = 0 WHERE
  consumidor='api-local-loja'` — cursor oficial do fluxo Supabase → Loja.
- O gatilho `clientes_enfileirar_para_loja` não dispara com a limpeza, pois
  `origem_id` não está entre os campos observados por ele.
