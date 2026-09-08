# Fixar formulário de melhorias ao rolar a lista

## Objetivo

Na tela **Melhorias**, ao rolar a lista do lado direito, o card do formulário (lado esquerdo) deve permanecer visível e fixo na tela.

## Como vai funcionar

- O layout de duas colunas (`lg:grid-cols-[380px_1fr]`) continua igual.
- O card da esquerda (formulário de nova/editar melhoria) recebe `position: sticky` no desktop, alinhado ao topo da área de conteúdo.
- Ao rolar a lista da direita, o formulário acompanha o scroll até o fim da página e depois solta naturalmente.
- Em telas mobile (`< lg`) o formulário continua empilhado normalmente, sem efeito fixo.
- Nenhuma funcionalidade de cadastro, edição, exclusão ou layout do grid é alterada.

## Detalhes técnicos

- Arquivo: `src/routes/melhorias.tsx`.
- Aplicar classes no `<Card className="shadow-card">` da coluna esquerda para desktop:
  - `lg:sticky lg:top-6 lg:self-start`
- Manter `shadow-card` e todas as classes existentes.
- Ajustar altura máxima se necessário para evitar que formulários muito altos vazem da viewport (`lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto`).
- Verificar se o container pai (`<main>` ou `<div>` do `AppLayout`) permite `position: sticky` (overflow visível).

## Validação

- Executar typecheck e build.
- Abrir `/melhorias`, adicionar várias melhorias e rolar a lista para confirmar que o formulário da esquerda fica fixo.
- Verificar em resolução mobile que não há regressão no empilhamento.
