# Troca de formato no editor FOTO EXPRESS

## Objetivo
Permitir escolher outro formato de impressão diretamente na tela de edição da foto.

## Implementação
- Carregar os formatos ativos no editor e adicionar o seletor junto aos ajustes.
- Recalcular imediatamente moldura, enquadramento, crop e DPI usando o novo formato.
- Salvar o formato escolhido, a orientação e os parâmetros de edição na mesma operação atômica.
- Manter o original intacto e atualizar a Galeria após salvar.

## Banco e segurança
- Criar migration incremental na pasta oficial para ampliar a função de salvamento com `formato_id`.
- Validar autenticação, permissão, vínculo do item ao trabalho e existência de formato ativo.
- Não alterar tabelas, arquivos ou dependências existentes fora desse fluxo.

## Validação
- Conferir troca entre formatos com proporções diferentes, autosave, DPI e retorno à Galeria.
- Validar desktop e celular sem publicar.
