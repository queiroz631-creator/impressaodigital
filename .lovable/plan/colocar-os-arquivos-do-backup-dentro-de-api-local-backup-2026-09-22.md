# Colocar os arquivos do backup dentro de `api-local-backup`

## O que será feito

Os 7 arquivos do arquivo enviado (`BackupImpressaoDigital-main.zip`) serão copiados para dentro da pasta `api-local-backup/`, que hoje está vazia. A pasta intermediária `BackupImpressaoDigital-main/` do ZIP não é reproduzida — os arquivos ficam direto em `api-local-backup/`.

```text
api-local-backup/
├── .env.example
├── .gitignore
├── README.md
├── VERSION                (6.4.2)
├── backup_app_v6_4.py     (25 KB — programa de backup, interface Windows)
├── gerar_exe.bat
└── requirements.txt
```

## O que NÃO muda

- `api-local/` continua intacta (versão 1.1.7) — nada é movido, renomeado ou substituído nela.
- Nenhum programa é executado, nenhum pacote é instalado, nenhum servidor é iniciado.
- O ZIP não contém nada de loja, senhas ou chaves (o `.env.example` traz só um comentário), e não há pasta de histórico do Git dentro dele.
- Nada é enviado para o servidor, publicado ou commitado.

## Detalhes técnicos

- Extração do ZIP em `/tmp` para inspeção (já feita) e cópia dos 7 arquivos para `/dev-server/api-local-backup/`.
- O `.gitignore` do backup vale só para essa pasta: ignora `*.zip`, `*.exe`, `*.log`, `build/`, `dist/`, `.env`. Isso não afeta o restante do projeto.
- Conferência final: listagem da pasta (incluindo arquivos ocultos) comparada com a listagem do ZIP, confirmando os 7 arquivos e os mesmos tamanhos.
