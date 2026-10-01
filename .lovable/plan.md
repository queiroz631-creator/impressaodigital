# FOTO EXPRESS — Etapa 3: textos sobre a foto

## Objetivo
Adicionar ao editor individual camadas de texto independentes e não destrutivas, vinculadas ao item da foto e reproduzíveis em qualquer resolução futura, sem alterar o original.

## 1. Inspeção obrigatória antes da execução
- Revisar a tabela existente `foto_express_textos`, seus campos, relacionamento com itens, ordenação, regras de acesso e permissões.
- Confirmar quais propriedades já estão disponíveis e evoluir a tabela existente somente quando necessário.
- Revisar o editor da Etapa 2 e seus padrões de autosave, permissões, modo somente leitura e interação por toque.
- Não criar tabela paralela nem alterar migrations antigas.

## 2. Modelo e persistência
- Representar cada texto como uma camada pertencente exclusivamente ao item, mesmo quando itens diferentes compartilham o mesmo arquivo original.
- Persistir conteúdo como texto puro, posição normalizada, tamanho normalizado, fonte controlada, cor hexadecimal, negrito, itálico, alinhamento, rotação e ordem da camada.
- Criar apenas a migration incremental e não destrutiva necessária para completar a estrutura existente, espelhada na pasta oficial de migrations.
- Implementar operações seguras de criar, alterar, duplicar, reordenar e excluir texto, validando autenticação, permissão, trabalho, item e propriedade da camada.
- Usar gravações atômicas e proteção contra uma alteração atingir outro item ou outro texto; qualquer função privilegiada terá `search_path` seguro e validação explícita do usuário.

## 3. Convenção matemática
- Usar como sistema canônico a área final de impressão, independente da transformação e dos pixels do arquivo original.
- Definir `posicao_x` e `posicao_y` entre 0 e 1 como o centro da caixa do texto: `(0,0)` no canto superior esquerdo, `(0.5,0.5)` no centro e `(1,1)` no canto inferior direito.
- Persistir o tamanho como proporção da altura da área de impressão; converter para pixels apenas na apresentação.
- Converter uma camada para qualquer saída com: centro `(x × largura, y × altura)` e tamanho `tamanho_normalizado × altura`, aplicando depois alinhamento e rotação.
- Manter foto e textos em sistemas independentes: alterar enquadramento, formato ou crop não modifica automaticamente a posição dos textos.
- Limitar a âncora à área `[0,1]`, permitir corte visual parcial pela moldura e impedir que a camada fique completamente inacessível.

## 4. Interface do editor
- Adicionar a ação **Adicionar texto**, criando uma camada central selecionada com o conteúdo inicial “Digite seu texto”.
- Permitir múltiplas camadas, seleção direta na foto, edição de conteúdo com múltiplas linhas e limite seguro de caracteres.
- Criar controles separados para fonte, tamanho, cor, cores rápidas, negrito, itálico, alinhamento e rotação.
- Usar inicialmente rotações controladas de 0°, 90°, 180° e 270° para manter a etapa previsível.
- Permitir arrastar a camada com mouse ou toque, duplicar, excluir com proteção adequada e controlar uma ordem simples e determinística.
- Destacar discretamente a camada selecionada sem persistir a seleção.
- Manter o botão de redefinição da foto separado: redefinir a foto nunca remove nem redefine textos.

## 5. Preview e uso em celular
- Reproduzir conteúdo, posição, tamanho, fonte, cor, estilos, alinhamento, rotação, corte e ordem em qualquer tamanho do editor.
- Separar os gestos: arrastar texto não move a foto nem a página; arrastar foto não move texto.
- Oferecer no celular acesso confortável à seleção, conteúdo, tamanho, cor, movimentação e exclusão.
- Usuários somente leitura visualizam o resultado completo, sem controles de alteração.
- Manter o cálculo de DPI exclusivamente baseado no original e no crop; textos não interferem na qualidade fotográfica.

## 6. Autosave e estados
- Atualizar localmente durante o arraste e persistir ao terminar a interação.
- Aplicar debounce aos controles contínuos, evitando gravação a cada pixel.
- Exibir os estados **Salvando...**, **Salvo** e **Erro ao salvar**.
- Em erro, preservar o estado local e oferecer nova tentativa sem afirmar que a alteração foi salva.

## 7. Organização
- Separar apresentação das camadas, painel de controles, lista/ordenação, matemática normalizada e operações de persistência.
- Integrar esses módulos ao editor atual sem concentrar toda a implementação no componente principal.
- Não alterar a convenção matemática já aprovada para zoom, posição, rotação, orientação, modo e crop da foto.

## 8. Validação sem dados reais
- Criar testes matemáticos locais para retrato, paisagem, diferentes proporções, múltiplas linhas, alinhamentos, rotações e redimensionamento.
- Comparar previews proporcionais em 400×600, 1200×1800 e 2400×3600, garantindo reconstrução equivalente.
- Validar por inspeção a segurança, os vínculos e o isolamento entre itens que compartilham o mesmo original.
- Verificar abertura, apresentação, controles, modo somente leitura, desktop, celular e compilação sem gravar dados reais.
- Classificar como **não validado funcionalmente** tudo que depender de escrita real, incluindo autosave após recarregar, concorrência e independência persistida entre itens duplicados.

## 9. Limites desta entrega
- Não alterar o original nem criar imagem física editada.
- Não implementar montagem, papel, margens, impressão, renderização final, PDF/JPG/TIFF, portal, pagamento, filtros ou efeitos avançados.
- Não tratar arquivos órfãos, MIME dos buckets ou provisionamento da VPS.
- Não atualizar dependências nem lockfiles; se uma dependência parecer indispensável, apenas documentar e aguardar autorização.
- Não criar ou modificar dados reais para testes, não publicar e não iniciar a Etapa 4.

## Entrega final
- Relatar a estrutura encontrada, migrations e arquivos alterados, componentes, fontes disponíveis, convenções matemáticas, autosave, segurança e testes.
- Separar claramente o que foi comprovado funcionalmente, validado apenas por inspeção e não validado funcionalmente.
- Confirmar expressamente a preservação do original, ausência de novos arquivos físicos, ausência de mudanças em dependências, ausência de dados reais de teste e ausência de publicação.