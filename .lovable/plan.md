# Orientação da montagem na Revisão

## O que será alterado
- Adicionar na Revisão as opções **Automática**, **Retrato** e **Paisagem**.
- Quando houver mais de um papel, permitir escolher entre aplicar a orientação a **todos os papéis** ou configurar **cada papel separadamente**.
- Exibir o seletor individual em cada grupo quando o modo separado estiver ativo.
- Adicionar **Restaurar**, que retorna todos os papéis para **Automática** e recalcula a prévia.
- Manter a confirmação atômica existente, salvando a orientação efetivamente escolhida em cada papel.

## Validação
- Conferir um e vários tipos de papel, os três modos de orientação e a restauração.
- Verificar recálculo da quantidade de folhas, aproveitamento, prévia e assinatura da montagem.
- Validar em desktop e celular, sem confirmar nem alterar trabalhos reais e sem publicar.

## Detalhes técnicos
- A escolha solicitada será aplicada à configuração de cada grupo antes do cálculo determinístico existente.
- A assinatura incluirá essas configurações para marcar como desatualizada uma montagem confirmada com outra orientação.
- Não haverá alteração de banco nem novas dependências.