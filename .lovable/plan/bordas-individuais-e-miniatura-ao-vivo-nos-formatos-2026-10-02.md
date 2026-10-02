# Bordas individuais e miniatura ao vivo nos formatos

## Alterações na tela
- Substituir Posição X/Y e Largura/Altura por quatro campos: borda superior, direita, inferior e esquerda.
- Exibir uma miniatura no próprio formulário, respeitando largura, altura, cor de fundo e as quatro bordas informadas.
- Atualizar a miniatura imediatamente durante a digitação, sem precisar salvar.
- Mostrar visualmente a área reservada à fotografia dentro do formato.

## Validação e compatibilidade
- Converter as quatro bordas para os campos internos já existentes, sem mudar o banco nem os formatos já salvos.
- Aceitar valores entre 0% e 99,9% e impedir que bordas opostas somem 100% ou mais.
- Manter a validação existente no salvamento e apresentar mensagens específicas para bordas horizontais ou verticais inválidas.
- Preservar nome, dimensões, cor de fundo, ativação e demais comportamentos atuais.

## Verificação
- Conferir o formulário e a atualização da miniatura em tela grande e celular.
- Validar formatos horizontais e verticais, inclusive Polaroid com margens diferentes.
- Confirmar compilação e ausência de erros no navegador, sem alterar dados reais nem publicar.
