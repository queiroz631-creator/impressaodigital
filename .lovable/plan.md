# Criar a pasta vazia api-local-backup na raiz do projeto

## O que será feito

Criar a pasta `api-local-backup/` na raiz do projeto (ao lado de `api-local/`),
vazia, sem nenhum arquivo dentro.

```text
raiz do projeto/
  api-local/            (o programa da loja — não é tocado)
  api-local-backup/     (nova, vazia)
```

## Verificação já feita

- `api-local-backup/` ainda não existe na raiz.
- `api-local/` existe e continuará intacta.

## O que NÃO será feito

- Nenhum arquivo criado dentro da pasta (ela fica vazia, como pedido).
- Nada é movido, copiado ou apagado — `api-local/` permanece como está.
- Nenhuma alteração no site, no banco, em rotas ou em qualquer outro código.
- Nenhum commit, push, deploy ou publicação.

## Detalhe técnico (para saber depois)

O controle de versões do projeto não guarda pastas vazias: uma pasta sem
arquivo dentro pode sumir quando o projeto é copiado ou clonado em outra
máquina. Se a intenção for guardar arquivos de backup ali, ela já serve bem
assim. Se quiser que a pasta exista sempre, mesmo vazia, é só me pedir que eu
coloco um arquivo marcador (` .gitkeep`) dentro dela.
