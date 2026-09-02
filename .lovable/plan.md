# Cabeçalho "🤖 mensagem do bot" em itálico nas respostas do bot

## Objetivo
Adicionar o cabeçalho _🤖 mensagem do bot_ em itálico no início de toda mensagem enviada pelo bot no WhatsApp.

## O que será alterado
- `src/lib/bot.server.ts`: na função `responder`, prefixar cada mensagem enviada com `_🤖 mensagem do bot_` seguido de duas quebras de linha, antes do texto original e do complemento de botões.

## Formato no WhatsApp
O itálico no WhatsApp usa underscores (`_texto_`). O cabeçalho será renderizado como:

```
🤖 mensagem do bot

<Texto original da resposta>
```

Em itálico na primeira linha.

## Escopo
- Aplica-se a todas as mensagens de texto enviadas pela função `responder` (menu, respostas automáticas, perguntas do fluxo de orçamento, transferências, etc.).
- Também aparece nas legendas de imagens, vídeos e documentos enviados pelo bot, pois eles reutilizam a mesma função.
- Não altera mensagens enviadas por atendentes humanos.

## Implementação
1. Abrir `src/lib/bot.server.ts`.
2. Localizar a montagem da mensagem dentro de `responder`:
   ```ts
   const complemento = botoes && botoes.length > 0 ? `\n\n_Responda: ${botoes.join(" ou ")}_` : "";
   const mensagem = `${texto}${complemento}`;
   ```
3. Substituir por:
   ```ts
   const cabecalho = "_🤖 mensagem do bot_";
   const complemento = botoes && botoes.length > 0 ? `\n\n_Responda: ${botoes.join(" ou ")}_` : "";
   const mensagem = texto.trim() ? `${cabecalho}\n\n${texto}${complemento}` : cabecalho;
   ```
4. Verificar build e tipos.
5. (Opcional) Testar no simulador de bot para confirmar a renderização do itálico.
