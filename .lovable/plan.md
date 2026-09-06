# Status do WhatsApp com arquivo de controle

Nova aba "Status WhatsApp" em Configurar Bot para programar textos e imagens que vão automaticamente para o Status do WhatsApp, e um arquivo de controle que evita consultar o banco a cada verificação.

## O que você vai poder fazer

- Cadastrar publicações de status: texto (com cor de fundo) ou imagem com legenda.
- Escolher quando publicar:
  - uma vez, em data e hora escolhidas;
  - recorrente: dias da semana + horário (ex.: seg/qua/sex às 09:00).
- Ativar/desativar cada publicação, editar, duplicar e excluir.
- Ver a última publicação feita, o próximo horário e se deu erro.
- Botão "Publicar agora" para testar na hora.

## O arquivo de controle

- Um arquivo único, `status-whatsapp/agenda.json`, guardado na área de arquivos do sistema.
- Ele guarda: data da última atualização, uma versão, o próximo horário a publicar e a lista resumida dos agendamentos ativos.
- É regravado sempre que você cria, edita, ativa/desativa ou exclui uma publicação, e depois de cada envio.
- A verificação automática roda de 5 em 5 minutos e lê só esse arquivo. Se o próximo horário ainda não chegou, ela termina ali, sem tocar no banco.
- Se o arquivo não existir ou estiver inválido, o sistema o recria a partir dos dados atuais.

Observação: o servidor não guarda arquivos gravados em disco entre uma requisição e outra, então esse arquivo fica na área de arquivos do backend — mesma ideia de pasta + arquivo, com leitura rápida e barata.

## Custo da verificação

A verificação a cada 5 minutos roda 288 vezes por dia. É o mínimo para um status sair perto do horário programado; graças ao arquivo, quase todas essas execuções não consultam o banco.

## Detalhes técnicos

- Tabela `bot_status_whatsapp`: `tipo` (texto | imagem), `texto`, `cor_fundo`, `imagem_url`, `legenda`, `modo` (uma_vez | recorrente), `agendado_em`, `dias_semana` (int[]), `hora`, `ativo`, `ultima_publicacao_em`, `ultimo_erro`, timestamps + trigger `set_updated_at`, GRANTs e RLS (leitura/escrita para `authenticated`, tudo para `service_role`).
- Imagens vão para o bucket existente `bot-midia`.
- Bucket novo e privado `sistema` para `status-whatsapp/agenda.json`.
- `src/lib/status-whatsapp.server.ts`: `lerAgenda()` (download + cache em memória de 60s; recria se faltar), `regravarAgenda()` (uma consulta ao banco, upload com `upsert: true`), `publicarStatus(registro)` chamando a Z-API (`send-text-status` / `send-image-status`) via `chamarZapi`.
- `src/lib/status-whatsapp.functions.ts`: CRUD autenticado (`requireSupabaseAuth`) + `publicarAgora`; toda escrita chama `regravarAgenda()`.
- Rota `src/routes/api/public/whatsapp/status-agenda.ts` (POST, valida `token` igual ao webhook): lê o arquivo, sai cedo se não há nada vencido, senão publica os pendentes, calcula o próximo horário e regrava o arquivo.
- `pg_cron` a cada 5 minutos chamando essa rota com `pg_net`.
- UI: `src/components/bot/StatusWhatsappPainel.tsx`, adicionada como nova aba em `src/components/ConfiguracaoBot.tsx`. Nenhuma tela ou fluxo existente é alterado.
