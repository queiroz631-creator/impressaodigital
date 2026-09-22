# Descrição da TAG no orçamento rápido

Adicionar ao orçamento rápido a descrição completa da TAG dentro de **Observações**, seguindo o mesmo conteúdo já exibido na imagem gerada.

## Alteração

- Incluir no texto do orçamento rápido enviado pelo WhatsApp a seção **Observações** quando houver conteúdo.
- Reaproveitar a observação já montada pela calculadora, que reúne:
  - identificação da TAG;
  - tamanho em centímetros;
  - quantidade de TAGs;
  - observação digitada manualmente, quando houver.
- Manter cada TAG e a observação manual em linhas separadas.
- Não exibir a seção quando estiver vazia.

## Escopo técnico

- Ajustar somente o formatador do texto do orçamento em `src/lib/orcamento-zap.ts`.
- Não alterar cálculos, valores, quantidade por folha, imagem, PDF ou gravação dos pedidos.
- Validar a geração de um orçamento rápido com TAG e observação manual.
