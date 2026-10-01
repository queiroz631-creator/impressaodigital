# FOTO EXPRESS — Etapa 5: renderização final 300 DPI e geração PDF/JPG

## Objetivo

Gerar arquivos reais de impressão a partir da montagem confirmada, sempre reconstruindo cada folha com os arquivos originais, edições não destrutivas, textos, áreas internas dos formatos e posições físicas persistidas.

Saídas selecionáveis:

- PDF multipágina;
- JPG individual por folha;
- PDF + JPG.

Não haverá impressão direta, TIFF, ZIP, filtros, upscale por IA, perfis ICC profissionais, portal público ou publicação.

## Estado atual confirmado

- A montagem já persiste papel, orientação, margens, espaçamento, assinatura, versão, folhas e ocorrências em milímetros.
- Foto, crop, rotação, espelhamentos, textos e área interna do formato já possuem representação normalizada.
- O bucket privado `foto-express-impressoes` está previsto nas regras de leitura e no script de infraestrutura, mas ainda não existe fluxo de gravação nem cadastro de gerações/arquivos finais.
- Não existe `foto_express_arquivos_impressao` nem outro cadastro equivalente nas migrations oficiais.
- O projeto já inclui `jsPDF`; não há motor de imagens de servidor compatível com o ambiente atual.
- O catálogo de texto atual usa famílias disponíveis no dispositivo, portanto será substituído por fontes locais controladas também no preview.

## Arquitetura escolhida

A renderização será executada no navegador, fora dos componentes React, usando Canvas 2D/OffscreenCanvas e os recursos nativos já disponíveis. Nenhuma nova biblioteca será instalada.

```text
Montagem confirmada
  → servidor valida permissão e cria snapshot/geração
  → navegador recebe manifesto autorizado e URLs temporárias dos originais
  → motor isolado renderiza uma folha por vez a 300 DPI
  → JPG de cada folha é enviado diretamente por URL temporária
  → jsPDF monta o PDF com tamanho físico real
  → servidor confere objetos e metadados e conclui a geração
  → downloads usam URLs temporárias
```

O servidor apenas autorizará, registrará e validará o processo. Chaves privilegiadas nunca serão enviadas ao navegador.

## 1. Persistência, snapshot e segurança

Criar migration incremental e não destrutiva para:

- adicionar à montagem um snapshot canônico produzido no banco; montagens antigas sem snapshot exigirão nova confirmação antes de gerar;
- criar `foto_express_geracoes` com trabalho, montagem, versão/assinatura/snapshot, saída solicitada, DPI 300, estado (`PENDENTE`, `PROCESSANDO`, `CONCLUIDO`, `ERRO`), etapa atual, erro técnico seguro, autor e datas;
- criar `foto_express_arquivos_impressao` para PDF/JPG, folha, bucket/caminho, MIME, tamanho, dimensões em pixels, páginas e DPI;
- aplicar GRANTs, RLS e políticas de leitura/escrita pelas permissões existentes: visualizar para consulta/download e `foto_express.trabalhos.editar` para gerar;
- criar RPC atômica de início que bloqueie a montagem, confirme estado atual, compare snapshot, valide itens/formatos/configurações/textos/folhas/ocorrências e impeça geração concorrente idêntica;
- criar RPCs protegidas para progresso, conclusão e erro, com transições de estado válidas;
- marcar a montagem como desatualizada quando item, configuração, texto ou formato usado mudar, sem alterar originais;
- registrar cada geração em caminhos imutáveis baseados em IDs, sem sobrescrever histórico.

A migration aplicada será copiada com SQL idêntico e nome datado para `supabase/migrations/`, mantendo-a como referência oficial.

## 2. Manifesto de renderização e uploads privados

Adicionar funções protegidas para:

- iniciar geração e devolver um manifesto imutável contendo somente os dados necessários;
- emitir URLs temporárias dos arquivos originais e dos destinos esperados no bucket privado;
- atualizar a etapa real do processamento;
- finalizar apenas depois de conferir existência, MIME, tamanho e conjunto completo dos objetos esperados;
- registrar erro e remover somente objetos incompletos pertencentes à geração atual;
- criar URLs temporárias de download para arquivos concluídos.

O manifesto será montado no servidor a partir do banco, não de IDs ou parâmetros visuais enviados pelo navegador.

## 3. Motor matemático independente da interface

Criar uma camada isolada em `src/modules/foto-express/renderizacao/` para:

