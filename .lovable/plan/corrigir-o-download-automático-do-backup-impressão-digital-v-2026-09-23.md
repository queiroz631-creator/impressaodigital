# Corrigir o download automático do Backup Impressão Digital (V6.4.2)

## O problema

Na verificação automática, o programa chama `self.download(...)`, mas esse método
não existe — o nome certo é `self.start_download(...)`. Resultado: quando aparece
um backup novo no servidor, o modo automático falha em silêncio (o erro vai só
para o `backup.log`) e o arquivo não é baixado sozinho. O download manual pelos
botões funciona normalmente.

## A correção

Arquivo: `api-local-backup/backup_app_v6_4.py`, função `_auto_check` (linha 639).

Trocar:

```python
self.root.after(0, lambda n=filename: self.download(n, automatic=True))
```

por:

```python
self.root.after(0, lambda n=filename: self.start_download(n, automatic=True))
```

Uma única linha alterada. Nada mais muda: barra de progresso, bandeja,
configuração, log e download manual continuam exatamente iguais.

## Depois de corrigir

- O arquivo corrigido fica pronto na pasta `api-local-backup/` do projeto.
- Para valer na máquina da loja, é preciso gerar um novo EXE com o
  `gerar_exe.bat` e substituir o programa instalado — se quiser, posso já
  atualizar o `VERSION` para 6.4.3 e anotar a correção no `README.md`.

## O que NÃO será feito

- Nenhuma alteração em `api-local/` (Lojamix Sync), no site ou no banco.
- Nenhum programa é executado, nenhum EXE é gerado aqui.
- Sem commit, push, deploy ou publicação.
