# Melhoria 7 — Nome e telefone na calculadora

Melhoria identificada: "Nome e telefone na calculadora" (tela WhatsApp) — ao clicar em "Calculadora" na conversa do WhatsApp, carregar o nome e o telefone do cliente já preenchidos na calculadora, para usar na geração do orçamento.

## O que muda

1. `src/routes/whatsapp.tsx` — no botão "Enviar para a calculadora", além da lista de arquivos, gravar no `sessionStorage` também o nome do contato (`conversa.nome_contato`) e o telefone (`conversa.telefone`) da conversa aberta.
2. `src/routes/index.tsx` — ao importar os arquivos vindos do WhatsApp (rotina que já limpa a tela como "Novo Pedido"):
   - preencher `clienteNome` com o nome do contato (se houver; senão mantém vazio);
   - preencher `clienteTelefone` com o telefone do cliente;
   - o restante do fluxo (limpeza, preload com %, contagem de páginas) permanece igual.
3. Ao terminar, marcar a melhoria 7 como `executada = true` no banco (status continua "pendente", seguindo a regra das melhorias).

## Detalhes técnicos

- O formato da chave `calc-arquivos-whatsapp` no `sessionStorage` passa a ser `{ arquivos: [{ id, nome }], nome, telefone }`; a leitura na calculadora aceita também o formato antigo (lista simples) por segurança.
- Nenhuma alteração de banco, de bot, de webhook ou de layout.
