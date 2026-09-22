# Nova logo e cor vermelha no Portal de Sorteios

## O que muda

1. **Logo**: a imagem enviada (círculo vermelho, "QUEIROZ PAPELARIA") passa a ser a logo exibida no topo do Portal de Sorteios, no lugar da atual.
2. **Cor**: tudo o que hoje é azul dentro do portal do participante (faixa do topo, botões, links, navegação inferior, destaques e foco dos campos) passa a ser vermelho, no mesmo tom da logo.

## Onde vale

Somente nas telas públicas do participante: entrada por telefone/CPF, termos, cadastro, painel, notas, cupons e informações.

O restante do sistema (administração, clientes, currículos, sorteios internos) continua exatamente com a cor azul atual.

## Detalhes técnicos

- Enviar a imagem para o CDN com `lovable-assets create` a partir de `/mnt/user-uploads/image_1-2.png`, gerando `src/assets/logo-queiroz-sorteios.png.asset.json`; usar esse ponteiro em `LayoutPublico.tsx` (substitui o import de `logo-impressao.png`, que segue disponível para o resto do sistema).
- Em `src/styles.css`, criar uma classe de escopo `.tema-portal-sorteios` que redefine apenas os tokens de marca para vermelho: `--primary`, `--ring`, `--accent`/`--accent-foreground` quando necessário, `--sidebar-primary`. Nenhum token global é alterado.
- Aplicar `tema-portal-sorteios` no `div` raiz de `src/modules/sorteios/components/publico/LayoutPublico.tsx`, de modo que todos os componentes filhos (incluindo `NavInferior` e os campos) herdem o vermelho sem edição individual.
- Conferir as telas do portal no navegador (desktop e mobile) e rodar `bunx tsgo --noEmit` mais o build.
- Sem commit, push, deploy ou publicação.
