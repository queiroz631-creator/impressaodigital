# WhatsApp: ZIP ou avulso, páginas do PDF, confirmação de leitura e ordem das mensagens

## 1. Baixar zipado ou avulso
- Hoje: até 3 arquivos baixam avulsos e 4 ou mais viram ZIP automaticamente.
- Novo: o botão "Baixar" abre um pequeno menu com "Baixar em ZIP" e "Baixar avulso", para qualquer quantidade.
- O ZIP continua com o mesmo nome, os mesmos nomes de arquivos e os mesmos avisos de falha.

## 2. Quantidade de páginas no PDF
- No cartão do PDF dentro da mensagem aparece "N páginas".
- A contagem é feita uma vez, na primeira vez que a mensagem aparece na tela, e fica guardada na mensagem. Assim não precisa contar de novo.
- PDF com senha: mostra um cadeado e o texto "Protegido por senha".
- PDF danificado ou que não abre: mostra um triângulo de alerta e o texto "Arquivo danificado".
- Essa situação também fica guardada na mensagem, e nada na tela quebra.

## 3. Confirmação de envio, entrega e leitura
- Nas mensagens enviadas aparecem os tiques do WhatsApp: um tique cinza (enviada), dois cinzas (entregue), dois azuis (lida), e o aviso de erro que já existe.
- Hoje o sistema ignora os avisos de entrega e leitura que a Z-API envia. Vamos passar a registrá-los.
- Um aviso mais antigo nunca rebaixa a situação (por exemplo, "entregue" não volta a "enviada" depois de "lida").
- Requisito: na Z-API, as opções de aviso de status de mensagem precisam apontar para o mesmo endereço de recebimento já configurado. Confirmaremos na configuração da conexão.

## 4. Ordem crescente/decrescente
- Botão no cabeçalho da conversa para alternar "Mais antigas primeiro" / "Mais recentes primeiro".
- A escolha fica salva no navegador do usuário.
- Na ordem decrescente, a caixa de texto continua no mesmo lugar e a conversa abre no topo (mensagem mais nova).

## Detalhes técnicos
- Migração nova (também em `supabase/migrations/`, nome datado): colunas `paginas int null`, `pdf_situacao text null` (`ok`/`protegido`/`danificado`), `entregue_em timestamptz null`, `lida_em timestamptz null` em `whatsapp_mensagens`; status aceita `entregue` e `lida`.
- Detecção: carregar com `pdf-lib`; erro de criptografia (`EncryptedPDFError` ou `/Encrypt` no arquivo) = protegido; outra falha de leitura ou download = danificado. Ícones Lock e AlertTriangle.
- `src/lib/whatsapp-webhook.server.ts`: tratar o callback `MessageStatusCallback` da Z-API antes do filtro que hoje descarta não-`ReceivedCallback`; atualizar por `id_mensagem_externa` (ids em `ids[]`) com ordem de prioridade enviada < entregue < lida, guardando o horário do provedor. Sem acionar bot.
- `src/lib/whatsapp.functions.ts`: função autenticada `salvarPaginasMensagem(id, paginas)`.
- `src/routes/whatsapp.tsx`: menu do botão Baixar com os dois modos reaproveitando `baixarSelecionados(modo)`; contagem via `contarPaginas` de `src/lib/contagem.ts` quando `paginas` é nulo; ícones Check/CheckCheck; estado `ordem` em localStorage invertendo a lista exibida.
- Sem mudar bot, calculadora ou demais telas. Não publicar.

## Verificação
- Build e testes existentes.
- Prévia: baixar 2 arquivos em ZIP e 5 avulsos; ver páginas de um PDF; alternar ordem; simular aviso de leitura no endereço de recebimento e ver os tiques azuis.
