# Ocultar o valor das notas válidas

## Objetivo

Nas abas **Painel** e **Encerramento** do sorteio, o cartão **Valor em notas válidas** abrirá com o valor monetário oculto. Um botão com ícone de olho permitirá mostrar ou ocultar o valor.

## Alterações

1. Ampliar o cartão de indicador para aceitar, opcionalmente, uma ação no canto superior direito, preservando todos os cartões atuais.
2. No **Painel**, manter um controle próprio iniciado como oculto:
   - exibir uma máscara no lugar do valor;
   - usar o ícone de olho para revelar;
   - trocar para olho riscado quando estiver visível, permitindo ocultar novamente;
   - incluir descrição acessível no botão.
3. No **Encerramento**, aplicar o mesmo comportamento somente ao cartão **Valor em notas válidas**.
4. Cada tela controlará sua própria visualização; ao entrar ou recarregar a tela, o valor voltará a ficar oculto.

## O que não muda

- Os cálculos, filtros **Hoje / Todos**, dados gravados e permissões permanecem iguais.
- Quantidades de notas, saldo acumulado, fontes pendentes, contribuições e demais indicadores continuam visíveis.
- Nenhuma alteração no banco de dados.

## Verificação

- Confirmar no navegador que o valor começa oculto nas duas abas.
- Confirmar que o botão revela e oculta novamente sem deslocar o cartão.
- Conferir em tela ampla e celular, além da validação de tipos e do estado atual da aplicação.

Sem publicação.
