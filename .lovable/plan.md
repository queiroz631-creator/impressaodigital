# Correção pontual da Galeria do FOTO EXPRESS

## Objetivo
Restabelecer a abertura da Galeria sem remover a proteção de integridade já criada, impedir carregamento infinito em caso de falha e concluir a auditoria dos arquivos sem item e dos tipos MIME. Nenhum dado existente, objeto, dependência ou funcionalidade fora deste fluxo será alterado.

## Correções

1. **Eliminar a ambiguidade PGRST201**
   - Ajustar a consulta dos itens para indicar explicitamente `foto_express_itens_arquivo_trabalho_fkey` no relacionamento com `foto_express_arquivos`.
   - Manter intactas tanto a FK simples quanto a FK composta que garante `item.trabalho_id = arquivo.trabalho_id`.
   - Revisar as demais consultas do módulo; a busca atual da Galeria é o único embed encontrado entre essas duas tabelas.

2. **Tratar falhas da Galeria**
   - Usar os estados de erro e recarregamento já fornecidos pela consulta.
   - Encerrar “Carregando galeria…” quando houver falha.
   - Exibir uma mensagem clara e um botão “Tentar novamente”, sem esconder os controles normais quando a consulta funcionar.

3. **Auditoria sem limpeza automática**
   - Documentar os seis arquivos sem item: ID, trabalho, criação, caminhos, existência do original e thumbnail e referências indiretas.
   - Informar que os seis pertencem ao trabalho #000001, seus 12 objetos físicos existem e não há referências em itens, configurações, textos ou fila de limpeza.
   - Comparar os horários desses registros com o histórico das correções para classificar, com o devido grau de certeza, se são compatíveis com o fluxo antigo de upload.
   - Propor saneamento posterior seguro: nova conferência de referências, registro pela fila transacional existente e remoção física somente após autorização explícita. Nada será limpo agora.

4. **Situação dos tipos MIME**
   - Relatar separadamente os três buckets: todos são privados e conservam os limites de 20 MB, 2 MB e 100 MB; atualmente `allowed_mime_types` está vazio nos três.
   - Registrar que o repositório contém um script que prevê JPG/PNG/WEBP para originais e thumbnails e nenhum limite de tipo para impressões, e que o deploy da VPS chama esse script.
   - Não executar o script nem modificar os buckets. Como o estado atual não comprova se ele nunca foi executado ou se a configuração MIME não persistiu, o relatório não afirmará uma causa sem evidência.

## Verificação

- Validar a compilação e os registros de erro sem atualizar pacotes.
- Abrir o trabalho existente em desktop e celular, sem upload e sem usar ações de alteração, duplicação ou exclusão.
- Confirmar que a Galeria exibe exatamente os três itens válidos e seus thumbnails.
- Confirmar que a requisição deixa de retornar PGRST201.
- Simular a falha de leitura apenas no navegador, interceptando a requisição, para comprovar a mensagem e o botão de nova tentativa sem alterar dados.
- Conferir que nenhuma outra consulta, dado, objeto, migration, dependência ou configuração foi modificada.

## Arquivos previstos

- `src/modules/foto-express/hooks/useFotoExpress.ts`
- `src/modules/foto-express/paginas/GaleriaPagina.tsx`

Nenhuma migration, arquivo de dependências, script de provisionamento ou configuração de Storage será alterado.
