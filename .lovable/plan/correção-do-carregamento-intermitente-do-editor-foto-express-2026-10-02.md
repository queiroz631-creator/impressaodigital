# Correção do carregamento intermitente do editor FOTO EXPRESS

## Objetivo
Evitar que trabalhos com muitas fotos sobrecarreguem o armazenamento ao abrir o editor, mantendo a navegação entre fotos e recuperando automaticamente falhas temporárias.

## Alterações
- Separar a lista leve de navegação da Galeria completa: o editor buscará somente identificador e ordem das fotos, sem criar links temporários de todas as miniaturas.
- Manter a consulta da foto atual isolada, gerando apenas o link temporário do original aberto.
- Adicionar repetição automática limitada para falhas temporárias ao consultar a foto ou gerar seu acesso, preservando o botão “Tentar novamente” para falhas persistentes.
- Manter a quantidade de outras fotos disponível para “Aplicar em todas”, sem carregar miniaturas.

## Validação
- Confirmar compilação sem erros.
- Abrir repetidamente uma foto do trabalho 2 e navegar entre anterior/próxima, verificando que o editor permanece disponível.
- Confirmar que a abertura do editor não dispara solicitações de links temporários para todas as 89 miniaturas.
- Não alterar dados reais, arquivos, dependências ou publicar.
