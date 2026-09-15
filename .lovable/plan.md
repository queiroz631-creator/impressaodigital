# Etapa 6 — API local + integração real com o SQL Server Lojamix

Criar o programa que roda **na máquina da loja** (Python/FastAPI) e conversa com o banco Lojamix, enviando notas e clientes para o sistema pela internet, com token. O site nunca acessa o banco da loja.

```text
SQL Server Lojamix -> API local (loja) -> HTTPS + token -> Sistema/Supabase
```

## O que já existe e será reaproveitado

- Endpoints de sincronização da Etapa 5: recebimento de lote de notas, confirmação de lote, recebimento de clientes, leitura de alterações de clientes, confirmação de cursor e reconciliação.
- Fila (`sorteio_sincronizacao_fila`), log de execuções (`sorteio_sincronizacoes`), cursores (`sorteio_sincronizacao_cursores`), `sorteios.base_sincronizada_em`, `clientes.origem_id` e `origem_alteracao`.
- Mesmo token interno já usado pelas rotinas automáticas. Nada novo a configurar no sistema.

Nenhuma tabela paralela é criada.

## Decisões confirmadas

- **Sorteio de cada nota:** a API consulta o sistema, recebe o sorteio ativo e seu período, e envia somente notas emitidas dentro desse período.
- **Nota cancelada na loja:** a base marca a nota como cancelada e a nota do participante deixa de ser válida; nada é apagado e a auditoria é preservada. Cupons/saldo continuam fora desta etapa.
- **Clientes:** só nome, CPF, telefone, data de nascimento e e-mail.

## O que a API local faz

1. Pergunta ao sistema qual é o sorteio ativo e seu período — **uma vez por ciclo/lote**, nunca por nota.
2. Lê no Lojamix apenas as notas novas, usando o número interno da nota (`id_nota_fiscal`) como marcador: `id_nota_fiscal > último processado`, em ordem crescente. A data de emissão serve só para conferir se a nota está no período do sorteio.
3. Numa segunda leitura, revisa as notas já enviadas para detectar mudança de situação (principalmente cancelamento) — nota já sincronizada nunca fica invisível para alterações futuras.
4. Considera apenas notas de **pessoa física** (nota → entidade → pessoa física). Pessoa jurídica fica de fora; CNPJ nunca é usado.
5. Converte o valor para centavos e envia em lotes (abrir lote → enviar → confirmar). O lote só conta como sincronizado depois da confirmação.
6. Envia as notas canceladas com número, referência de origem, sorteio, situação e data do cancelamento — atualiza a nota existente, nunca cria outra e nunca apaga.
7. Envia clientes novos/alterados da loja, com nome e textos em CAIXA ALTA, sem acentos e sem caracteres especiais; CPF, telefone, CEP, e-mail e datas têm regra própria.
8. Busca as alterações de clientes feitas no sistema a partir do cursor oficial, aplica no Lojamix e só então confirma o cursor.
9. Nunca apaga cliente nem nota. Falhas ficam registradas com tentativa e erro resumido, e o item volta para nova tentativa.

## Marcadores (cursores)

- **Notas (loja → sistema):** marcador local da própria API, guardado em arquivo JSON gravado de forma atômica para não corromper em queda de energia. Guarda o último número interno de nota processado e o ponto da última revisão de situação.
- **Clientes (sistema → loja):** continua valendo o cursor oficial do sistema (`sorteio_sincronizacao_cursores`), que só avança depois que a alteração foi aplicada no SQL Server e confirmada.

## Identificação da nota (regra absoluta)

Identidade lógica: **sorteio + número do documento fiscal**. Validação: número + valor em centavos. A referência de origem (`origemId`, o `id_nota_fiscal`) é só informação adicional e não substitui a identidade lógica. CPF, CNPJ, nome, telefone e data **nunca** identificam nem validam a nota. A data de emissão serve só para o período e para informação.


## Segurança

Credenciais do SQL Server só em variáveis de ambiente, com `.env.example` sem valores reais. Token e senha nunca aparecem em log, em resposta de erro ou no `/health`. CPF completo nunca vai para log. Todas as consultas ao SQL Server são parametrizadas.

## Detalhes técnicos

**Projeto novo `api-local/`** (Python 3, FastAPI, Uvicorn, pyodbc, ODBC Driver 18, Pydantic):

```text
api-local/
  app/main.py            app FastAPI, GET /health, registro das rotas
  app/config.py          leitura de ambiente (SQL Server, URL do sistema, token, lote, limites)
  app/database.py        pool/conexão pyodbc, timeout, retry, erros sem credenciais
  app/routes/            sync_notas.py, sync_clientes.py, reconciliar.py
  app/services/          notas.py, clientes.py, lotes.py, cursor.py, supabase_client.py
  app/repositories/      notas_repo.py, clientes_repo.py (SQL parametrizado, Lojamix)
  app/schemas/           modelos Pydantic de entrada/saída
  app/utils/             normalizacao.py (texto/CPF/telefone/CEP), logging.py, estado.py (cursores locais em arquivo JSON)
  .env.example  requirements.txt  README.md
```

Endpoints locais (todos com token exigido no header, exceto `/health`): `GET /health`, `POST /api/sync/notas-lote`, `POST /api/sync/notas-confirmar`, `POST /api/sync/clientes-receber`, `GET /api/sync/clientes-alteracoes`, `POST /api/sync/clientes-confirmar`, `POST /api/sync/reconciliar`. Cada um dispara o ciclo correspondente contra os endpoints já existentes do sistema (`/api/public/sorteios/sync/*` e `/api/public/sorteios/reconciliar`), reaproveitando `lote_id`/`operacao_id` para idempotência.

Consulta de notas (parametrizada, incremental por `id_nota_fiscal`/`data_hora_emissao`):
`dbo.nota_fiscal` JOIN `dbo.entidade` JOIN `dbo.pessoa_fisica`, filtrando `data_hora_emissao` no período do sorteio, `id_situacao_documento_fiscal in (1,3)` e desconsiderando `registro_excluido` verdadeiro (NULL não é tratado como excluído). Campos enviados: `numero_documento_fiscal`, `valor_total` → centavos, `data_hora_emissao`, situação, `data_hora_cancelamento`, `id_filial`, `id_nota_fiscal` como `origemId`.

**Lado do sistema (mínimo necessário):**

- Migração: `sorteio_notas_base` ganha `situacao smallint default 1` e `cancelada_em timestamptz null` (mesmos GRANTs restritos já usados). Nada é removido nem alterado além disso.
- Nova rota `src/routes/api/public/sorteios/sync/notas-situacao.ts` (POST, token, Zod): recebe `sorteioId` + lista de números cancelados; marca a nota da base como cancelada e coloca a nota correspondente do participante como `CANCELADA` com auditoria — sem apagar registro.
- Nova rota `src/routes/api/public/sorteios/sync/sorteio-ativo.ts` (POST, token): devolve apenas `id`, `numero_sorteio`, `data_inicio`, `data_fim` do sorteio ATIVO.
- `src/lib/sorteios-sync.server.ts`: funções `registrarSituacaoNotas` e `lerSorteioAtivoParaSync`, seguindo o padrão de lote/auditoria já existente. `receberNotasLote`/`confirmarNotasLote` permanecem inalterados.
- Tipos: `SorteioNotaBase` ganha `situacao` e `cancelada_em`.

**Não alterado:** portal público, validação existente, cupons, saldo, WhatsApp, Bot, Conexões, RLS existente, demais módulos.

Sem testes, dados fictícios, commit, push, deploy ou publicação.
