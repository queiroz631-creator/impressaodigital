# Corrigir o deploy: faltam migrações anteriores na pasta oficial

## O que aconteceu

A VPS parou na migração `20260922120000_cupons_apos_cancelamento.sql` porque ela
usa a tabela `sorteio_saldo_fontes`, que **não existe no banco da VPS**.

Motivo: quando copiei as mudanças recentes para `supabase/migrations/` (a pasta
que o deploy lê), copiei só as sete últimas. As mudanças anteriores — as que
criaram a geração de cupons, o recálculo de saldo, a rastreabilidade (fontes de
saldo e contribuições) e a ordem FIFO — ficaram apenas no controle interno da
plataforma. Sem elas, a VPS não tem as tabelas que as sete novas precisam.

Nada foi aplicado pela metade: o deploy interrompeu antes de registrar a
migração, então basta completar a pasta e rodar o deploy de novo.

## O que será feito

Copiar para `supabase/migrations/` as seis mudanças que faltam, com datas
anteriores às sete já copiadas, na ordem correta:

1. campo de origem do cliente nas notas da loja
2. geração de cupons a partir das notas
3. recálculo de saldo do participante
4. cancelamento de cupons sem lastro
5. rastreabilidade (fontes de saldo e contribuições por cupom)
6. ordem FIFO explícita das fontes de saldo

Duas mudanças internas **não** serão copiadas: as duas limpezas de
`origem_id` de clientes. Elas eram tarefas pontuais do ambiente da plataforma e,
se rodassem na VPS, apagariam o vínculo dos clientes com a loja.

## Depois disso

Rodar na VPS novamente:

```text
cd /var/www/impressaodigital
bash deploy/deploy.sh
```

As treze migrações serão aplicadas na ordem e o deploy segue para build e PM2.

## Detalhes técnicos

- Novos arquivos em `supabase/migrations/`, SQL idêntico ao das originais
  (`drizzle/migrations/0001, 0003, 0004, 0005, 0006, 0007`), nomeados
  `20260921110000_notas_base_cliente_origem.sql` até
  `20260921110500_sorteio_fontes_sequencia_fifo.sql`, todos anteriores a
  `20260922120000`.
- `drizzle/migrations/0000` e `0002` (UPDATE em `public.clientes`) ficam fora por
  serem correções de dados do ambiente da plataforma.
- `drizzle/` segue intacta; nenhuma migração é executada aqui — o banco da
  plataforma já tem tudo isso.
- Nota em `roadmap.md`: ao copiar mudanças de banco para a pasta oficial,
  conferir se as dependências anteriores também estão lá.
