# Corrigir salvamento da impressora e impressão direta (QZ Tray)

## O que está acontecendo (verificado no banco)

A configuração salva hoje tem:
- método de impressão: `qz`
- impressora padrão: vazia
- lista de impressoras: vazia

Ou seja, o método foi salvo, mas **nenhuma impressora foi realmente adicionada à lista**. Na tela atual, escolher um nome no campo "Selecionar impressora" apenas preenche uma caixa de texto: só entra na configuração depois de clicar no botão de adicionar. Como o nome nunca foi adicionado, ao voltar à tela o campo aparece vazio ("não salvou") e, na hora de imprimir, o sistema não tem impressora de destino e cai na janela do navegador — mesmo com o QZ Tray selecionado.

## Correções

### 1. Seleção de impressora que realmente salva
- Trocar o campo de texto + botão por um seletor das impressoras detectadas pelo QZ Tray: escolher um nome já o inclui na lista de impressoras padrão.
- Manter a opção de digitar um nome manualmente (para quando o agente não estiver rodando), com o mesmo comportamento de inclusão imediata.
- Aviso visível quando houver alterações não salvas ao tentar sair da aba/tela, para não perder a configuração.

### 2. Salvar sempre a impressora escolhida
- Ao salvar, gravar o nome selecionado em `impressora_padrao_nome` e na lista `impressoras_padrao` (hoje já faz isso, mas só quando a lista tem itens).
- Bloquear salvar com método "QZ Tray" sem nenhuma impressora na lista, explicando o motivo.
- Após salvar, recarregar a configuração para confirmar em tela o que ficou gravado.

### 3. Impressão direta respeitando o método configurado
- Na janela de impressão da etiqueta, usar o método configurado (`qz`) com a impressora padrão: quando o agente estiver conectado, imprimir direto, sem abrir a janela do navegador.
- Quando a impressão direta falhar ou o agente estiver desconectado, continuar com o fallback do navegador, mas exibindo o motivo real ("QZ Tray não conectado", "impressora não encontrada"), em vez de cair silenciosamente.
- Pré-selecionar automaticamente a impressora padrão configurada ao abrir a janela de impressão.

## Detalhes técnicos
- `src/routes/configuracoes.tsx`: seletor de impressoras detectadas com inclusão imediata, validação antes de salvar, refetch pós-salvamento, aviso de alterações pendentes.
- `src/components/ImprimirEtiqueta.tsx`: ler `impressora_padrao_tipo` e `impressora_padrao_nome` da configuração; forçar caminho QZ quando o método for `qz`; mensagens de erro específicas.
- `src/lib/impressora.ts`: `imprimirEtiqueta` retorna o motivo da falha da impressão direta (agente desconectado x impressora inválida) para exibição na interface.

## Fora do escopo
- Alterações no layout das telas e em qualquer outra funcionalidade.
