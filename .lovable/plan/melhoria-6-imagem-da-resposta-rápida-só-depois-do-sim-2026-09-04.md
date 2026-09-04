# Melhoria 6 — Imagem da resposta rápida só depois do SIM

## Situação atual (verificada no código)

Quando o bot reconhece uma resposta rápida, ele já envia a pergunta de confirmação ("Você quer falar sobre *X*?") **junto com a imagem** configurada naquela resposta. Depois, se o cliente responder SIM, o texto da resposta é enviado **sem** a imagem.

## O que muda

- A pergunta de confirmação passa a ser enviada **apenas como texto** (com os botões SIM/NÃO), sem imagem.
- A imagem configurada na resposta rápida passa a ser enviada **junto com o texto da resposta**, ou seja, somente depois que o cliente digitar SIM.
- Se o cliente responder NÃO, nenhuma imagem é enviada.
- Respostas sem imagem continuam exatamente como hoje.

Nada mais muda: fluxos, primeiro contato, ações de SIM/NÃO, tempo de espera, layout e banco de dados permanecem iguais.

## Detalhes técnicos

- `src/lib/bot.server.ts`:
  - na triagem (envio da pergunta de confirmação, ~linha 1214), remover o argumento `midiaResposta(encontrada)`;
  - em `resolverTriagem`, ao enviar `textoResposta(resposta, primeiraDoDia)` após o SIM (~linha 1285), passar `midiaResposta(resposta)`.
- O encadeamento de respostas (ação "resposta") continua enviando texto + imagem como hoje.
- Ao final, marcar a melhoria 6 como executada (borda verde), mantendo o status "pendente".
