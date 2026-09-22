# Levar as migrações recentes para a pasta da VPS

## Objetivo
Copiar as migrações criadas no ambiente Lovable (pasta `drizzle/migrations/`, arquivos 0008 a 0014) para `supabase/migrations/`, que é a pasta que o `deploy/deploy.sh` da VPS lê. Assim, no próximo deploy, o banco da VPS recebe as rotinas novas.

## O que será feito
1. Ler o conteúdo de cada arquivo de `drizzle/migrations/`: `0008_cupons_apos_cancelamento`, `0009_corrige_pool_nota_em_processamento`, `0010_encerramento_sorteio`, `0011_apuracao_sorteio`, `0012_reabertura_sorteio`, `0013_apuracao_dados_parciais_ganhador`, `0014_configuracao_ia`.
2. Criar em `supabase/migrations/` um arquivo novo para cada uma, com nome no padrão da pasta (`AAAAMMDDHHMMSS_descricao.sql`, datas posteriores ao marco `20260912044341` e à última existente `20260917024149`), mantendo a mesma ordem e o SQL idêntico.
3. Não alterar `deploy/migrations-baseline.txt` (o marco continua o mesmo; os arquivos novos vêm depois dele e serão executados de verdade no próximo deploy).
4. Conferir que os 7 arquivos novos aparecem na listagem e que o SQL não contém nada específico do ambiente Lovable que quebraria na VPS (ajustar só se houver incompatibilidade real).

## O que NÃO será feito
- Nenhum SQL é executado agora — nem na VPS, nem no Lovable.
- Nada muda no `deploy.sh` nem no `aplicar-migracoes.sh`.
- Os arquivos originais em `drizzle/migrations/` continuam intactos.
- Sem commit, push, deploy ou publicação — a aplicação na VPS acontece só quando você rodar o deploy lá.

## Detalhes técnicos
- O controle do que já foi aplicado na VPS é a tabela `_migracoes_aplicadas`; arquivos com nomes novos serão detectados e executados na ordem alfabética pelo `aplicar-migracoes.sh`.
- Como os nomes na pasta da VPS são por data/hora, a ordenação alfabética garante que 0008→0014 sejam aplicadas na sequência correta.
- Verificação: listagem da pasta e leitura dos arquivos gerados; sem rodar deploy.
