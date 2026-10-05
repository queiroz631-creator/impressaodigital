# Melhorias do portal FOTO EXPRESS

## O que será feito

1. **Edição móvel por gestos**
   - Permitir ampliar e reduzir a foto com pinça diretamente na prévia do editor no celular.
   - Ocultar os controles de zoom com menos/mais no celular, mantendo o controle atual no computador.
   - Preservar o limite atual de zoom, o enquadramento não destrutivo e o salvamento automático.

2. **Identificação e qualidade das fotos**
   - Ao enviar, exibir as fotos em sequência como `001`, `002`, `003` etc., preservando a extensão do arquivo.
   - Mostrar a descrição da qualidade antes do nome da foto nos cards e no cabeçalho do editor.

3. **Nome público do formato**
   - Adicionar ao cadastro de formato um campo separado para o nome exibido ao cliente.
   - Usar esse nome no seletor do portal e abaixo do nome da foto no card.
   - Manter o nome interno atual para a equipe e usar esse valor como fallback quando o nome público estiver vazio.

4. **Controles individuais nos cards**
   - Trocar a quantidade de cópias por botões de menos e mais, adequados ao celular.
   - Adicionar exclusão individual com confirmação dentro do sistema em celular e computador.
   - Adicionar seletor de formato em cada foto; ao alterar, salvar a orientação correspondente e refazer imediatamente o orçamento.

5. **Resumo comercial simplificado**
   - Mostrar `Fotos` como a soma total das unidades impressas, incluindo as cópias, sem apresentar as folhas.
   - Exibir o valor total em destaque.
   - Listar cada formato utilizado com seu nome público e seu múltiplo conforme a capacidade no papel.
   - Recalcular resumo, múltiplos e valor após mudar formato, quantidade ou excluir foto.

## Dados e segurança

- Criar uma migração apenas para o novo nome público do formato e registrá-la em `supabase/migrations/`.
- Não alterar montagem, orientação do papel, preços ou dados de álbuns existentes.
- Manter as validações de propriedade e bloqueio depois do envio.
