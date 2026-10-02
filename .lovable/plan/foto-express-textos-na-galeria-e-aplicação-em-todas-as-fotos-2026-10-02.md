# FOTO EXPRESS — textos na Galeria e aplicação em todas as fotos

## Objetivo
- Mostrar na miniatura da Galeria os textos já salvos em cada foto, preservando posição, largura, tamanho, fonte, cor, alinhamento, rotação e ordem.
- Adicionar no editor de textos a ação **Aplicar em todas as fotos**.
- A ação criará cópias independentes do texto selecionado nas demais fotos do mesmo trabalho; alterações posteriores continuarão isoladas por foto.

## Implementação
1. **Galeria com textos**
   - Buscar em uma única consulta os textos dos itens do trabalho.
   - Agrupar os textos por foto e enviá-los à miniatura já existente.
   - Reutilizar a mesma composição usada na revisão: textos sobre a área física completa do formato e acima da fotografia.
   - Manter o comportamento atual para fotos sem formato e o estado de erro/recarregamento da Galeria.

2. **Ação no editor**
   - Incluir **Aplicar em todas as fotos** junto às ações do texto selecionado.
   - Pedir confirmação informando quantas outras fotos receberão a cópia.
   - Desabilitar a ação em modo somente leitura, durante salvamento ou quando não houver outra foto no trabalho.
   - Após concluir, exibir retorno claro e atualizar os dados usados pela Galeria/revisão.

3. **Cópia segura e atômica**
   - Criar uma operação protegida no banco que valide autenticação, permissão de edição, vínculo do texto e das fotos ao mesmo trabalho.
   - Copiar conteúdo e todos os atributos visuais normalizados para cada outro item, sem alterar textos existentes.
   - Atribuir a cada cópia a próxima ordem numérica da foto de destino, mantendo todos os textos acima da fotografia.
   - Executar tudo em uma única transação: ou todas as cópias são criadas, ou nenhuma é.
   - Retornar a quantidade de fotos que receberam o texto; repetir a ação posteriormente criará novas cópias independentes.

4. **Validação**
   - Testar localmente agrupamento e representação dos textos nas miniaturas com formatos Retrato e Paisagem.
   - Validar que posição e tamanho permanecem proporcionais e independentes do tamanho da miniatura.
   - Validar permissões, pertencimento ao trabalho, ordem das camadas e rollback da operação em erro.
   - Conferir compilação e visual em desktop e celular sem criar ou alterar dados reais e sem publicar.

## Detalhes técnicos
- Reutilizar `PecaFoto`, que já renderiza fotografia e textos com a mesma referência normalizada usada na revisão.
- Adicionar uma função de servidor tipada para a nova operação protegida.
- Aplicar migration incremental pelo fluxo oficial e manter a cópia SQL idêntica em `supabase/migrations/`, sem editar manualmente o controle interno de migrations.
- Não alterar originais, thumbnails, enquadramentos, formatos, montagem ou arquivos finais.
