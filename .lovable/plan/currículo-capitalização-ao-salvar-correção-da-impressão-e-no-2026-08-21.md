# Currículo: capitalização ao salvar, correção da impressão e novo cabeçalho

## 1. Digitação livre com capitalização apenas ao salvar

Hoje a normalização roda a cada tecla e remove os espaços das pontas, por isso o espaço entre palavras some.

- Os campos passam a aceitar exatamente o que o cliente digita (espaços livres, maiúsculo ou minúsculo).
- A capitalização "Cada Palavra Com Inicial Maiúscula" é aplicada somente no momento de salvar cada etapa.
- Siglas (UF, RG, CNH) são preservadas; e-mail, CPF, telefone e CEP não são alterados; conectivos (de, da, do, dos, das, e) ficam em minúsculo, exceto como primeira palavra.

## 2. Impressão em branco

A impressão atual esconde todo o conteúdo da página e não exibe nada. Correção: montar a área de impressão como um documento isolado, com o conteúdo clonado corretamente (incluindo estilos aplicados), garantindo que apenas o currículo apareça e que ele realmente seja renderizado — sem página extra em branco e sem folha vazia.

## 3. Cabeçalho do documento (PDF, visualização e impressão)

- "CURRÍCULO VITAE" passa a ser exibido dentro da mesma faixa azul usada nas seções, ocupando a largura do documento.
- Todo o cabeçalho fica centralizado: nome, telefones e e-mail.
- Mais espaço entre o nome e a linha de telefones.
- A seção "Dados pessoais" é mantida e passa a conter o endereço assim:
  - linha 1: endereço (rua/nº) e bairro
  - linha 2: cidade - UF e CEP (na mesma linha, se couber)

## Notas técnicas

- `src/lib/curriculo.ts`: ajustar `capitalizarTexto` (sem `trim` destrutivo, conectivos em minúsculo, siglas preservadas) e adicionar helper que devolve as linhas de endereço separadas.
- `src/components/curriculo/FormularioCurriculo.tsx`: remover `capitalizarTexto` de todos os `onChange` e aplicá-lo no payload de cada etapa (dados pessoais, formações, cursos, experiências, habilidades).
- `src/lib/curriculo-pdf.ts`: faixa azul com título centralizado no topo, cabeçalho centralizado, espaçamento maior antes dos telefones, endereço em duas linhas dentro de "Dados pessoais"; revisar `imprimirCurriculo` para clonar o nó com `cloneNode(true)` e CSS de impressão que mantém o conteúdo visível.
- `src/components/curriculo/CurriculoDocumento.tsx`: mesmo cabeçalho/ordem para manter paridade entre tela, impressão e PDF.
