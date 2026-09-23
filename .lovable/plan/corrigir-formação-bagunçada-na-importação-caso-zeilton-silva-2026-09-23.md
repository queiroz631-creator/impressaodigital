# Corrigir formação bagunçada na importação (caso Zeilton Silva dos Reis)

## O que está acontecendo

A ficha do Zeilton tem 13 linhas gravadas em "Outras graduações", e quase nenhuma é formação: entraram "Empresa: Extrafrut", "Cargo/função: Promotor de Vendas", "Período/tempo: 03 Anos", as habilidades e o texto inteiro do objetivo. Nenhuma delas pode ser corrigida ou apagada na tela por dois motivos:

- O bloco "Outras graduações" só aparece quando a escolaridade escolhida é de ensino superior; a dele é "Ensino Fundamental Incompleto", então o bloco fica escondido.
- Mesmo aparecendo, os campos (curso, instituição, ano) e o botão de apagar só surgem quando a linha tem um nível selecionado; 12 das 13 linhas estão sem nível.

## O que será feito

### 1. Tornar as formações sempre visíveis e editáveis

- O bloco "Outras graduações" passa a aparecer em qualquer escolaridade sempre que já existir alguma formação gravada (continua aparecendo normalmente no ensino superior).
- Toda linha existente mostra os campos de curso, instituição e ano e o botão de remover, mesmo sem nível selecionado — assim dá para corrigir ou apagar o que veio errado.
- Quando o nível gravado não for um dos níveis da lista (por exemplo "Ensino Fundamental Incompleto"), ele aparece como opção no seletor daquela linha em vez de sumir.

### 2. Evitar que a importação volte a gravar lixo na formação

Na leitura por regras, o trecho de formação hoje continua engolindo o resto do documento quando as seções seguintes não têm título. Ajustes:

- Encerrar o trecho de formação ao encontrar linhas com rótulos de experiência ("Empresa:", "Cargo", "Função", "Período", "Admissão", "Atividades") ou de objetivo.
- Descartar linhas que são apenas o nome da escolaridade, frases longas (acima de ~80 caracteres) e linhas que terminam em vírgula ou "e" (continuação de texto corrido).
- Limitar a 6 formações por currículo.

### 3. A ficha do Zeilton

Não vou apagar linhas direto no banco. Depois do ajuste, as 13 linhas aparecem na etapa de escolaridade com o botão de remover, e podem ser limpas na tela em poucos cliques.

## Detalhes técnicos

- `src/components/curriculo/FormularioCurriculo.tsx`: condição do bloco de formações passa a ser `escolaridadeTemCurso(escolaridade) || formacoes.length > 0`; campos e botão de remover liberados para `i < formacoes.length`; seletor de nível recebe os níveis de `NIVEIS_FORMACAO` mais o valor atual quando fora da lista.
- `src/lib/curriculo-regras.ts`: filtro extra no mapeamento de `formacoes` (linha ~586) com rejeição por rótulo de experiência/objetivo, comprimento e terminação, e `slice(0, 6)`.
- Sem mudança de banco.
