# WhatsApp: abrir a conversa mostrando só o dia de hoje

## O que muda para quem atende

Ao abrir uma conversa, a tela passa a mostrar apenas as mensagens **de hoje**. No topo da conversa aparece um botão **"Carregar mensagens anteriores"**, que traz mais um trecho do histórico a cada clique (do mais recente para o mais antigo). Quando não houver mais nada para trazer, o botão é trocado por um aviso discreto de "Início da conversa".

Detalhes de comportamento:

- Se a conversa não tiver nenhuma mensagem de hoje, a tela já abre com o último trecho do histórico (as mensagens mais recentes), para não ficar vazia.
- Ao carregar mensagens anteriores, a posição da leitura é mantida — a tela não pula para o fim.
- Mensagens novas que chegam continuam aparecendo na hora e a tela continua descendo sozinha para a última, como hoje.
- Trocar de conversa recomeça mostrando só o dia atual.
- Nada muda no envio de mensagens, nos arquivos, na seleção para ZIP, nos status ou nas cores.

## Detalhes técnicos

Arquivo: `src/routes/whatsapp.tsx` (componente da conversa, hoje na consulta `["whatsapp-mensagens", conversa.id]`).

- Novo estado `limiteAnterior` (ex.: `corteMs: number | null`) por conversa, reiniciado em `useEffect` quando `conversa.id` muda.
- A consulta passa a receber o corte na chave: `["whatsapp-mensagens", conversa.id, corte]`.
  - Corte inicial = início do dia local (00:00 de hoje) → `.gte("data_hora", inicioDoDia)`.
  - "Carregar anteriores" busca o lote anterior com `.lt("data_hora", corteAtual)`, `.order("data_hora", { ascending: false })`, `.limit(50)`, e move o corte para a `data_hora` da mensagem mais antiga retornada; os lotes são acumulados e reordenados em ordem crescente.
  - Quando o lote vem com menos de 50 itens, marca `semMais = true` e o botão é substituído pelo aviso de início.
- Se a primeira consulta do dia retornar vazia, dispara automaticamente um lote anterior (uma vez) para não exibir tela vazia.
- Auto-scroll: manter o `scrollIntoView` atual apenas quando a última mensagem muda; ao prepender lote antigo, preservar `scrollHeight - scrollTop` antes/depois.
- O polling de 4s e o realtime seguem revalidando só o trecho já carregado (a chave inclui o corte), sem perder o histórico aberto.
- Nenhuma mudança de banco, RLS ou server function.
