# Plano: linhas, preços por folha e orçamento no portal FOTO EXPRESS

## Resultado esperado
- O cadastro de papel permitirá ativar uma linha de separação no espaço entre as fotos, escolher sua cor e definir a espessura em milímetros.
- Cada papel terá um valor padrão por folha e faixas opcionais de valor por quantidade, no mesmo formato usado nos materiais (`quantidade = valor`).
- A cobrança será calculada por folha efetivamente necessária, inclusive quando a folha tiver apenas uma foto.
- No portal, o cliente verá quantas fotos do formato escolhido cabem em cada papel, a quantidade estimada de folhas e o valor atualizado do álbum.
- Antes de enviar, o portal mostrará uma confirmação interna com o total e destacará quando a última folha de algum papel ainda comportar mais fotos.

## Implementação
1. **Cadastro de papéis**
   - Adicionar campos de linha: ativada, cor e espessura.
   - Adicionar valor padrão da folha e faixas por quantidade.
   - Validar cor, espessura, preços e faixas antes de salvar.
   - Exibir um resumo dessas configurações nos cards e na revisão.

2. **Cálculo único de montagem e preço**
   - Reutilizar o motor de montagem em milímetros para agrupar as fotos pelo papel padrão e obter o número real de folhas.
   - Aplicar a faixa de preço pela quantidade de folhas de cada tipo de papel; o valor da faixa será o valor unitário de todas as folhas daquele tipo.
   - Detectar folha incompleta simulando se mais uma cópia de algum formato do grupo ainda cabe sem criar outra folha.
   - Centralizar capacidade, total de folhas, valor unitário e total em uma função compartilhada para evitar diferenças entre portal e revisão interna.

3. **Portal do cliente**
   - Retornar somente os dados públicos necessários do papel e o resumo calculado do álbum.
   - Mostrar a capacidade por folha no seletor de formato e um quadro com fotos/cópias, folhas estimadas e valor estimado.
   - Atualizar o quadro após upload, duplicação, exclusão, mudança de formato ou quantidade.
   - Trocar a confirmação simples de envio por uma janela do sistema com o valor e o aviso de folha incompleta.
   - Manter o envio bloqueado até a confirmação do cliente.

4. **Prévia e impressão**
   - Desenhar a linha no centro do espaçamento, com cor e espessura cadastradas, tanto na prévia quanto nos arquivos finais a 300 DPI.
   - Persistir as opções da linha junto de cada folha confirmada, preservando montagens antigas.
   - Salvar no álbum, no momento do envio pelo cliente, o resumo e o valor estimado para manter o orçamento apresentado mesmo se os preços mudarem depois.

5. **Validação**
   - Conferir cadastro/edição de papel, faixas de preço e cálculo com folha parcial.
   - Conferir no portal a atualização do valor e a confirmação de envio sem enviar um álbum real.
   - Conferir visualmente a linha na prévia e validar geração/compilação.

## Detalhes técnicos
- Mudança aditiva no banco, com migração oficial também em `supabase/migrations/` e sem alterar dados reais existentes.
- Novos campos do papel terão valores padrão seguros: linha desativada, cor preta, espessura de 0,2 mm, preço zero e faixas vazias.
- A montagem continuará determinística e baseada nas dimensões físicas; preço e estilo da linha entrarão no snapshot imutável.
- Nenhuma publicação será realizada.
