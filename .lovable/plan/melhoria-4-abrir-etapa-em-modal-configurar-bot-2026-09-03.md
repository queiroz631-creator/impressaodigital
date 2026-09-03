# Melhoria 4 — Abrir etapa em modal (Configurar Bot)

Hoje, ao clicar em uma etapa do fluxo em Configurar Bot → Fluxos, o formulário de edição abre expandido dentro do próprio card da etapa, empurrando a lista para baixo. A melhoria é abrir esse formulário em um modal (janela sobreposta) para editar e salvar.

## O que muda

- Clicar na etapa (ou no botão de abrir) passa a abrir um modal com o formulário completo da etapa: mensagem, tipo de mensagem/mídia, modo de avanço, tipo de resposta, ação, destinos e as opções da etapa.
- "Adicionar etapa" abre o mesmo modal, no modo "Nova etapa".
- Botões "Salvar" e "Cancelar" ficam no modal. Salvar grava etapa + opções (comportamento atual), fecha o modal e recarrega a lista.
- O card da etapa na lista mantém o resumo atual (mensagem, modo de avanço, quantidade de opções), agora sempre visível, já que não há mais expansão.
- Mover para cima/baixo e excluir continuam no card, iguais ao que já existem.
- Modal com rolagem interna para caber formulários longos em telas menores.

## Detalhes técnicos

- Arquivo único: `src/components/bot/FluxoConfigurador.tsx`.
- Substituir o estado `aberta` (expansão inline) por um controle de modal, reutilizando o componente `EditorEtapa` sem alterar sua lógica de formulário.
- Usar `Dialog` de `@/components/ui/dialog` (padrão já usado no projeto), com `max-w-3xl` e conteúdo rolável.
- `salvarEtapa`, `excluirEtapa` e `moverEtapa` permanecem inalterados; apenas o fechamento do modal é acionado após salvar/cancelar.
- Nenhuma mudança de banco de dados, de lógica do bot ou de outras telas.
