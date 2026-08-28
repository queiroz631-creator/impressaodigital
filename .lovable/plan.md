# Corrigir formação duplicada na importação de currículo

## O que está acontecendo (confirmado nos dados)

Nos currículos importados, a mesma escolaridade aparece duas vezes:

- Currículo "Adriana Pereira Santos Sirqueira": escolaridade = "Ensino Médio Completo" **e** uma formação adicional com nível "Ensino Médio Completo" e curso vazio.
- Currículo "Joyce Ananias Vieira": escolaridade = "Ensino Fundamental Completo" **e** uma formação adicional com nível "Ensino Fundamental" e curso vazio.

Causa: as instruções enviadas à IA pedem tanto o campo `escolaridade` quanto a lista `formacoes`, sem dizer que a lista é só para formações **extras**. A IA então repete a mesma linha nos dois lugares. Além disso, a importação aceita formações sem nome de curso (só o nível), que são exatamente essas linhas duplicadas.

## Correção

1. **Instrução clara para a IA**: `escolaridade` é a formação principal (a mais alta); `formacoes` recebe apenas formações **adicionais**, com curso/instituição próprios, nunca repetindo a escolaridade principal nem entradas sem nome de curso.
2. **Filtro na normalização**: descartar formações importadas que
   - não tenham nome de curso, ou
   - tenham nível equivalente à escolaridade principal e nenhum curso/instituição informados.
3. **Sem duplicar na mesclagem**: ao aplicar a importação sobre um currículo existente mantendo as listas, ignorar formações e cursos idênticos aos já cadastrados (mesmo nível + curso + instituição + ano, sem diferenciar maiúsculas).
4. **Limpeza dos registros já criados**: remover as formações fantasma existentes (sem nome de curso e com nível igual à escolaridade do currículo).

## Detalhes técnicos

- `src/lib/curriculo-import.server.ts`: ajustar o texto `SISTEMA` (regra de escolaridade x formações), endurecer o filtro em `formacoes` dentro da normalização e adicionar deduplicação em `atualizarImportado` para `formacoes`, `cursos`, `experiencias` e `telefones`.
- Migração de limpeza: `DELETE FROM curriculo_formacoes` para linhas com `nome_curso` vazio e `nivel` correspondente à `escolaridade` do currículo.
- Nada mais do módulo de currículo é alterado.
