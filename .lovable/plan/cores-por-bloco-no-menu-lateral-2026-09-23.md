# Cores por bloco no menu lateral

## Objetivo
Cada bloco do menu lateral (Operação, Comunicação, Marketing, Administração) ganha uma cor própria, aplicada ao título do bloco e aos seus links (ícone, marcador lateral e estado ativo), mantendo o fundo escuro atual do menu.

## Cores propostas
| Bloco | Cor |
|---|---|
| Dashboard (link solto) | neutra (sem cor, como hoje) |
| Operação | azul-celeste |
| Comunicação | verde |
| Marketing | roxo |
| Administração | âmbar/laranja |

## Mudanças

### src/lib/modulos.ts
- Novo campo `cor` no tipo `Modulo` (string com a chave da cor: `"azul" | "verde" | "roxo" | "ambar"`).
- Cada módulo recebe sua cor conforme a tabela acima.

### src/components/AppLayout.tsx
- Mapa `CORES_GRUPO` com as classes de cada cor (texto do título, cor do ícone, borda/marcador, fundo do item ativo e hover), definido com classes fixas para o compilador de estilos reconhecer.
- Título do bloco passa a usar a cor do grupo (com o peso atual em caixa alta).
- Cada sublink ganha:
  - ícone na cor do grupo;
  - marcador lateral fino (barra de 3–4 px) na cor do grupo quando o link está ativo;
  - estado ativo com fundo suave da cor do grupo (em vez do azul-padrão único);
  - hover mantendo o tom do grupo.
- O contador de mensagens não lidas e o botão Sair continuam como estão.
- Vale para o menu fixo (computador) e o menu móvel, que usam o mesmo código.

## Detalhes técnicos
- Cores definidas via utilitários de cor do Tailwind já existentes no tema (tons claros como sky-300, emerald-300, violet-300, amber-300 para bom contraste sobre o fundo escuro do menu); nenhuma mudança em styles.css.
- Nenhuma mudança de banco, rotas ou permissões — apenas apresentação.
- Sem `@source inline`: todas as classes aparecem como literais no mapa de cores.

## Verificação
- Conferir no navegador o menu com cada bloco na sua cor, títulos e sublinks, estado ativo e hover, no computador e no menu móvel.
