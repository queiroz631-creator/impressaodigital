# Visibilidade de formatos no portal

- Adicionar ao formato a opção **Mostrar no portal**, ativada por padrão para preservar o comportamento atual.
- Exibir e salvar essa opção ao criar ou editar um formato; identificar nos cards os formatos ocultos do portal.
- Filtrar apenas o catálogo público do cliente, mantendo formatos ocultos disponíveis para a equipe e preservando fotos antigas que já os utilizem.
- Validar criação, edição e listagens sem alterar dados reais e sem publicar.

## Detalhes técnicos
- Criar uma alteração incremental no banco e sua cópia SQL oficial idêntica.
- Aplicar o filtro também na validação de upload e nas opções do editor público, sem alterar as consultas internas do FOTO EXPRESS.
