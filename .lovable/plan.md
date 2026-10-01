# FOTO EXPRESS — Etapa 2: editor não destrutivo

## Objetivo
Adicionar o editor individual de cada item da Galeria, preservando integralmente o arquivo original e salvando somente parâmetros reproduzíveis de edição.

## Escopo da entrega

### 1. Entrada e navegação
- Adicionar a ação **Editar** em cada foto da Galeria.
- Criar a rota `/foto-express/$trabalhoId/fotos/$itemId/editar`, com metadados próprios e proteção por `foto_express.visualizar`.
- Carregar somente o item atual, seu arquivo, formato, configuração e uma URL temporária da imagem privada.
- Validar que o item pertence ao trabalho informado; tratar item ausente, falha de consulta, imagem indisponível e expiração da URL com opção de tentar novamente.
- Incluir **Anterior**, **Próxima** e **Voltar para Galeria**, respeitando a ordem atual dos itens e resolvendo alterações pendentes antes da navegação.

### 2. Área de edição
- Criar componentes separados para a área da foto, controles, qualidade, estado de salvamento e navegação.
- Exibir uma moldura com a proporção física do formato escolhido, incluindo dimensões personalizadas e orientação retrato/paisagem.
- Permitir arrastar com mouse ou toque, zoom suave por slider e botões, rotação de 90°, espelhamento horizontal/vertical e redefinição.
- Implementar **Preencher** como padrão, sem áreas vazias, e **Ajustar**, permitindo mostrar a foto inteira e sinalizando visualmente as áreas não ocupadas.
- No modo **Ajustar**, manter em `0` a posição normalizada de qualquer eixo sem área excedente; permitir deslocamento somente no eixo que possuir overflow após todas as transformações.
- Impedir que o gesto dentro da área de edição mova a página no celular, sem afetar a navegação fora dela.
- Oferecer modo somente leitura quando o usuário puder visualizar, mas não tiver `foto_express.trabalhos.editar`; o banco continuará sendo a autoridade da permissão.

### 3. Matemática reutilizável
- Separar dos componentes a lógica de proporção, escala-base, rotação, limites de deslocamento, espelhamento, crop e DPI.
- Definir `zoom` como multiplicador da escala-base do modo atual: `zoom = 1` representa exatamente a escala-base de **Preencher** ou **Ajustar**, nunca uma escala em pixels da interface.
- Persistir `posicao_x` e `posicao_y` normalizados, independentes dos pixels da tela: `0` representa o centro e os extremos representam os limites válidos do deslocamento. Em eixos sem overflow, persistir sempre `0`.
- Usar `zoom`, posição, rotação, orientação e modo de ajuste como representação canônica da edição. Não haverá controle independente de crop nesta etapa.
- Derivar `crop_x`, `crop_y`, `crop_largura` e `crop_altura` do enquadramento resultante, como retângulo normalizado de `0` a `1` no sistema de coordenadas do arquivo original, com origem no canto superior esquerdo do original.
- Para rotações de 90° e 270°, calcular o enquadramento no espaço visual rotacionado e aplicar a transformação inversa para persistir o retângulo nas coordenadas do original. Espelhamentos alteram a transformação visual, mas não mudam a origem do sistema persistido.
- Recalcular e limitar o enquadramento após zoom, rotação, orientação, modo de ajuste e mudança de tamanho da tela.
- Manter essa matemática reutilizável para uma futura renderização em alta resolução, que aplicará os mesmos parâmetros ao original.

### 4. Qualidade a 300 DPI
- Evoluir o cálculo atual para usar exclusivamente as dimensões do arquivo original, o tamanho físico, a orientação, a rotação e a região efetivamente utilizada.
- Calcular os pixels efetivos pelo crop normalizado no original: `pixels_largura = largura_original × crop_largura` e `pixels_altura = altura_original × crop_altura`. Após rotação de 90°/270°, trocar os eixos para compará-los às dimensões físicas já orientadas. O resultado será `floor(min(pixels_largura_visual / (largura_cm_visual / 2,54), pixels_altura_visual / (altura_cm_visual / 2,54)))`.
- Manter as faixas atuais: Excelente a partir de 300 DPI, Boa de 220 a 299, Baixa de 150 a 219 e Muito baixa abaixo de 150.
- Atualizar o resultado em tempo real e exibir aviso informativo abaixo de 220 DPI, com maior destaque abaixo de 150 DPI.
- Preservar compatibilidade com o indicador já exibido na Galeria.

### 5. Salvamento automático e integridade
- Manter o estado local durante arraste e ajustes, salvando ao terminar a interação e também com debounce para controles contínuos.
- Exibir estados discretos **Salvando**, **Salvo** e **Erro ao salvar**, mantendo a edição local em caso de falha e oferecendo nova tentativa.
- Salvar configuração, orientação e `status_edicao` de forma atômica, validando no banco a permissão `foto_express.trabalhos.editar` e a correspondência entre item e trabalho.
- Nunca atualizar `foto_express_arquivos`, nem criar cópias ou versões físicas da imagem.
- Preservar a independência das configurações de itens duplicados que compartilham o mesmo `arquivo_id`.

### 6. Alteração mínima no banco
A inspeção confirmou que zoom, posição, rotação, crop e espelhamentos já existem. O único dado obrigatório ausente é o modo **Preencher/Ajustar**.

- Criar uma migration incremental e não destrutiva na pasta oficial, adicionando `modo_ajuste` a `foto_express_configuracoes`, com padrão `PREENCHER` e validação para `PREENCHER` ou `AJUSTAR`.
- Incluir na mesma migration uma função autenticada para salvar atomicamente os parâmetros da configuração e a orientação do item.
- Manter tabelas, FKs, RLS e arquivos existentes; não modificar migrations antigas.
- Atualizar os tipos gerados pelo fluxo da plataforma, sem editar arquivos gerados manualmente.

### 7. Verificações
- Verificar compilação, erros de execução e consultas do editor.
- Testar em desktop e celular: abertura pela Galeria, proporção da moldura, arraste, zoom, rotação, orientação, espelhamentos, reset, navegação, qualidade, carregamento e falhas com nova tentativa.
- Validar a matemática e a reconstrução de configurações com dados locais controlados.
- Não criar nem modificar dados reais apenas para testes. A persistência real que não puder ser comprovada sem escrita será identificada no relatório como validação técnica, não funcional.
- Confirmar que nenhuma dependência ou lockfile foi alterado e que nenhum original foi modificado.

## Fora do escopo
- Textos sobre foto, faixa adicional de miniaturas, montagem de folhas, papel, margens, renderização final, PDF/JPG/TIFF, fila de renderização, portal do cliente, pagamento e compartilhamento.
- Limpeza dos seis arquivos sem item, alteração dos MIME types, provisionamento de Storage, mudanças em outros módulos e publicação/deploy.

## Entrega final
Apresentar arquivos criados e alterados, migration aplicada e registrada oficialmente, componentes do editor, convenção matemática, funcionamento do autosave, cálculo de DPI, verificações realizadas e limitações encontradas. Não avançar para outra etapa automaticamente.
