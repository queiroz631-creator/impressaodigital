# Configurar Fluxo — tela única e etapas com mídia

Reorganiza BOT → FLUXOS → CONFIGURAR FLUXO para que tudo do fluxo e de cada etapa seja
configurado em um só lugar, e amplia a etapa para enviar texto, imagem, áudio, vídeo ou
documento. Nenhuma outra lógica do bot, Z-API, IA, orçamento, currículo ou pedidos muda.

## 1. Lista de fluxos

- Remover o botão EDITAR do card do fluxo. Ficam CONFIGURAR, DUPLICAR, ATIVAR/DESATIVAR e excluir.
- Criar fluxo continua abrindo o formulário atual e, ao salvar, entra direto em CONFIGURAR.

## 2. Tela CONFIGURAR FLUXO

Uma página única, sem abas de navegação separando o essencial:

```text
[< Voltar]  🤖 FLUXO: ORÇAMENTO

DADOS DO FLUXO (cartão editável, salva no mesmo lugar)
  nome · descrição · ícone · ativo

ETAPAS (cartões na ordem, com subir/descer/excluir)
  ETAPA 1 — Boas-vindas       [texto]      [expandir]
    ao expandir: todos os campos da etapa + opções, editados na própria tela
  [+ ADICIONAR ETAPA]

VISUALIZAÇÃO / TESTAR FLUXO  (mantidos como estão, ao final da página)
```

Cada etapa é editada inline (cartão expansível) em vez de diálogo, com botão SALVAR ETAPA
por cartão. O diálogo separado de opção deixa de existir.

## 3. Campos de cada etapa

- Nome da etapa.
- **Tipo de mensagem**: texto, imagem, áudio, vídeo ou documento.
  - texto: só o campo de texto.
  - imagem/áudio/vídeo/documento: campo de anexo (upload) + campo de texto/legenda.
- **Próxima etapa — como avança**:
  - Automaticamente → mostra "tempo de espera (segundos)".
  - Após qualquer resposta do cliente.
  - Após o cliente escolher uma das opções desta etapa.
- Ação da etapa e destino (fluxo/etapa) como já existe hoje.
- **Opções**: botão ADICIONAR OPÇÃO na própria etapa; cada opção com título, valor, ação,
  destino de fluxo/etapa e ativo — as mesmas configurações de hoje, sem sair da tela.

## 4. Envio pelo bot

- Etapa de texto continua igual.
- Etapa com mídia: o bot envia o arquivo pelo endpoint correspondente da Z-API
  (imagem, áudio, vídeo, documento) com a legenda, e registra a mensagem no histórico
  da conversa como hoje.
- Avanço automático: o bot aguarda o tempo configurado e segue para a próxima etapa
  sem esperar o cliente. Espera limitada a 60 segundos por etapa (o webhook precisa
  responder); tempos maiores ficam limitados a esse teto.
- Quando o fluxo está em "mensagem única", os textos continuam sendo unidos; a mídia
  vai em um envio próprio com a legenda junto.

## Detalhes técnicos

Banco (`bot_fluxo_etapas`), colunas novas com padrão compatível:
- `tipo_mensagem text not null default 'texto'`
- `midia_url text`, `midia_nome text`
- `modo_avanco text not null default 'resposta'` (automatico | resposta | opcao)
- `espera_segundos integer not null default 0`

Storage: bucket público `bot-midia` para os anexos das etapas, com política de upload
para usuários autenticados e leitura pública (a Z-API precisa baixar o arquivo por URL).

Código:
- `src/lib/bot-fluxos.ts`: novos campos em `FluxoEtapa`, catálogo `TIPOS_MENSAGEM` e `MODOS_AVANCO`.
- `src/lib/bot-motor.ts`: `MensagemBot` ganha `midia?: { tipo, url, nome }`.
- `src/lib/bot-fluxos-motor.ts`: monta a mensagem conforme `tipo_mensagem`; `aguardaResposta`
  passa a considerar `modo_avanco`; avanço automático devolve a espera na saída.
- `src/lib/bot.server.ts`: `responder` passa a escolher `send-text`, `send-image`, `send-audio`,
  `send-video` ou `send-document` conforme a mídia; aplica a espera antes do envio seguinte.
- `src/components/bot/FluxoConfigurador.tsx`: reescrito para a tela única com etapas e opções inline.
- `src/components/bot/FluxosPainel.tsx`: remove o botão EDITAR e leva os dados do fluxo para dentro do configurador.
