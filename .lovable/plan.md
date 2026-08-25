# Ajustes no currículo (PDF e impressão)

Três correções no documento gerado, todas dinâmicas conforme o volume de texto de cada currículo.

## 1. Distribuição dinâmica do conteúdo na folha

Hoje o currículo curto termina na metade da página e o espaço extra só é distribuído quando sobra mais de 40% da folha, dividido apenas entre as seções — o topo (título, nome, telefones, e-mail) fica sempre apertado.

Novo comportamento:

- Medir o conteúdo real e calcular quanto espaço sobra na A4.
- Distribuir o espaço que sobra proporcionalmente entre **todos** os pontos de respiro, não só entre seções: cabeçalho (faixa → nome → telefones → e-mail), espaço antes de cada seção e espaço depois do conteúdo de cada seção.
- O cabeçalho recebe uma fatia maior do excedente (o topo é o ponto mais comprimido hoje).
- Limites: o excedente por ponto tem teto, para que um currículo com pouquíssimo conteúdo não vire uma folha com blocos flutuando isolados; e piso, para que um currículo cheio continue compacto (a escala de redução atual, até 0,7, permanece).
- Conteúdo longo continua sendo reduzido para caber em 1 página, sem alterar o resultado atual desses casos.

## 2. Observação como "OBS.:"

A observação deixa de ser uma seção com barra azul "OBSERVAÇÃO". Passa a ser um parágrafo final, logo após o Objetivo, iniciado por **OBS.:** em negrito, fonte um pouco maior, na cor navy, sem barra de cabeçalho.

## 3. Espaçamento entre seções

O espaço antes e depois de cada seção passa a vir do mesmo cálculo do item 1, mantendo simetria (mesmo respiro acima e abaixo do bloco de texto) e variando conforme o preenchimento da folha.

## Escopo técnico

- `src/lib/curriculo-pdf.ts`: substituir `espacamentoExtra / 2` fixo por um repartidor de folga com pesos (cabeçalho, pré-seção, pós-seção) calculado após a primeira passagem de medição; remover a chamada `secao("Observação")` e desenhar o parágrafo com prefixo `OBS.: `.
- `src/components/curriculo/CurriculoDocumento.tsx` (visualização e impressão do navegador): remover o `<Secao titulo="Observação">` e renderizar o parágrafo com `OBS.:`; alinhar os espaçamentos do cabeçalho e das seções ao mesmo critério, usando o ajuste automático de escala de impressão já existente.
- Nenhuma mudança em banco de dados, formulários ou demais telas.

## Verificação

Gerar o PDF de um currículo curto (o do Eduardo Queiroz) e de um longo, e conferir visualmente que o curto ocupa a folha de forma equilibrada, o longo continua em 1 página, e a observação aparece como "OBS.: ..." em ambos.
