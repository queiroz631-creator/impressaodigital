# Melhoria 11 — Anotações por cliente no WhatsApp

## Objetivo

Permitir anotar informações sobre cada cliente diretamente na tela de conversa do WhatsApp. A anotação nunca é apagada automaticamente e pode ser editada sempre que necessário.

## Como vai funcionar

- Uma **coluna lateral à direita** da conversa aberta, dedicada às anotações do cliente.
- A coluna pode ser **recolhida/expandida** por um botão (ícone de nota) no cabeçalho da conversa; a preferência (aberta ou recolhida) fica salva no navegador.
- Dentro da coluna: campo de texto com a anotação e botão **Salvar**. Editar é só alterar o texto e salvar de novo.
- A anotação é por **cliente (telefone)**, não por atendimento: aparece igual em qualquer conversa daquele número.

## Detalhes técnicos

- Nova tabela `whatsapp_notas`: `id`, `telefone` (único), `nota` (texto), `created_at`, `updated_at`; GRANTs para `authenticated`/`service_role`, RLS habilitada com política para usuários autenticados.
- `src/routes/whatsapp.tsx`: painel lateral direito dentro da área da conversa, query que busca a nota pelo `telefone`, mutação de upsert (`onConflict: telefone`), estado de recolher/expandido persistido em `localStorage`.
- Sem alteração no bot, webhook ou outras telas; layout da lista de contatos e abas permanece igual.
- Ao final: typecheck/build e marcar a melhoria 11 como executada.
