# Backup da API da loja (pasta api-local)

## O que fazer

Gerar um arquivo `.zip` com o conteúdo completo da pasta `api-local/` e salvá-lo na
pasta de arquivos do projeto (Files), com o nome:

```text
api-local-backup-2026-09-15.zip
```

Depois disso a pasta `api-local/` pode ser apagada do projeto sem risco: o
programa continua salvo no `.zip`.

## O que entra no backup

Os 27 arquivos que existem hoje na pasta:

```text
api-local/
  README.md            manual em português (instalação, configuração, endpoints)
  requirements.txt     lista das bibliotecas necessárias
  .env.example         modelo de configuração sem nenhuma senha
  .gitignore
  app/
    main.py            programa principal (endereço de verificação /health + rotas)
    config.py          leitura das variáveis de ambiente
    database.py        conexão com o banco da loja
    repositories/      consultas ao Lojamix (notas e clientes)
    services/          regras de sincronização (notas, clientes, lotes, sistema)
    routes/            rotas de sincronização + verificação de token
    schemas/           validação dos dados que chegam
    utils/             normalização de texto, estado local, registros de log
```

## O que NÃO entra

- `.env` com senhas reais — esse arquivo não existe no projeto (as credenciais
  são preenchidas só na máquina da loja), então nada sensível vai para o `.zip`.
- Pastas temporárias do Python — também não existem hoje.

## Consequência de apagar a pasta depois

Nada no site é afetado. O site (páginas, login, sorteios, portal público,
validação das notas, agendamentos e o banco) é feito em React e não usa nenhum
arquivo dessa pasta — ela é um programa separado, em Python, que roda na
máquina da loja e conversa com o site pela internet.

O que se perde ao apagar é apenas o código do programa da loja. Ele pode ser
recuperado descompactando o `.zip`, ou reescrito pelo histórico do projeto.

## Como usar o backup na máquina da loja

1. Descompactar o `.zip`.
2. Instalar as bibliotecas: `pip install -r requirements.txt`.
3. Copiar `.env.example` para `.env` e preencher o banco da loja, o endereço do
   site e o token.
4. Executar o programa conforme o `README.md`.

## Fora deste plano

- Nenhuma alteração em código do site, banco, rotas, regras de sorteio,
  WhatsApp ou publicações.
- A pasta `api-local/` não é apagada por mim — quem apaga é você, quando quiser.
