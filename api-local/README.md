# API local da loja (Etapa 6)

Programa que roda **no computador/servidor da loja**, lê o banco SQL Server do
Lojamix e conversa com o sistema pela internet, com token.

```text
SQL Server Lojamix -> API local (loja) -> HTTPS + token -> Sistema
```

O sistema nunca acessa o SQL Server diretamente.

## Requisitos

- Python 3.11 ou superior
- Microsoft ODBC Driver 18 for SQL Server
- Acesso de leitura ao banco `Lojamix` (leitura + escrita apenas se quiser
  aplicar no Lojamix as alterações de clientes feitas no sistema)

## Instalação

```bash
cd api-local
python -m venv .venv
. .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # preencha o .env
```

O `.env` nunca vai para o Git. `.env.example` não contém credenciais reais.

## Configuração

| Variável | Para que serve |
| --- | --- |
| `SQLSERVER_*` | Conexão com o Lojamix (host, porta, banco, usuário, senha, driver, timeout) |
| `SISTEMA_URL` | Endereço do sistema na nuvem |
| `SISTEMA_TOKEN` | Token interno já usado pelas rotinas de sincronização do sistema |
| `API_LOCAL_TOKEN` | Token exigido nas rotas desta API (header `X-API-Token`) |
| `LOTE_TAMANHO` / `LOTE_MAXIMO_CICLOS` | Tamanho do lote de notas e quantos lotes por execução |
| `REVISAO_BLOCO` | Tamanho do bloco na revisão de cancelamentos |
| `CONSUMIDOR_CLIENTES` | Nome deste consumidor no cursor oficial do sistema |
| `ESTADO_ARQUIVO` | Arquivo JSON do marcador local |
| `ESCRITA_SQLSERVER_HABILITADA` | `false` bloqueia qualquer gravação no Lojamix |

## Execução

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8100
```

## Endpoints

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/health` | Estado básico (público) |
| POST | `/api/sync/notas-lote` | Lê notas novas e envia em lotes ao sistema |
| POST | `/api/sync/notas-confirmar` | Reexecuta o ciclo; lotes não confirmados são reenviados |
| POST | `/api/sync/notas-situacao` | Comunica notas canceladas |
| POST | `/api/sync/clientes-receber` | Envia clientes pessoa física da loja ao sistema |
| GET | `/api/sync/clientes-alteracoes` | Lê alterações do sistema a partir do cursor |
| POST | `/api/sync/clientes-confirmar` | Confirma o cursor após aplicar |
| POST | `/api/sync/clientes-aplicar` | Ciclo completo sistema -> loja |
| POST | `/api/sync/reconciliar` | Rede de segurança (não é o caminho normal) |

Todas as rotas `/api/sync/*` exigem o header `X-API-Token`. O token nunca é
devolvido nem registrado em log.

## Sincronização de notas

1. O sorteio ativo é consultado **uma vez por ciclo** (id, número, início, fim).
2. As notas novas vêm do Lojamix com **cursor `id_nota_fiscal`**:
   `id_nota_fiscal > último processado`, `ORDER BY id_nota_fiscal ASC`.
   `data_hora_emissao` serve **somente** para conferir o período do sorteio.
3. Somente notas de **pessoa física** (`nota_fiscal -> entidade -> pessoa_fisica`).
   Pessoa jurídica fica fora; CNPJ nunca é usado.
4. `valor_total` é convertido para centavos (R$ 20,00 -> 2000).
5. O lote é enviado e depois confirmado. **O marcador local só avança após a
   confirmação** — sem confirmação, o lote é reenviado.
6. `registro_excluido` verdadeiro é descartado; `NULL` não é tratado como
   excluído.

### Identificação da nota (regra absoluta)

- Identidade lógica: **sorteio + `numero_documento_fiscal`**
- Validação: número + valor em centavos
- `origemId` (`id_nota_fiscal`) é apenas referência da origem
- CPF, CNPJ, nome, telefone e data **não** identificam nem validam a nota

### Cancelamentos

`id_situacao_documento_fiscal = 1` é venda normal e `3` é cancelada. A revisão
percorre a faixa já enviada (com marcador próprio que recicla ao terminar), por
isso uma nota já sincronizada **nunca** fica invisível a um cancelamento
posterior. O sistema atualiza a nota existente, marca a nota do participante
como cancelada e registra auditoria — nada é apagado e nenhuma nota nova é
criada.

