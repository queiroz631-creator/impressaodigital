# Ordenar experiências profissionais no currículo

Hoje as experiências aparecem na ordem em que foram digitadas, sem opção de mudar. A ordem da lista já é a ordem exibida no currículo (visualização, impressão e PDF), então basta permitir reordenar a lista no formulário — nenhuma mudança no banco ou no documento.

## O que muda

- Cada bloco de experiência ganha botões **↑ subir** e **↓ descer** (setas), ao lado do botão Remover.
- Ao clicar, a experiência troca de posição com a vizinha; a primeira não sobe e a última não desce (botões desabilitados nesses casos).
- Ao salvar, a nova ordem é gravada e passa a valer na visualização, na impressão e no PDF.
- Vale nos dois modos do formulário (admin e link do cliente), que usam a mesma tela.

## Detalhes técnicos

- Arquivo: `src/components/curriculo/FormularioCurriculo.tsx`.
- Helper `moverExperiencia(indice, direcao)` que troca os itens do array `experiencias`.
- Botões com ícones `ArrowUp` / `ArrowDown` (lucide), `disabled` nas extremidades.
- Nenhuma alteração de banco, RPC, validação ou documento.

## Fora do escopo

- Cursos, formações e habilidades continuam sem reordenação.
- Nada de arrastar-e-soltar (drag); apenas setas.
