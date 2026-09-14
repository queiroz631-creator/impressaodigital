# Horários não aparecem ao desmarcar "Atender 24 horas"

## Causa (confirmada no banco)

A tela está correta: ao desmarcar 24h ela lista os horários da conexão selecionada. O problema é que a conexão **Queiroz Papelaria** (`e52a9950-7ce5-42ac-a83a-30812bcd3ee7`) existe e tem configuração de bot, mas **não tem nenhum registro na tabela de horários** (`bot_horarios`) — por isso a lista aparece vazia. A conexão Impressão Digital tem os 7 dias corretamente.

## Correção

1. **Migration de correção de dados**: inserir os 7 dias da semana para toda conexão que estiver sem horários, copiando o padrão já usado na conexão Impressão Digital:
   - domingo: fechado (08:00–18:00);
   - segunda a sexta: aberto, 08:00–18:00;
   - sábado: aberto, 08:00–13:00.
   - O insert usa `WHERE NOT EXISTS` por conexão, então não duplica nada e só afeta a Queiroz Papelaria hoje.

2. **Novas conexões**: o código de criação de conexão (`criarConexao`) já insere os horários padrão automaticamente. Essa migration é só para corrigir as conexões que já existem e estão sem os dias.

3. Validar com typecheck e build.

## O que NÃO muda

- Nenhuma alteração de tela, layout ou código do bot — a tela já está certa.
- Nenhuma alteração na conexão Impressão Digital ou em qualquer outro dado.
- Nada de commit/push.
