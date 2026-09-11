# Plano — Comparar tamanho dos arquivos antes de pular na migração de Storage

## Objetivo
Ajustar `deploy/migrar-storage.sh` para que, ao encontrar um arquivo que já existe no destino, ele só seja pulado se o **tamanho** bater com o da origem. Se o tamanho for diferente (ou não puder ser confirmado), o arquivo será reenviado — evitando considerar como migrado um arquivo que foi enviado incompleto.

## O que muda no script (`deploy/migrar-storage.sh`)

1. **Listagem passa a guardar tamanho**
   - Hoje `list_objects()` devolve apenas nomes. Passará a devolver `nome -> tamanho em bytes` lendo o campo `metadata.size` que a API de listagem do Storage já retorna.
   - Aplica-se tanto à listagem da origem quanto à do destino.

2. **Lógica de "já migrado"**
   - Ao percorrer os arquivos da origem:
     - Não existe no destino → copiar.
     - Existe no destino **e tamanho igual** → pular (já migrado).
     - Existe no destino **e tamanho diferente, ausente ou zero** → reenviar.

3. **Upload com substituição**
   - O upload hoje usa `x-upsert: false`, que rejeita arquivos existentes. Para o caso de reenvio, o script tentará primeiro com `x-upsert: false` (arquivo novo) e, se a resposta indicar que já existe, fará nova tentativa com `PUT`/`x-upsert: true` para sobrescrever o arquivo incompleto.

4. **Relatório**
   - O resumo por bucket e o resumo geral passam a mostrar também a contagem de arquivos **reenviados por divergência de tamanho** (ex.: "Reenviados (tamanho diferente): N"), além de copiados, pulados e falhas.
   - Falhas continuam registradas em `/root/migrar-storage.log`.

5. **Documentação**
   - Atualizar a seção de migração do `deploy/README.md` para mencionar a verificação de tamanho.

## O que não muda
- Buckets, URLs padrão, variáveis de ambiente, buckets privados, preservação de caminhos, log de falhas e a garantia de que **nada é apagado na origem** (o Lovable segue como backup).
- Nenhuma alteração em banco de dados, telas ou código do sistema além do script e do README.

## Validação
- Rodar typecheck/build do projeto.
- O teste real do script segue sendo na VPS, na execução da migração.
