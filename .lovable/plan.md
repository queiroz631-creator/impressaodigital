# Miniatura com enquadramento de impressão

## Objetivo
Ao abrir um trabalho, cada foto com formato definido será mostrada na proporção de impressão e com o enquadramento salvo no editor.

## Implementação
- Carregar junto da galeria os parâmetros salvos de zoom, posição, rotação, espelhamento e modo Preencher/Ajustar.
- Criar uma visualização compacta que use a mesma matemática do editor para evitar diferenças entre galeria e edição.
- Aplicar a orientação e as dimensões do formato configurado à moldura da miniatura.
- Manter a visualização atual em 4:3 quando a foto ainda não tiver formato.
- Manter seleção, edição, formato, quantidade e orientação funcionando como hoje.

## Validação
- Conferir fotos em retrato e paisagem, incluindo rotação, espelhamento e os modos Preencher/Ajustar.
- Validar a galeria em tela grande e celular.
- Confirmar compilação sem erros e sem alterar dados, dependências ou banco.
