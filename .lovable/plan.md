# Corrigir erro "Não foi possível concluir seu cadastro"

## O que está acontecendo

Ao criar um cadastro novo pelo portal do sorteio, o banco recusa a gravação do cliente. O erro não vem dos dados digitados (nome e data estão válidos): vem de uma rotina interna que registra o cliente na fila de sincronização com a loja.

Essa rotina tenta gravar usando uma regra de "não duplicar" que aponta para um índice **parcial** da fila (`sorteio_sinc_fila_operacao_unica`, válido só quando o identificador da operação existe). O Postgres não aceita esse tipo de índice nessa forma de gravação, então a gravação inteira falha e o cadastro é desfeito. É exatamente o mesmo problema já corrigido antes no envio de notas.

Confirmado por leitura: o índice da fila é parcial, e a rotina `clientes_enfileirar_para_loja` usa `ON CONFLICT (origem, entidade, operacao_id)`.

## Correção proposta

Nova migração que substitui apenas a função `public.clientes_enfileirar_para_loja()`:

- Trocar o `INSERT ... ON CONFLICT` por buscar-e-decidir: se já existe item na fila para aquele cliente e operação, atualizar (volta a PENDENTE, limpa erro, renova a sequência); se não existe, inserir.
- Tratar colisão de concorrência (`unique_violation`) atualizando o registro existente, sem falhar o cadastro.
- Manter tudo o resto igual: proteção anti-eco (`origem_alteracao = 'LOJA'` não enfileira), comparação de campos que dispensa enfileiramento, tipos `CLIENTES_SUPABASE_LOJA`, `operacao_id = 'cliente:<id>'`, `SECURITY DEFINER`, gatilhos de INSERT e UPDATE.

## Fora do escopo

- Nenhuma alteração em índices, constraints, RLS, dados existentes ou históricos.
- Nenhuma alteração no fluxo do portal, na validação de notas, na sincronização do Lojamix, em cupons ou saldo.
- Nenhum dado fictício, nenhum teste, nenhum commit/push/deploy.

## Detalhes técnicos

- Arquivo: uma migração nova com `CREATE OR REPLACE FUNCTION public.clientes_enfileirar_para_loja()`, `SET search_path = public`, `SECURITY DEFINER`.
- Sequência renovada com `nextval('public.sorteio_sincronizacao_fila_sequencia_seq')` no caminho de atualização, como hoje.
- Referência do mesmo padrão já aplicado: `src/lib/sorteios-eventos.server.ts` (`enfileirar` por leitura + gravação).
