# FOTO EXPRESS — primeira entrega funcional

## Objetivo
Criar um novo grupo **FOTO EXPRESS** abaixo de Marketing, integrado ao login, clientes, perfis e padrões visuais existentes. Esta entrega termina na galeria e no cadastro de formatos; o arquivo original permanece intacto e a estrutura já fica pronta para edição não destrutiva futura.

## Telas e fluxo

### Trabalhos
- Lista com número, nome/telefone informados no trabalho, quantidade de fotos, criação, última alteração e situação.
- Busca por número, nome ou telefone e filtro por situação.
- Ações para abrir/continuar e criar um novo trabalho.

### Novo Trabalho
- Campos opcionais: cliente já cadastrado, nome, telefone e observações.
- Ao selecionar um cliente existente, copiar os dados necessários para o trabalho sem alterar o cadastro compartilhado.
- Normalizar somente o nome próprio salvo no trabalho para CAIXA ALTA e sem acentos.
- Gerar número único automaticamente, iniciar como RASCUNHO e abrir a etapa de fotos.

### Upload e galeria
- Upload múltiplo de JPG, JPEG, PNG e WEBP, com progresso por arquivo e progresso geral.
- Validar tipo/tamanho, ler largura e altura no navegador, guardar o original privado e gerar uma thumbnail separada para a interface.
- Exibir as fotos assim que cada envio terminar, com seleção individual, selecionar/desmarcar todas e operações em lote.
- Permitir excluir, duplicar, aplicar formato, quantidade e orientação.
- **Duplicar** cria outro item lógico e outra configuração no trabalho, apontando para o mesmo registro/arquivo original.
- Ao excluir, remover o item do trabalho; o original físico só poderá ser removido quando não houver mais nenhum item apontando para ele.
- Autosave das mudanças de formato, quantidade e orientação, com indicação de salvamento/erro.
- Qualidade calculada pela resolução original versus dimensões do formato a 300 DPI, sem bloquear a impressão. A regra ficará isolada para receber zoom/crop na próxima etapa.

### Formatos
- Lista e manutenção de formatos ativos/inativos, ordem, nome, largura e altura.
- Formato personalizado poderá ser escolhido na galeria informando largura e altura válidas.
- Formatos iniciais: 3x4, 5x7, 10x15, 13x18, 15x20, 20x25, 20x30 e A4.
- A carga inicial usará um código estável e único por formato com `INSERT ... ON CONFLICT (codigo) DO NOTHING`, ficando segura para repetição sem duplicar nem sobrescrever ajustes posteriores.

## Dados e segurança
Criar uma migration incremental e não destrutiva, espelhada com SQL idêntico na pasta oficial de migrations da VPS, contendo:

- `foto_express_formatos`: formatos padrão e personalizados.
- `foto_express_trabalhos`: número, vínculo opcional com `clientes`, cópia dos dados próprios do trabalho, situação, observações e responsável.
- `foto_express_arquivos`: um registro por original físico, com nome, tipo, bytes, dimensões e caminhos separados do original e thumbnail.
- `foto_express_itens`: fotos lógicas do trabalho, ordem, quantidade, formato e medidas personalizadas.
- `foto_express_configuracoes`: zoom, posição X/Y, rotação, crop, orientação e demais valores necessários para reconstrução futura, mesmo sem editor nesta etapa.
- `foto_express_textos`: estrutura para múltiplos textos e suas propriedades, sem tela de textos nesta entrega.
- Funções/gatilhos necessários para número automático, datas de alteração, duplicação lógica atômica e exclusão segura.
- Índices para listagem, busca, ordenação e referências; validações de situação, quantidade, dimensões e tipos.
- `GRANT`s explícitos, RLS e políticas baseadas no usuário autenticado e nas permissões do FOTO EXPRESS.

Nenhuma linha existente de `clientes` será atualizada. Não haverá alteração destrutiva em tabelas existentes.

## Arquivos privados
Criar três áreas privadas e independentes:

```text
foto-express-originais/   # arquivos recebidos, nunca sobrescritos
foto-express-thumbnails/  # versões leves da galeria
foto-express-impressoes/  # reservada, sem geração nesta etapa
```

Os caminhos serão únicos por trabalho/arquivo. As regras de acesso exigirão login e permissão do FOTO EXPRESS. A galeria usará endereços temporários para exibir thumbnails, sem tornar os arquivos públicos.

## Menu e permissões
Adicionar o quinto grupo do menu, com cor própria e estes itens:

```text
FOTO EXPRESS
├── Trabalhos
├── Novo Trabalho
└── Formatos
```

Adicionar ao catálogo de perfis:
- `modulo.foto_express`
- `foto_express.visualizar`
- `foto_express.trabalhos.criar`
- `foto_express.trabalhos.editar`
- `foto_express.fotos.enviar`
- `foto_express.fotos.excluir`
- `foto_express.formatos.gerenciar`

Administradores continuam com acesso total pelo mecanismo atual. Outros perfis só verão e executarão o que lhes for concedido; as mesmas regras serão confirmadas no banco, não apenas escondidas na tela.

## Organização da implementação
- Rotas finas para lista, novo trabalho, fotos/galeria e formatos, todas com metadados próprios.
- Código do módulo isolado em `src/modules/foto-express/`, separado em páginas, componentes, hooks, tipos e serviços.
- Serviço de qualidade independente e preparado para receber os parâmetros de zoom/crop depois.
- Componentes compartilhados e cadastro de clientes existentes serão reutilizados sem alterar o comportamento de outros módulos.
- Registrar a decisão arquitetural no guia do projeto e acompanhar esta entrega no roadmap.

## Verificações
- Conferir typecheck e build automáticos sem erros.
- Validar no navegador em computador e celular: menu, lista, busca, criação, seleção de cliente, upload múltiplo, progresso, galeria, seleção em lote, duplicação lógica, exclusão, quantidade, orientação, formatos e autosave.
- Confirmar no banco que a duplicação reutiliza `arquivo_id`, que os formatos padrão não duplicam e que nomes de clientes existentes não mudam.
- Confirmar que original, thumbnail e área futura de impressão estão separados e privados.
- Verificar acesso administrativo e bloqueio sem permissão, sem criar usuários nem alterar dados reais de outros módulos.
- Não publicar nem executar deploy.

## Fora desta entrega
Não implementar editor avançado, controles de texto, revisão, montagem de folhas, renderização, PDF/JPG final, impressão em 300 DPI ou portal do cliente. As estruturas futuras existirão somente nos dados, sem expor funções incompletas na interface.
