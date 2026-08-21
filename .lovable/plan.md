# Digitação livre com capitalização apenas ao salvar

## Problema confirmado

A normalização é aplicada a cada tecla digitada (nos campos nome, endereço, bairro, cidade, curso superior, pós-graduação, cursos, formações, empresa e cargo). Como a função remove espaços das pontas do texto, o espaço digitado ao final de uma palavra some imediatamente e o cliente não consegue separar as palavras.

## Solução

1. Deixar a digitação totalmente livre: os campos passam a guardar exatamente o que o usuário digita (com espaços, maiúsculas ou minúsculas).
2. Aplicar a capitalização somente no momento de salvar cada etapa — cada palavra fica com a inicial maiúscula e o restante minúsculo, preservando siglas (ex.: UF, RG, CNH) e sem alterar e-mail, CPF, telefone e CEP.
3. Ajustar a função de normalização para não descartar espaços internos e tratar corretamente palavras curtas de ligação (de, da, do, dos, das, e) mantendo-as em minúsculo, exceto quando forem a primeira palavra.

Efeito prático: o cliente digita como quiser ("joão carlos da silva" ou "JOÃO CARLOS DA SILVA") e o currículo salvo/exibido/impresso mostra "João Carlos da Silva".

## Notas técnicas

- `src/lib/curriculo.ts`: revisar `capitalizarTexto` (sem `trim` destrutivo durante digitação, lista de conectivos em minúsculo, siglas preservadas).
- `src/components/curriculo/FormularioCurriculo.tsx`: remover `capitalizarTexto` de todos os `onChange`; manter/estender sua aplicação apenas no payload enviado ao salvar cada etapa (incluindo cursos, formações, experiências e habilidades).
