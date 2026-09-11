# Backup completo do Storage

Objetivo: gerar um arquivo compactado com todos os arquivos de todos os buckets do backend, pronto para download e envio à VPS.

## O que será feito

1. Listar todos os buckets do backend e, dentro de cada um, todos os arquivos (inclusive subpastas).
2. Baixar cada arquivo mantendo a estrutura de pastas em `storage/<bucket>/<caminho>`.
3. Compactar tudo em um único arquivo `.zip` salvo em `/mnt/documents`, que aparece no chat para download.
4. Gerar um relatório `storage-backup-relatorio.txt` com: total por bucket, tamanho total e lista de eventuais falhas.
5. Nada é apagado nem alterado no backend — apenas leitura.

## Restauração na VPS

O script `deploy/migrar-storage.sh` hoje copia direto de origem para destino via chave de serviço, que não é acessível no Lovable Cloud. Será adicionado um modo alternativo de leitura local:

- nova variável `LOCAL_DIR=/caminho/storage` faz o script ler os arquivos da pasta descompactada em vez da origem remota;
- mantém tudo o que já existe: criação dos buckets como privados, preservação de caminhos, comparação de tamanho antes de pular, reenvio de arquivos incompletos e log em `/root/migrar-storage.log`;
- `deploy/README.md` recebe as instruções desse novo modo (descompactar o zip na VPS e rodar com `LOCAL_DIR`).

## Detalhes técnicos

- Buckets esperados: `bot-midia`, `mensagens-rapidas`, `orcamento-arquivos`, `sistema`, `whatsapp`, `database_export_09_09_26` (a lista real é obtida do backend no momento do backup).
- Download feito no ambiente do projeto, que já tem acesso privilegiado ao Storage — sem necessidade de expor chaves.
- Se o zip ficar muito grande, será dividido em partes por bucket, entregues como arquivos separados.

## Fora do escopo

Sem mudanças no banco, na interface, no bot ou nas políticas de acesso.
