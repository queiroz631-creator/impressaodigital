# FOTO EXPRESS — Etapa 4: revisão e montagem automática

## Objetivo
Adicionar ao trabalho o fluxo **Revisar impressão → configurar papel → montar automaticamente → visualizar folhas**, produzindo um plano físico reproduzível, sem gerar PDF/JPG/TIFF e sem alterar originais ou edições existentes.

## Situação atual confirmada
- Itens já possuem formato, quantidade, orientação, configuração não destrutiva e textos normalizados.
- Formatos usam largura e altura físicas em centímetros, mas ainda não distinguem peça externa de área interna da fotografia.
- Não existem hoje tabelas de revisão, configuração do papel, folhas ou ocorrências posicionadas.
- O editor e a galeria renderizam a fotografia sobre a peça inteira; precisarão respeitar a área interna configurada.
- As permissões existentes distinguem visualização e edição do trabalho.
- Há um formato real chamado **Polaroid**, 7 × 10 cm. Ele será preservado, sem conversão ou sobrescrita automática.

## Implementação

### 1. Modelo físico dos formatos
- Evoluir `foto_express_formatos` de forma incremental para representar genericamente:
  - dimensões externas da peça, mantendo as dimensões atuais como fonte física;
  - área interna da fotografia por coordenadas normalizadas `x`, `y`, `largura` e `altura`;
  - fundo da peça, inicialmente branco para formatos especiais.
- Formatos comuns receberão área interna equivalente a 100% da peça.
- Preservar o formato Polaroid atual e permitir parametrizar sua área interna na tela de Formatos.
- Preparar variantes **Polaroid Vertical** e **Polaroid Horizontal** configuráveis, sem inventar medidas definitivas; somente formatos com dimensões e área interna válidas poderão entrar na montagem.
- Atualizar editor, miniaturas e previews para restringir a fotografia à área interna, mantendo os textos relativos à peça externa completa.

### 2. Persistência atômica do plano
Criar estruturas específicas e protegidas para:
- **configuração de impressão**: trabalho, papel A4/A3, orientação automática/retrato/paisagem, quatro margens em mm, espaçamento em mm, permissão de giro, versão, assinatura determinística e estado;
- **folhas**: revisão do plano, índice da folha, dimensões físicas e orientação escolhida;
- **ocorrências**: folha, item, índice da cópia, posição `x/y`, largura/altura e rotação física, tudo em milímetros.

Uma função autenticada salvará configuração, folhas e ocorrências na mesma transação, validando permissão, vínculo de todos os itens ao trabalho, quantidades, formatos e limites físicos. Leitura seguirá `foto_express.visualizar`; gravação exigirá `foto_express.trabalhos.editar`. As novas tabelas terão GRANTs, RLS, índices e políticas na mesma migration.

### 3. Motor matemático independente da interface
- Criar biblioteca pura, sem dependência do React, com conversões centralizadas entre cm, mm e pixels de preview.
- Expandir cada item em ocorrências conforme `quantidade`, sem duplicar item ou arquivo.
- Implementar posicionamento determinístico por tamanho/área e preenchimento em linhas, avaliando giro de 90° da peça quando permitido.
- Para orientação automática do papel, calcular retrato e paisagem e escolher deterministicamente o melhor resultado por: menos folhas, maior aproveitamento e critério estável de desempate.
- Nunca reduzir peças; retornar erro detalhado quando uma peça não couber na área útil.
- Garantir margens, espaçamento, ausência de sobreposição e tamanho físico original.
- Calcular aproveitamento como `área total das peças ÷ área útil total das folhas × 100`.

### 4. Revisão do trabalho
Criar uma rota própria acessível pela Galeria com:
- número e cliente;
- total de fotos e cópias;
- agrupamento por formato e orientação;
- qualidade/DPI e contagens por faixa;
- quantidade, textos e estado de edição por foto;
- avisos para DPI abaixo de 220/150, formato ausente, configuração incompleta, imagem indisponível, quantidade inválida e inconsistências.

Baixa qualidade será apenas informativa. Problemas estruturais impedirão a montagem e oferecerão atalhos para a Galeria ou o Editor da foto afetada.

### 5. Configuração e preview das folhas
- Disponibilizar A4 e A3 com dimensões físicas conhecidas, orientação retrato/paisagem/automática, margens independentes, espaçamento único e opção de girar peças.
- Recalcular localmente ao mudar controles; persistir somente ao confirmar a montagem.
- Exibir folhas proporcionais, margens, peças, espaçamento, identificação de foto/formato/cópia e navegação entre folhas.
- Cada peça reproduzirá thumbnail, enquadramento, orientação, rotação, espelhamentos, textos e fundo/área interna do formato, sem carregar todos os originais.
- Mostrar folhas, peças, peças por folha, área útil, área ocupada e aproveitamento.
- Em celular, organizar controles verticalmente e escalar apenas a representação visual, nunca as medidas persistidas.
- Usuários somente leitura poderão consultar revisão e plano salvo, sem alterar ou regenerar.

### 6. Invalidação e reabertura
- Gerar uma assinatura determinística a partir dos dados que afetam a montagem: itens, quantidades, formatos, orientação, edição, textos e configuração do papel.
- Comparar a assinatura atual com a persistida para exibir **Montagem desatualizada**.
- Reabrir um trabalho deverá reproduzir exatamente folhas e posições salvas enquanto a assinatura permanecer válida.
- Mudanças posteriores não apagarão silenciosamente o plano anterior; ele ficará marcado para regeneração.

## Validação
- Testes matemáticos locais com A4/A3, retrato/paisagem, formatos 10×15, 15×20, 20×30, 5×7, mistos e formato com área interna; quantidades variadas; margens 0/3/5/10 mm; espaçamentos 0/2/5 mm; giro ligado/desligado.
- Verificar determinismo, limites, margens, espaçamento, sobreposição, tamanho físico, abertura de folhas, peça que não cabe, cálculo de aproveitamento e conversão futura `mm / 25,4 × DPI`.
- Testar matematicamente área externa/interna, bordas, orientação e textos dos formatos especiais.
- Validar visualmente revisão e preview em desktop e celular, sem persistir alterações em trabalhos reais.
- Classificar no relatório final o que foi funcionalmente comprovado, tecnicamente validado e não validado funcionalmente.

## Restrições
- Não gerar arquivos finais, renderização em 300 DPI, download, impressão ou editor manual das peças.
- Não tratar órfãos antigos, MIME ou provisionamento da VPS.
- Não atualizar dependências ou lockfiles, não publicar e não iniciar a Etapa 5.
- Não criar ou modificar dados reais apenas para testes.
- Espelhar toda migration oficial em `supabase/migrations/`, mantendo SQL idêntico e ordem cronológica.
