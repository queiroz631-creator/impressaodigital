# Portal de Sorteios: mostrar só a logo quando não houver sorteio ativo

## O que muda para o cliente
- Ao abrir o portal, enquanto o sistema confere se há sorteio, aparece só um indicador de carregamento (o campo de CPF não pisca na tela).
- Se não houver sorteio ativo ou o período não for válido: a tela mostra **apenas a logo do portal**, centralizada e em destaque, com uma frase curta abaixo (ex.: "No momento não há sorteio em andamento."). Sem título "Participe do sorteio", sem pedido de CPF e sem nenhum campo.
- Com sorteio ativo, nada muda: segue o fluxo atual pelo CPF.
- As outras telas do portal (telefone, cadastro, notas...) com sorteio inativo voltam para essa tela de logo.

## Detalhes técnicos
- `src/routes/sorteios-publico.index.tsx`: tratar `sorteio.isLoading` (spinner) e `indisponivel` (render próprio só com a logo + mensagem do servidor), sem `titulo`/`subtitulo` de CPF.
- Reaproveitar a logo já usada em `LayoutPublico.tsx` (logo configurável do portal com recurso à logo padrão), extraindo-a para um pequeno componente `LogoPortal` compartilhado.
- Demais rotas `sorteios-publico.*`: se a consulta de sorteio ativo indicar indisponível, redirecionar para `/sorteios-publico`.
- Nenhuma alteração no banco; nada publicado.
