# Corrigir o botão "Últimos Arquivos" no WhatsApp

## Problemas encontrados
1. **Troca de conversa perde a seleção:** quando o atendimento mais recente é outra conversa, a tela abre essa conversa do zero e esquece o pedido de "selecionar ao carregar". O modo de seleção abre vazio.
2. **Arquivos fora do dia não entram:** a conversa mostra só as mensagens do dia. Se o atendimento começou antes, os arquivos marcados não estão na lista carregada, e "Baixar" e "Calculadora" (que procuram na lista carregada) ignoram esses arquivos ou não encontram nada.
3. **Leitura limitada a 1000 mensagens:** a busca pega as mensagens da mais antiga para a mais nova. Em conversas longas, as mais recentes (as do último atendimento) ficam de fora. Hoje a maior conversa tem 650 mensagens, mas o limite vai ser atingido.

## Correção (somente na tela do WhatsApp)
- A busca do último atendimento passa a ler de trás para frente, parando no último marcador "ATENDIMENTO N". Assim o limite de 1000 mensagens deixa de ser um problema.
- Os arquivos encontrados (id e nome) ficam guardados junto com a seleção. Com isso, "Baixar" e "Calculadora" funcionam mesmo quando a mensagem não está carregada na tela.
- Quando é preciso abrir outra conversa, a seleção vai junto com ela, e a conversa nova já abre com o modo de seleção ligado e os arquivos marcados.
- A regra continua a mesma: só arquivos recebidos do cliente, a partir do último "ATENDIMENTO N", na conversa mais recente do número.
- **Mensagens apagadas ficam de fora:** arquivos de mensagens marcadas como apagadas não são selecionados pelo botão (a busca passa a trazer o campo `apagada` e ignora essas linhas).
- O nome do botão e o visual da tela ficam como estão.

## Detalhes técnicos
- `src/routes/whatsapp.tsx`:
  - Em `abrirUltimosArquivos`, a consulta fica `order("data_hora", desc)` e inclui `arquivo_nome` e `data_hora`. O código percorre até achar o marcador e monta a lista `{id, nome}`.
  - O estado `selecionadosInfo: Map<id, nome>` fica no componente pai. Ele é passado para `Conversa` como seleção inicial (`selecaoInicial`) e consumido na montagem (o `key` remonta o componente).
  - `baixarSelecionados` e `enviarParaCalculadora` usam o nome guardado quando a mensagem não está carregada.
- O banco, o bot e o webhook não mudam.

## Verificação
- Checagem de tipos e build.
- No preview: clicar em "Últimos Arquivos" numa conversa antiga do mesmo número e confirmar que a conversa mais recente abre com os arquivos do último atendimento marcados, e que "Calculadora" os recebe.
