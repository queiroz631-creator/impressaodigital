# Corrigir a pesquisa de conversas no WhatsApp

## O problema (confirmado em teste)

Ao digitar qualquer texto na busca (ex.: "Gilliany"), a lista não filtra — ao contrário, ela passa a mostrar **todas** as conversas. Testando na tela ao vivo: antes de digitar a aba mostrava poucos contatos; depois de digitar, apareceram todas as 163 conversas.

Causa: a busca compara o termo também com o telefone, removendo tudo que não é número. Quando a pessoa digita um nome ou uma palavra, sobra uma sequência vazia — e "todo telefone contém texto vazio", então cada conversa é considerada correspondente.

## O que será feito

Ajuste apenas em `src/routes/whatsapp.tsx`, na regra de filtragem da lista de contatos:

1. Comparar com telefone somente quando o termo digitado tiver dígitos; caso contrário, ignorar essa comparação (elimina o "casa com tudo").
2. Manter e melhorar a comparação por nome (sem acento, minúsculo) e por conteúdo das mensagens.
3. Busca por conteúdo: aplicar a mesma normalização de acento no lado do cliente e considerar também nome de arquivo e transcrição de áudio, para "palavra da conversa" funcionar de fato.
4. Quando o termo tiver menos de 3 caracteres, continuar filtrando por nome/telefone (hoje já é assim) — a busca em mensagens continua a partir de 3 caracteres.

## Detalhes técnicos

- Filtro atual em `whatsapp.tsx` (~linhas 310-329): trocar `telefone.includes(termo.replace(/\D/g, ""))` e `formatarTelefone(...).includes(busca.trim())` por comparações condicionadas a `const digitos = termo.replace(/\D/g, "")` com `digitos.length > 0`.
- Consulta de mensagens (`whatsapp_mensagens`): manter `ilike` no `texto`, acrescentando `arquivo_nome` e `transcricao` via `.or(...)`, mantendo o limite atual.
- Nenhuma alteração de layout, de banco de dados ou de lógica do bot.
