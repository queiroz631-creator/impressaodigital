# WhatsApp: largura ajustável da lista e contador de finalizados do dia

## 1. Ajustar a largura da coluna esquerda

- Uma alça fina entre a lista de contatos e a conversa permite arrastar para aumentar ou diminuir a lista (limites de 260px a 560px).
- A largura escolhida é salva no navegador e reaplicada automaticamente na próxima vez que a tela for aberta.
- Duplo clique na alça volta à largura padrão (340px).
- No celular nada muda: a lista continua ocupando a tela inteira.

## 2. Contador da aba "Finalizado"

- O número ao lado do ícone da aba Finalizado passa a contar apenas os atendimentos finalizados hoje (mesma regra já usada na listagem: data de finalização, ou data de criação quando não houver).
- Demais abas continuam contando todas as conversas do status.
- O botão "Mostrar todas (n de outros dias)" continua funcionando igual.

## Detalhes técnicos

- Alteração somente em `src/routes/whatsapp.tsx` (apresentação); sem mudanças de banco, server functions ou lógica do bot.
- Substituir `grid-cols-[340px_1fr]` por grid com largura dinâmica (`gridTemplateColumns: \`${largura}px 6px 1fr\``), com um divisor arrastável usando eventos de ponteiro.
- Estado `larguraLista` inicializado a partir de `localStorage` (chave `whatsapp:largura-lista`) dentro de `useEffect` para evitar divergência de hidratação; gravação a cada ajuste.
- No `useMemo` de `contagem`, tratar `finalizado` comparando `new Date(c.data_finalizacao ?? c.created_at).toDateString()` com hoje.
