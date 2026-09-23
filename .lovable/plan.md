# Currículo em PDF com o mesmo espaçamento da impressão

Hoje o PDF do currículo espalha o conteúdo para preencher a folha inteira: quando sobra espaço, o sistema distribui essa sobra entre o cabeçalho e cada seção, o que deixa o documento com buracos grandes entre os blocos. Na impressão isso não acontece — lá o conteúdo fica compacto no topo e só é reduzido quando não cabe.

## O que muda

- O PDF passa a usar o mesmo critério da impressão: espaçamento fixo e compacto, conteúdo começando no topo e a sobra ficando em branco no fim da página.
- Quando o currículo for maior que uma página, continua sendo reduzido proporcionalmente para caber em uma folha só (comportamento atual mantido).
- Nada muda no conteúdo, nas cores, na faixa das seções, na foto 2,5 x 3,5 cm, nem nas duas colunas de experiência quando há mais de três empresas.

## Detalhes técnicos

`src/lib/curriculo-pdf.ts`:

- Em `gerarCurriculoPdf`, remover o cálculo de `sobra`/`pontos`/`unidade` e passar `folga = { cabecalho: 0, secao: 0 }` na segunda passagem; manter a primeira passagem apenas para medir e calcular `escala` (mínimo 0,7).
- Simplificar a assinatura de `renderizar` removendo o parâmetro `folga` e todos os `+ folga.secao` / `+ folga.cabecalho` espalhados pelo render, deixando os respiros fixos já existentes (`8 * escala` entre seções, `6 * escala` entre experiências).
- Ajustar os respiros fixos do cabeçalho para acompanhar a proporção da impressão (faixa → nome → telefones → e-mail) sem depender de folga.
- `RenderResult.secoes` deixa de ser necessário para a distribuição; pode ser mantido apenas como retorno da medição ou removido junto com o contador.

Verificação: gerar o PDF de um currículo curto (para ver o topo compacto) e de um longo (para confirmar que ainda cabe em uma página), comparando com a pré-visualização de impressão.
