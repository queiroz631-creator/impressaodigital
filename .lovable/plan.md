# Refinamento visual do modal do sorteio

Deixar o modal da apuração mais moderno, com números maiores e dados do ganhador maiores. Apenas apresentação: nada muda na lógica, no servidor, na regra do sorteio ou na animação de decisão (o servidor continua escolhendo o vencedor antes da animação).

## O que muda

### Roleta (`RoletaCupons.tsx`)
- Número do cupom muito maior: de `text-3xl/sm:text-5xl/md:text-6xl` para escala maior (ex.: `text-5xl sm:text-7xl md:text-8xl`), mantendo `font-mono tabular-nums` e responsividade sem quebrar em telas pequenas.
- Visual mais moderno: faixa/visor central com fundo destacado (borda, gradiente sutil do tema, sombra suave), altura mínima maior, espaçamento maior.
- Estado "parou" com destaque mais forte: brilho/anel na cor primária, escala maior, transição suave.
- Rótulo superior ("Sorteando..." / "Cupom sorteado") um pouco maior, com ícone maior.
- A mecânica da animação (velocidade, desaceleração, parada no número do servidor) não muda.

### Modal (`PainelSortear.tsx`)
- Modal mais largo (ex.: `max-w-2xl`), título e descrição maiores.
- Resultado final dentro do modal em tamanho maior: cupom vencedor em destaque grande no topo (fonte mono, cor primária), seguido dos dados (Prêmio, Participante, CPF, Telefone, Data) com rótulos e valores em texto maior (`text-base`/`text-lg`), CPF e telefone continuam protegidos (`•••• 1234`).
- Botão "Fechar" maior.
- Card do ganhador na página (fora do modal) e histórico permanecem como estão — o pedido é só o modal.

## Não altera
- Lógica de sorteio, RPCs, banco, auditoria, permissões, regras de proteção de dados.
- Demais telas do módulo.

## Validação
- `bunx tsgo --noEmit` sem erros.
- Verificação visual via Playwright do modal em desktop e largura de celular.
- Sem sorteio real em base de produção, sem commit/push/publicação.
