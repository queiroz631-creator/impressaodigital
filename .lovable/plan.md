# Arquivo de controle de agendamentos

Criar um pequeno arquivo de status que o sistema consulta a cada 5 minutos, em vez de ficar consultando o banco o tempo todo.

## Como vai funcionar

- Existe um arquivo único, `agendamentos/status.json`, guardado numa pasta de arquivos do sistema.
- Ele guarda coisas simples: data da última atualização, se há agendamento pendente, quantos, o próximo horário e a lista de recorrentes.
- Toda vez que alguém cria, altera ou cancela um agendamento (inclusive os recorrentes), o arquivo é regravado na hora.
- A cada 5 minutos o sistema lê só esse arquivo. Se nada mudou, nada acontece e o banco não é consultado.
- Se o arquivo não existir ainda, o sistema o cria automaticamente na primeira leitura, a partir dos dados atuais.

## Observação importante

O servidor deste projeto não guarda arquivos gravados em disco entre uma requisição e outra — o que é escrito se perde. Por isso o "arquivo" fica na área de arquivos do backend (mesma ideia: uma pasta e um arquivo), que é rápida, barata e não usa o banco em cada leitura. O comportamento que você pediu é exatamente o mesmo.

## Detalhes técnicos

- Bucket privado `sistema` (Storage), caminho `agendamentos/status.json`.
- `src/lib/agenda-status.functions.ts`:
  - `lerStatusAgenda()` — baixa o JSON; cache em memória do worker com TTL de 60s; se ausente/corrompido, reconstrói via `regravarStatusAgenda()`.
  - `regravarStatusAgenda()` — consulta o banco uma vez, monta o JSON e faz upload com `upsert: true`.
- Formato:
  ```json
  {
    "atualizado_em": "2026-09-06T02:00:00Z",
    "versao": 12,
    "tem_pendente": true,
    "total_pendentes": 3,
    "proximo_em": "2026-09-06T09:00:00Z",
    "recorrentes": [{ "id": "...", "cron": "0 9 * * 1", "ativo": true }]
  }
  ```
- Poll de 5 min no cliente via `useQuery` com `refetchInterval: 300000` chamando `lerStatusAgenda`; reage apenas quando `versao` muda.
- Rota `src/routes/api/public/hooks/agenda-status.ts` (POST, valida token) para o pg_cron regravar o arquivo caso algo mude fora do app.
- Nenhuma tela ou lógica existente é alterada.
