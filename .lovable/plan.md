# Status do WhatsApp na tela Configurar Bot

Nova aba "Status WhatsApp" para criar e programar publicações automáticas no status do WhatsApp (texto, imagem ou vídeo), publicadas sozinhas na hora marcada.

## O que a aba terá

- Botão "Novo status" com formulário:
  - Tipo: Texto, Imagem ou Vídeo
  - Texto/legenda
  - Envio do arquivo (imagem ou vídeo) direto pela tela
  - Cor de fundo e fonte (apenas para status de texto)
  - Agendamento:
    - Data e hora únicas (publica uma vez), ou
    - Recorrente: dias da semana + horário (repete sempre)
  - Ativo/inativo
- Lista dos status programados mostrando tipo, prévia do conteúdo, quando publica, último envio e resultado
- Ações: editar, ativar/desativar, duplicar, excluir e "Publicar agora" para testar

## Como funciona a publicação

- A cada 5 minutos o sistema verifica se algum status chegou na hora e publica no WhatsApp.
  Isso significa que um status marcado para 09:00 sai entre 09:00 e 09:05, e essa verificação
  contínua mantém o banco ativo, o que tem um pequeno custo recorrente. Se preferir, dá para
  checar de hora em hora e você agenda só em horas cheias.
- Cada publicação é registrada (sucesso ou erro) e um status de data única é marcado como concluído para não repetir.
- Recorrentes não repetem no mesmo dia/horário, mesmo que a verificação rode várias vezes.

## Detalhes técnicos

- Nova tabela `whatsapp_status_agendados`: tipo (`texto|imagem|video`), texto, `midia_url`, `midia_path`, cor de fundo/fonte, `modo` (`unico|recorrente`), `agendado_em` (timestamptz), `dias_semana` (int[]), `hora` (time), `ativo`, `enviado_em`, `ultimo_resultado`, `ultimo_erro`, timestamps. GRANTs para `authenticated`/`service_role`, RLS liberando usuários autenticados (mesmo padrão das outras tabelas do bot), trigger `set_updated_at`.
- Arquivos de mídia vão para um bucket privado novo `whatsapp-status`, com URL assinada gerada no momento do envio.
- `src/lib/zapi.server.ts`: funções `enviarStatusTexto`, `enviarStatusImagem`, `enviarStatusVideo` usando os endpoints Z-API `send-text-status`, `send-image-status`, `send-video-status` via `chamarZapi` já existente.
- Nova rota `src/routes/api/public/whatsapp/status.ts` (POST): valida o `webhook_token` já usado na fila, busca agendamentos vencidos, publica e grava resultado; idempotente.
- `pg_cron` chamando essa rota a cada 5 minutos (via `run_sql`, não migração).
- Novo componente `src/components/bot/StatusWhatsappPainel.tsx` + nova `TabsTrigger`/`TabsContent` em `src/components/ConfiguracaoBot.tsx`. Server function `publicarStatusAgora` em `src/lib/whatsapp.functions.ts` para o botão de teste.
- Nenhuma alteração no layout existente, no motor do bot ou em outras abas.
