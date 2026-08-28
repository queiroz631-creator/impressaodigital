# Calculadora (TAGs e confirmação de páginas) + Excel em Configurar Preços

## 1. Confirmar páginas dos arquivos com mais de 1 página

Ao anexar arquivos, se algum tiver mais de uma página, aparece um aviso na coluna de arquivos:
"Confirme a quantidade de páginas lida" com a lista (arquivo → páginas detectadas) e o botão **Confirmar páginas**.

Enquanto não confirmar, o campo **Tipo de impressão** fica bloqueado (e, por consequência, material, valores e resumo continuam ocultos como já acontece hoje). Editar a quantidade de páginas de um arquivo ou anexar novos arquivos com mais de 1 página pede a confirmação de novo. Arquivos gerados pela função TAG e arquivos de 1 página não exigem confirmação.

## 2. Tamanho da TAG pela quantidade por folha

No bloco TAG, novo campo **TAGs por folha (desejado)**. Ao informar, por exemplo, 8, o sistema calcula o tamanho de TAG que cabe nessa quantidade dentro da área de impressão do formato atual (respeitando o espaçamento de 1 mm) e preenche automaticamente Largura e Comprimento, mostrando a distribuição usada (ex.: "2 colunas x 4 linhas"). Largura e comprimento continuam editáveis manualmente — mexer neles recalcula "tags por folha" como hoje.

## 3. Destaque visual

Os campos **Tags por folha** e **Total de TAGs / Total de folhas** passam a ser exibidos em caixas destacadas (fundo e borda na cor de destaque do sistema, número em negrito maior), para diferenciá-los dos campos de digitação.

## 4. Inversão do resultado do total

O campo de resultado passa a mostrar o oposto do que foi informado:
- informando **Quantidade de TAGs** → o resultado exibe **Total de folhas**;
- informando **Quantidade de folhas** → o resultado exibe **Total de TAGs**.

O arquivo gerado continua com o mesmo nome e a mesma quantidade de folhas de hoje.

## 5. Exportar e importar Excel em Configurar Preços

Nas abas **Materiais** e **Acabamentos**, dois botões: **Exportar Excel** e **Importar Excel**.

- Exportar gera um `.xlsx` com uma planilha por aba, contendo todas as colunas configuráveis (materiais: nome, descrição, categoria, tipo de impressão, formato, preço uni, preço por arquivo, quantidade/preço de arquivos fixos, faixas, ativo, ordem; acabamentos: nome, tipo de impressão, cobrança, valor, páginas por bloco, faixas, exibições, ativo, ordem). As faixas vão em texto no formato "até 10 = 1,50; até 50 = 1,20".
- Importar lê o mesmo arquivo, mostra uma prévia com quantos registros serão criados, atualizados e quantas linhas têm erro, e só grava após a confirmação. A identificação é pelo `id` da planilha (linha sem id vira registro novo); nada é excluído pela importação.
- Valores em vírgula decimal (padrão brasileiro) são aceitos na importação e usados na exportação.

## 6. Corrigir formação duplicada na importação de currículo

Confirmado nos dados: em currículos importados a mesma escolaridade aparece duas vezes — no campo principal e como formação adicional sem nome de curso (ex.: "Ensino Médio Completo" e "Ensino Fundamental").

Causa: as instruções enviadas à IA pedem `escolaridade` e a lista de formações sem dizer que a lista é só para formações **extras**.

Correção:
- Instrução clara para a IA: escolaridade é a formação principal; a lista recebe apenas formações adicionais com curso próprio.
- Descartar na importação formações sem nome de curso ou que só repitam a escolaridade principal.
- Ao aplicar a importação sobre um currículo existente, ignorar formações/cursos idênticos aos já cadastrados.
- Limpeza dos registros fantasma já criados.

## Detalhes técnicos

- `src/routes/index.tsx`: estado `paginasConfirmadas` (chave por lista de arquivos) bloqueando o Select de tipo de impressão; novo campo `tagsPorFolhaDesejado` e função de dimensionamento; inversão do rótulo/valor do total; classes de destaque nos dois campos de resultado.
- `src/lib/calc.ts` (junto de `tagsPorFolha`): nova função `tamanhoTagPorQuantidade(qtdPorFolha, area)` que testa combinações de colunas x linhas e devolve o maior tamanho possível.
- Novo `src/lib/precos-excel.ts` com a serialização/parse das planilhas (materiais e acabamentos) e conversão das faixas; usa a biblioteca `xlsx` (SheetJS), a ser instalada.
- `src/routes/precos.tsx`: botões de exportar/importar por aba e diálogo de prévia da importação; gravação via `supabase.from("materiais"/"acabamentos").upsert`.
