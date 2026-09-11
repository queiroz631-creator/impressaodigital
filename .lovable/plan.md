# Plano: Migrar os arquivos (Storage) para a VPS com script automatizado

## Cenário confirmado
- Supabase self-hosted **já está rodando** na VPS.
- Banco de dados já migrado pelo instalador (`deploy/install-migrate-one-command.sh`).
- Falta migrar os **arquivos físicos** do Storage — eles não vêm no backup do banco.
- Os arquivos antigos permanecem no Lovable como **backup** (nada será apagado).
- Lovable continua como ambiente de desenvolvimento; a VPS é a produção.

## O que será criado

### `deploy/migrar-storage.sh`
Script único, executado na VPS, que copia todos os arquivos do Storage do Lovable para o Supabase da VPS.

Comportamento:
- Lê a origem e o destino de variáveis de ambiente (nenhuma chave fica no código nem no Git).
- Percorre os buckets: `bot-midia`, `mensagens-rapidas`, `orcamento-arquivos`, `sistema`, `whatsapp`, `database_export_09_09_26`.
- Cria cada bucket no destino, sempre **privado**, se ainda não existir.
- Lista recursivamente todas as pastas e arquivos da origem.
- Baixa e reenvia cada arquivo **mantendo exatamente o mesmo caminho**, para que os caminhos já gravados no banco continuem válidos.
- Pula arquivos que já existem no destino, permitindo rodar novamente sem duplicar.
- Mostra progresso por bucket e um resumo final: copiados, pulados e falhas.
- Grava um log em `/root/migrar-storage.log` com os arquivos que falharam, para reprocessar.
- **Não apaga nada na origem.**

### `deploy/README.md`
Nova seção explicando:
- Como definir as variáveis de origem e destino antes de rodar.
- O comando de execução.
- Como conferir o resultado e reprocessar falhas.

## Como você vai usar

1. Na VPS, informar os dados de origem (Lovable) e destino (VPS) como variáveis de ambiente.
2. Rodar:
   ```bash
   cd /var/www/impressaodigital
   bash deploy/migrar-storage.sh
   ```
3. Conferir o resumo final e, se houver falhas, rodar o mesmo comando novamente.

## Validação depois da migração
- Abrir uma conversa antiga no WhatsApp e visualizar uma imagem recebida.
- Baixar um documento antigo de um orçamento.
- Abrir uma mensagem rápida com imagem.
- Ver a foto de um currículo antigo.
- Enviar um arquivo novo e confirmar que ele grava no Storage da VPS.

## Fora de escopo
- Nenhuma alteração no banco, nas telas ou nas regras do bot.
- Nada será removido do Lovable — os arquivos ficam como backup.

## Detalhes técnicos
- O script usa Python 3 (já presente na VPS) com a API REST do Storage do Supabase (`/storage/v1`), autenticando com a `service_role key` de cada lado.
- Origem: `https://qmnienngwksbeiyczrka.supabase.co` + chave de serviço do Lovable (fornecida por você em variável de ambiente, pois não fica acessível no código).
- Destino: `https://supabase.queiroztecno.com.br` + `SERVICE_ROLE_KEY` lida de `/root/supabase-project/.env`.
- Listagem paginada (`POST /storage/v1/object/list/<bucket>`) com recursão por prefixo; download via `/object/<bucket>/<path>`; upload via `POST /object/<bucket>/<path>` preservando `content-type`.
- Criação de bucket via `POST /storage/v1/bucket` com `public: false`; erro de bucket existente é ignorado.
- As chaves são lidas apenas de variáveis de ambiente e do `.env` local; nunca são impressas nem gravadas no repositório.
