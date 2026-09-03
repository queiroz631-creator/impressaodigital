# Preload com porcentagem ao receber arquivos do WhatsApp na calculadora

## Objetivo
Quando a calculadora receber arquivos vindos do WhatsApp, mostrar uma tela de carregamento (preload) bloqueando a interação até a leitura de todos os arquivos terminar, com contagem de progresso de 0% a 100%.

## O que muda na tela
- Ao abrir a calculadora com arquivos pendentes do WhatsApp, aparece um overlay centralizado (fundo esmaecido) com spinner e o texto de progresso, por exemplo: "Importando arquivos do WhatsApp… 45%".
- A porcentagem avança conforme cada arquivo é baixado e, na etapa final, enquanto as páginas são contadas.
- O overlay só desaparece quando todo o processo terminar (sucesso ou falha), deixando a tela pronta com os arquivos anexados.
- Nenhuma outra parte do layout ou fluxo muda (envio manual de anexos, WhatsApp, bot etc. ficam iguais).

## Detalhes técnicos
1. `src/routes/index.tsx` (único arquivo alterado):
   - Novo estado `importacao: { ativo: boolean; progresso: number }`.
   - Em `importarArquivosWhatsapp`: ativa o overlay no início; durante o loop de download de cada arquivo, atualiza o progresso proporcionalmente (ex.: 0% → 80% nos downloads; 80% → 100% na contagem de páginas/anexação); ao final (inclusive em erro), desativa o overlay.
   - Render do overlay: `div` fixa com `z-index` alto, fundo `bg-background/80` com blur, spinner (`Loader2` com `animate-spin`, já usado no projeto) e o percentual arredondado (`Math.round`), usando tokens semânticos do tema.
2. Sem alteração no banco, na rota de mídia, no WhatsApp ou em qualquer outro arquivo.
