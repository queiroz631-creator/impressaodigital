# Melhoria 23 — Mensagem automática do link do currículo

Hoje a frase enviada junto com o link do currículo está fixa no código:
"Para montar seu currículo, é só preencher por aqui: {link} — O link vale por 24 horas."
Ela passa a ser editável.

## O que muda

**Configurar Bot > Mensagens**
- Novo campo "Link do currículo", junto das demais mensagens, com o texto atual já preenchido.
- Aceita a variável `{link}` (onde o endereço do currículo entra) e as variáveis já usadas nas outras mensagens.
- Se o campo ficar vazio, o robô volta a usar o texto padrão, para nunca enviar um link sem explicação.

**Robô**
- Sempre que o robô enviar o link do currículo (menu, fluxo ou ação "gerar link"), usa a frase configurada.

**Tela Currículos**
- Ao gerar o link do novo currículo, o sistema copia a frase completa já com o link (em vez de só o endereço).
- A janela do link continua mostrando o endereço e a validade; ganha também a opção de copiar apenas o endereço.

## Detalhes técnicos

- Migração: nova coluna `msg_link_curriculo text not null default ''` em `whatsapp_config`.
- `src/lib/bot.server.ts` (`acaoCurriculo`): lê a mensagem da configuração já carregada, aplica `{link}` e as variáveis existentes; usa o texto padrão quando vazia. Mensagem de erro atual permanece igual.
- `src/components/ConfiguracaoBot.tsx`: campo novo na lista de mensagens (mesmo padrão dos demais, com dica das variáveis) e inclusão no salvamento.
- `src/lib/curriculo.functions.ts` / `curriculo.server.ts`: `gerarLinkNovo` passa a devolver também a frase pronta com o link.
- `src/routes/curriculos.index.tsx`: copia a frase pronta e mostra botão "Copiar só o link".
- Sem mudanças no layout geral, em fluxos, respostas automáticas ou no restante do bot.
- Ao final, marcar a melhoria "Mensagem automatica" (Currículo Vitae) como executada, mantendo `status = 'pendente'`.
