# Otimizar a montagem automática

## Objetivo
Fazer a Revisão testar mais combinações de posição e giro das fotos, escolhendo primeiro a montagem com menos folhas e, em empate, o melhor aproveitamento.

## Implementação
- Ampliar as estratégias de ordenação e encaixe usadas na montagem.
- Testar também variações determinísticas de orientação inicial das peças, sem alterar o enquadramento da foto.
- Manter a separação por papel padrão e respeitar margens, espaçamento, orientação e permissão de giro de cada papel.
- Preservar o formato persistido das folhas e a geração de impressão existente.

## Validação
- Recalcular localmente o cenário do trabalho #000002, sem salvar alterações.
- Confirmar que nenhuma peça sobrepõe outra ou ultrapassa a área útil.
- Comparar quantidade de folhas e aproveitamento com o resultado atual.
- Validar compilação e a tela de Revisão; não publicar.

## Detalhes técnicos
A busca continuará determinística. Ela executará múltiplas ordens de peças e preferências de rotação sobre o empacotamento existente, classificando os resultados por: número de folhas, aproveitamento e desempate estável.
