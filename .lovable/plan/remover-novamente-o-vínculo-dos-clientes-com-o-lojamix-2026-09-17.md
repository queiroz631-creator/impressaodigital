# Remover novamente o vínculo dos clientes com o Lojamix

## Situação atual (verificada agora)

- 580 clientes no sistema, **9 com ligação** ao cadastro da loja.
- Os 9 participantes do sorteio estão marcados como "Sincronizado" na tela.
- Fila Sistema → Loja: 7 itens concluídos. Marcador de leitura da loja: 105.
- A proteção no banco continua impedindo apagar a ligação por edição comum,
  então a limpeza precisa ser feita de forma controlada.

## O que será feito

### 1. Apagar a ligação dos 9 clientes

Operação única no banco: desativa temporariamente a proteção, esvazia o campo
de ligação com a loja e reativa a proteção na mesma transação. Nada é excluído
— nome, CPF, telefone, e-mail, data de nascimento, participações, notas e
cupons ficam intactos. Nenhum cadastro é apagado no Lojamix; na próxima
sincronização eles são reencontrados pelo CPF e apenas revinculados.

### 2. Voltar os participantes para "Pendente"

Os 9 participantes voltam para o indicador "Pendente", sem data de
sincronização, para refletir que a ligação foi removida.

### 3. Zerar a fila e o marcador Sistema → Loja

- Os 7 itens da fila de clientes voltam para pendente, para serem reenviados.
- O marcador de leitura da loja volta ao início.
- Fila e marcador de **notas não são tocados** (93 lotes permanecem como estão).

### 4. No programa da loja (feito por você)

1. "Reprocessar clientes" (zera só os marcadores de clientes).
2. Confirmar que a simulação está desligada.
3. "Sincronizar Agora", repetindo até os contadores pararem de crescer.

## O que não muda

Notas, validação, cancelamento, cupons, saldo, regras de elegibilidade, rotas,
telas e permissões continuam iguais. Nenhum código do site é alterado.

## Detalhes técnicos

- Migração única, numa transação: `ALTER TABLE public.clientes DISABLE TRIGGER
  clientes_origem_id_permanente` → `UPDATE public.clientes SET origem_id = NULL,
  origem_alteracao = 'LOJA' WHERE origem_id IS NOT NULL` → `ENABLE TRIGGER`.
- `UPDATE public.sorteio_participantes SET sincronizacao_status = 'PENDENTE',
  sincronizado_em = NULL`.
- `UPDATE public.sorteio_sincronizacao_fila SET status='PENDENTE', erro=NULL,
  processado_em=NULL, sequencia=nextval(...) WHERE tipo='CLIENTES_SUPABASE_LOJA'`.
- `UPDATE public.sorteio_sincronizacao_cursores SET sequencia = 0 WHERE
  consumidor='api-local-loja'`.
- O gatilho `clientes_enfileirar_para_loja` não dispara com a limpeza.
