# Orçamento Rápido + Envia Zap

## O que muda

**1. Botão "Orçamento Rápido"** no cabeçalho do card VALORES DE IMPRESSÃO (ao lado de "Atualizar" e "Adicionar ao Pedido").

- Abre a mesma tela (modal) de "Gerar orçamento" que já existe, sem alterar o layout dela.
- Nesse modo, o orçamento considera **apenas o material selecionado na sessão atual** (com seus acabamentos, arquivos, páginas e cópias), ignorando os itens já adicionados ao pedido e sem adicionar nada ao pedido.
- Todos os campos atuais do modal continuam funcionando igual (cliente, telefone, validade, observação, mostrar total, PIX, prazo, Gerar PDF, Gerar Imagem).
- O fluxo normal do botão "Gerar Orçamento" (pedido completo) continua exatamente como está hoje.

**2. Botão "Envia Zap"** no rodapé do modal de orçamento (vale para os dois modos).

- Envia pelo WhatsApp, para o telefone informado no modal, um orçamento simplificado em texto.
- Usa a mesma integração de envio de texto já existente no sistema.
- Se não houver telefone válido, mostra aviso e não envia.

## Formato da mensagem

```text
*Segue Orçamento:*

Qtd Arquivos: 03

Total Pagina: 15

Impressão Colorida

Encadernação: 1x

Plastificação: Nenhum

*Valor Total: R$ 50,00*

Prazo de entrega: *3 horas após a aprovação e pagamento do serviço.*

Chave: (27) 99714-9157

Beneficiário: Luciana Martins de Carvalho de Queiroz

Banco: Mercado Pago

Obs.: o serviço será iniciado *após a nossa confirmação do recebimento*
```

Regras de preenchimento:
- Nome do material = o material selecionado.
- Acabamentos seguem a mesma lógica atual do orçamento: os selecionados aparecem com a quantidade (`Nome: 1x`); os marcados para "mostrar quando não incluso" aparecem como `Nome: Nenhum`.
- Valor total só aparece quando "Mostrar total" estiver em "Sim".
- Prazo e dados do PIX (Chave/Beneficiário/Banco) vêm das configurações da empresa e só entram quando as opções de prazo/PIX estiverem marcadas como "Sim" no modal.
- A linha de observação final é fixa.

## Detalhes técnicos

- `src/routes/index.tsx`: novo estado `modoRapido`; `documentoDoPedido()`/`documentoParaGerar()` montam um `ItemDoc` a partir de `materialSelecionado` + `linhasAcabamento` quando em modo rápido; `validarDadosOrcamento()` exige material selecionado em vez de itens no pedido nesse modo; `salvarDadosCliente()` não é chamado no modo rápido (nada é gravado no pedido).
- Novo helper de texto (em `src/lib/orcamento-doc.ts` ou arquivo novo `src/lib/orcamento-zap.ts`) que converte o `DadosDocumento` no texto simplificado acima — mantém a lógica de acabamentos e reaproveita `montarTextoPix`/`montarTextoPrazo`.
- Envio via `enviarTextoWhatsapp` (`src/lib/whatsapp.functions.ts`) com `useServerFn`, usando o telefone em dígitos (`telefoneRaw`).
- Sem migrações de banco, sem alteração de layout e sem mudanças em código não relacionado.
