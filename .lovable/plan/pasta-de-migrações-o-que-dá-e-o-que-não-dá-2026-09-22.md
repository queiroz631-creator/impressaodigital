# Pasta de migrações: o que dá e o que não dá

## Resposta curta

Dá para usar `supabase/migrations` como a **referência única de leitura e de deploy na VPS** — é exatamente o que o `deploy.sh` já faz. O que **não** dá é apagar a pasta `drizzle`: ela é o registro interno que a Lovable usa para saber o que já foi aplicado no banco deste ambiente. Sem ela, qualquer mudança futura de banco feita aqui tende a tentar recriar o que já existe e falhar.

Ou seja: a pasta `drizzle` fica, mas você pode ignorá-la no dia a dia.

## O que eu proponho fazer

1. Manter `drizzle/` intacta (nada apagado, nada movido) — ela continua só como controle interno da plataforma.
2. Definir `supabase/migrations/` como a referência oficial do projeto: é a pasta que o deploy da VPS lê e a que você consulta.
3. Passar a valer a regra: **toda** mudança de banco nova que eu fizer aqui é gravada também em `supabase/migrations/` no mesmo momento, com nome datado, para as duas pastas nunca saírem de sincronia de novo (foi isso que gerou a confusão anterior).
4. Adicionar um arquivo curto `drizzle/README.md` explicando em uma frase que a pasta é controle interno e que a referência é `supabase/migrations` — para quem abrir o projeto depois não ficar em dúvida.
5. Registrar essa regra na memória do projeto, para eu não repetir o descompasso em nenhuma sessão futura.

## O que não muda

- Nenhuma migração é apagada, renomeada ou reaplicada.
- O banco (nem o daqui, nem o da VPS) é tocado.
- `deploy.sh` e `aplicar-migracoes.sh` continuam iguais.
- Nada de commit, push, deploy ou publicação.

## Se você ainda quiser apagar a pasta

É possível, mas o custo é real: mudanças de banco feitas aqui pela plataforma passariam a falhar, e cada ajuste precisaria ser escrito e aplicado manualmente na VPS. Só faço isso se você confirmar explicitamente.
