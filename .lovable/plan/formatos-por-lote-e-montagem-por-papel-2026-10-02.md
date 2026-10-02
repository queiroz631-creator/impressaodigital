# Formatos por lote e montagem por papel

## Implementação
- Vincular cada formato a um papel padrão ativo, mantendo os formatos atuais válidos até serem editados.
- Exigir a escolha do formato antes de adicionar fotos; cada novo lote recebe o formato selecionado, e o usuário pode trocar o formato para o próximo lote.
- Manter a troca individual de formato já disponível após o envio.
- Mostrar, somente ao cadastrar/editar formato, uma estimativa de quantas cópias cabem no papel padrão, considerando margens, espaçamento, orientação e giro configurados.
- Na Revisão, agrupar as fotos pelo papel padrão de seus formatos, calcular e exibir folhas/capacidade por grupo e impedir confirmação se algum formato estiver sem papel padrão.
- Persistir a montagem dos grupos de papel de modo atômico e compatível com o histórico e a geração final existentes.

## Dados e segurança
- Criar evolução incremental e não destrutiva para o papel padrão do formato e para os grupos de montagem.
- Validar no servidor formato ativo, papel ativo, vínculo entre trabalho, item e formato, permissões e todos os destinos calculados.
- Espelhar a migração oficial na pasta usada pelo deploy, com o mesmo SQL.

## Validação
- Testar lotes com formatos diferentes no mesmo trabalho, papéis iguais e diferentes, giro permitido/desativado e formatos sem papel padrão.
- Conferir cadastro/edição, upload obrigatório, revisão agrupada, confirmação, geração existente e telas em desktop/celular.
- Não criar dados reais de teste, não alterar arquivos originais, não atualizar dependências e não publicar.
