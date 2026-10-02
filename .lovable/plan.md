# Categorias dos formatos do FOTO EXPRESS

## Classificação
- Adicionar a cada formato uma categoria controlada: **Formato padrão**, **Documento**, **Polaroid** ou **Padrão Polaroid**.
- Incluir o campo **Categoria** no cadastro e na edição de formatos, exigindo uma das quatro opções.
- Exibir a categoria em cada cartão para facilitar a identificação.

## Classificação dos formatos atuais
- Classificar automaticamente os formatos existentes pelo nome:
  - `3x4 cm` como **Documento**;
  - nomes contendo `Polaroid` como **Polaroid**;
  - todos os demais como **Formato padrão**.
- Novos formatos começam em **Formato padrão**, mas podem ser alterados antes de salvar.
- **Padrão Polaroid** ficará disponível para seleção manual.

## Seletor da tela Formatos
- Adicionar acima dos cartões um seletor com **Todos**, **Formato padrão**, **Documento**, **Polaroid** e **Padrão Polaroid**.
- Manter **Todos** selecionado inicialmente.
- Filtrar somente os cartões da tela Formatos, sem alterar o seletor usado no editor da foto.
- Preservar o botão Novo formato, o estado do seletor e a adaptação para tela grande e celular.

## Dados e segurança
- Criar uma evolução incremental do banco com valor padrão, validação das categorias permitidas e classificação inicial dos registros existentes.
- Registrar a mesma evolução na pasta oficial de migrações usada pela publicação, mantendo a ordem do projeto.
- Preservar permissões, formatos ativos/inativos, dimensões, bordas e demais dados atuais.

## Verificação
- Validar cadastro, edição, identificação visual e os cinco estados do filtro.
- Conferir a classificação automática de 3x4, Polaroid e formatos comuns sem alterar outros dados reais.
- Testar em tela grande e celular, confirmar compilação e não publicar.
