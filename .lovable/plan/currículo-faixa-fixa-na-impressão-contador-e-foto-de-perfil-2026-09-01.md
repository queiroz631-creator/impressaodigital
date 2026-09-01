# Currículo: faixa fixa na impressão, contador e foto de perfil

## 1. Faixa das seções com largura fixa na impressão

Hoje a impressão remove as margens internas do documento, então as faixas azuis ficam mais largas do que no PDF. A impressão passa a usar a mesma área útil do PDF (margens laterais iguais às da visualização), deixando as faixas com a mesma largura em tela, na impressão e no PDF.

## 2. Contador de currículos

Na tela de Currículo Vitae, exibir um campo com o total de currículos cadastrados no sistema (contagem total, independente do filtro/busca aplicados), junto ao cabeçalho existente — sem mudar o layout.

## 3. Foto de perfil

- Novo campo de foto no currículo, com upload disponível em três lugares: no formulário do sistema, no link de novo currículo e no link de atualização.
- **Listagem**: a foto aparece como miniatura redonda antes do nome; sem foto, mantém o ícone/inicial atual.
- **Tela do currículo**: a foto aparece no topo à direita, fora da folha do currículo, com um botão **"Exibir no Currículo"** (liga/desliga, salvo no currículo).
- **Impressão e PDF**: quando marcado, a foto é impressa com 2,5 cm de largura x 3,5 cm de altura, à direita da primeira faixa "CURRÍCULO VITAE" — topo alinhado com a linha superior da faixa e a borda direita alinhada com o fim da faixa. Quando desmarcado, nada muda no documento.

Todo o resto do currículo (campos, etapas, seções, PDF) permanece igual.

## Detalhes técnicos

Banco:
- `curriculos`: colunas novas `foto_url text` e `foto_exibir boolean not null default false`.
- Bucket público `curriculo-fotos` com leitura pública e políticas de upload para uso no sistema e nos links públicos (upload pelo link vai por função de servidor validando o token).

Arquivos:
- `src/lib/curriculo.ts`: tipos e `CamposCurriculo` com os dois campos novos.
- `src/lib/curriculo.server.ts` / `src/lib/curriculo.functions.ts`: incluir os campos na lista `CAMPOS` e no schema Zod; nova função de upload de foto validando o token do link.
- `src/components/curriculo/FormularioCurriculo.tsx`: campo de foto (upload/remover) na etapa de dados pessoais, funcionando também no modo público.
- `src/routes/curriculos.index.tsx`: selecionar `foto_url`, miniatura antes do nome e total de currículos.
- `src/routes/curriculos.$id.tsx`: `CAMPOS` atualizado, bloco da foto no topo à direita com o botão "Exibir no Currículo".
- `src/components/curriculo/CurriculoDocumento.tsx`: foto posicionada sobre a faixa do cabeçalho quando ativada.
- `src/lib/curriculo-pdf.ts`: desenhar a foto (70,9 x 99,2 pt) alinhada à faixa; e ajustar `imprimirCurriculo` para manter a largura da faixa igual à do PDF.
