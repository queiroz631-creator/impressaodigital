# Melhoria 11 — Anotações por cliente no WhatsApp

## Objetivo

Permitir anotar informações sobre cada cliente diretamente na conversa do WhatsApp.
A anotação nunca é apagada automaticamente e pode ser editada sempre que necessário.

## Como vai funcionar

- Um botão com ícone de nota no cabeçalho da conversa aberta (ao lado das ações já existentes).
- Ao clicar, abre um modal com um campo de texto contendo a anotação daquele cliente.
- Botões **Salvar** e **Fechar**. Salvar grava e mantém o texto para sempre; editar é só abrir, alterar e salvar de novo.
- A anotação é por **cliente (telefone)**, não por atendimento: ela aparece igual em qualquer conversa/atendimento daquele número.
- Quando já existe anotação salva, o ícone aparece destacado para o atendente saber que há nota.

## Detalhes técnicos

- Nova tabela `whatsapp_notas`: `id`, `telefone` (único), `nota` (texto), `created_at`, `updated_at`; GRANTs para `authenticated`/`service_role`, RLS habilitada com política para usuários autenticados.
- `src/routes/whatsapp.tsx`: novo estado para o modal de anotação, query que busca a nota pelo `telefone` da conversa aberta, mutação de upsert (`onConflict: telefone`) e o botão no cabeçalho da conversa.
- Sem alteração no bot, webhook, layout geral ou outras telas.
- Ao final: typecheck/build e marcar a melhoria 11 como executada.