- centralizar `cm → mm`, `mm → px` e arredondamento em 300 DPI;
- carregar e validar o original, normalizando orientação visual/EXIF sem modificar o arquivo;
- converter o crop normalizado para pixels do original;
- reproduzir PREENCHER/AJUSTAR, zoom, posição, rotações 0/90/180/270 e espelhamentos na ordem canônica da Etapa 2;
- compor a peça externa com a cor de fundo e recortar a foto somente na área interna do formato;
- tratar transparência de PNG/WEBP sobre o fundo da peça, nunca sobre preto;
- aplicar textos sobre a peça completa por posição, largura e tamanho normalizados, alinhamento, estilo, rotação e ordem;
- girar a peça completa em 90° somente depois de foto, fundo e textos;
- posicionar a peça usando exatamente `x_mm`, `y_mm`, `largura_mm` e `altura_mm` persistidos, sem recalcular a montagem.

O motor não lerá DOM, pixels CSS, thumbnails, preview ou dimensões do monitor.

## 4. Fontes determinísticas

Incluir arquivos de fonte locais e licenciados para os quatro identificadores existentes (`SANS`, `SERIF`, `MONO`, `DECORATIVA`), com variantes necessárias de regular, negrito e itálico.

- Um único catálogo mapeará identificador → arquivo → família usada no preview e no Canvas.
- As fontes serão carregadas e confirmadas antes da renderização.
- Fonte ausente interromperá a geração com erro claro; não haverá substituição silenciosa nem download externo.
- Quebra de linha será implementada por medição Canvas, preservando largura da caixa, espaços, quebras explícitas, alinhamento e rotação.

## 5. JPG e PDF

Para cada folha:

- criar superfície branca nas dimensões `round(mm / 25,4 × 300)`;
- renderizar ocorrências com coordenadas convertidas apenas no momento do desenho;
- exportar JPG em alta qualidade, sem transparência, com nome `trabalho-NNNNNN-folha-NN.jpg`;
- enviar e liberar buffers intermediários antes de avançar.

Para PDF:

- usar o `jsPDF` já instalado;
- criar uma página por folha com largura e altura físicas exatas em milímetros;
- inserir a rasterização de 300 DPI sem alterar a escala física;
- gerar `trabalho-NNNNNN-impressao.pdf` sem páginas extras.

A qualidade JPG, modo de cor RGB e limitações de metadados de resolução serão documentados no código e na entrega.

## 6. Memória, limites e falhas

- Processar uma folha por vez e liberar Canvas, bitmaps, URLs e buffers assim que possível.
- Reutilizar o original decodificado apenas dentro de um orçamento de memória; múltiplas cópias não repetirão download.
- Aplicar limites explícitos para dimensão máxima da superfície, número de folhas e memória estimada, com mensagem clara antes de iniciar.
- Não criar percentual fictício: mostrar etapas reais como preparar, renderizar folha N de M, gerar PDF, salvar e concluir.
- Duplo clique reutilizará/bloqueará a geração em processamento para a mesma montagem e saída.
- Falhas parciais manterão diagnóstico no cadastro e limparão apenas arquivos incompletos da geração atual.

## 7. Interface de geração e downloads

Na tela de revisão:

- manter “Confirmar montagem” e habilitar “Gerar arquivo de impressão” somente para montagem persistida e atual;
- oferecer PDF, JPG ou PDF + JPG;
- mostrar papel, orientação, folhas e 300 DPI antes de iniciar;
- exibir etapa atual, erro com “Tentar novamente” e resultado concluído;
- listar “Baixar PDF” e cada JPG disponível por folha;
- bloquear geração sem permissão ou com montagem desatualizada.

A tela continuará funcional em desktop e celular; a renderização não dependerá do viewport.

## 8. Validação sem dados reais

Criar fixtures e testes locais isolados, sem gravar no banco ou Storage de produção, cobrindo:

- equivalência numérica das transformações PREENCHER/AJUSTAR, zoom, posições, crop, rotações e espelhamentos;
- textos de uma e várias linhas, três alinhamentos, negrito, itálico e quatro rotações;
- formato integral e área interna tipo Polaroid, em retrato e paisagem;
- peça girada na folha e múltiplas cópias;
- A4, A3, 10×15, 15×20 e 20×30 a 300 DPI, com tolerância somente do arredondamento de pixel;
- JPG: dimensões, fundo, conteúdo, orientação, nome e qualidade;
- PDF: páginas, dimensões físicas, orientação, escala real e ausência de páginas extras;
- original ausente, fonte ausente, limite excedido, montagem desatualizada, duplo início, upload parcial e tentativa sem permissão;
- build, verificação de tipos e interface em desktop/celular.

A inspeção visual dos PDFs de fixture será feita página por página após rasterização local. Fluxos que exigirem escrita real serão relatados como não validados funcionalmente, sem presumir aprovação.

## Restrições da entrega

- Nenhum original será alterado.
- Thumbnails nunca serão usados na saída final.
- Nenhuma dependência ou lockfile será alterado.
- Nenhum dado real ou objeto de teste será criado.
- Não tratar órfãos antigos, MIME pendente ou VPS.
- Não publicar nem iniciar impressão direta ou etapa posterior.
- O relatório final seguirá os 29 itens e as confirmações expressas solicitadas no documento.