## Sincronização de clientes

- **Loja -> sistema:** envia apenas o essencial (nome, CPF, telefone, data de
  nascimento, e-mail), com `id_entidade` como identificador permanente da
  origem. Nunca duplica e nunca exclui.
- **Sistema -> loja:** lê somente as alterações após o cursor oficial
  (`sorteio_sincronizacao_cursores`), aplica no SQL Server e **só então**
  confirma. Consulta completa de todos os clientes nunca acontece.

### Quem é enviado (regra obrigatória)

Um cliente só é enviado quando cumpre **todos** os critérios:

1. é pessoa física (`entidade -> pessoa_fisica`) — pessoa jurídica e CNPJ
   ficam totalmente fora;
2. tem CPF preenchido e válido (11 dígitos, dígitos verificadores conferidos);
3. tem telefone preenchido (celular com DDD ou telefone 1, somente dígitos);
4. tem **pelo menos uma nota fiscal no período do sorteio ativo** (mesmas
   regras das notas: não excluída, situação normal ou cancelada), ligada a
   ele por `nota_fiscal -> entidade -> pessoa_fisica`.

Cliente sem nota no período, sem CPF, sem telefone ou pessoa jurídica **não é
enviado**. A consulta usa `EXISTS` (nunca `JOIN`), então cliente com várias
notas não aparece duplicado. Nada é apagado: quem deixa de ser elegível
simplesmente não é enviado, e o cadastro já existente continua intacto.

### Duas passagens

1. **Cadastros novos** — varredura por `id_entidade` com o marcador
   `ultimo_id_entidade`.
2. **Cliente antigo que comprou agora** — a partir das notas do período na
   faixa `ultimo_id_nota_cliente < id_nota_fiscal <= maior id_nota_fiscal
   capturado no início do ciclo`. Assim um cliente de cadastro antigo que
   compra hoje é enviado sem depender de cadastro novo.

Os marcadores são independentes: `ultimo_id_nota` é exclusivo das notas e
nunca é lido pela passagem de clientes; `ultimo_id_nota_cliente` é exclusivo
da segunda passagem. Cada um avança e é gravado **somente depois** que o lote
é aceito pelo sistema — erro, timeout ou rejeição mantêm o marcador, e a
faixa é reprocessada.

### Reconciliação de elegibilidade

A rotina de reconciliação (rede de segurança, não o caminho normal) também
revê a faixa de cadastros com os **mesmos critérios**, cobrindo o caso do
cliente que já tinha nota no período e só depois ganhou CPF/telefone válido.
Ela não reenvia indiscriminadamente: apenas elegíveis, com envio idempotente.


### Normalização

- Texto de cadastro (nome, logradouro, bairro, complemento, cidade, observação,
  contato): **CAIXA ALTA, sem acentos, sem caracteres especiais**
  (João da Silva -> JOAO DA SILVA; Maria d'Ávila -> MARIA DAVILA).
- Campos estruturados têm regra própria: CPF/telefone/CEP só dígitos
  (123.456.789-00 -> 12345678900), e-mail em minúsculas, datas em ISO, valores
  em centavos.

## Marcadores (cursores)

- **Notas:** marcador local em JSON (`ESTADO_ARQUIVO`), gravado de forma atômica
  (arquivo temporário + `os.replace` + `fsync`) para não corromper em queda de
  energia. É apenas estado local: pode ser apagado, e a idempotência do sistema
  impede duplicidade.
- **Clientes (sistema -> loja):** o cursor oficial é o do sistema e só avança
  após aplicar e confirmar.

## Erros e reprocessamento

Falha de rede, timeout, queda ou erro do sistema **não** avançam o marcador:
`PENDENTE -> PROCESSANDO -> ERRO -> nova tentativa -> SINCRONIZADO`. O reenvio é
idempotente (mesmo `loteId` para a mesma faixa), então nada é duplicado.

## Segurança

- Credenciais só em variáveis de ambiente
- Senha, token e string de conexão nunca em log, erro ou `/health`
- CPF nunca completo em log (apenas os últimos dígitos)
- Toda consulta ao SQL Server é parametrizada
- Nenhuma exclusão de cliente ou nota
