# Alterar CPF do cliente no módulo Currículos

## Objetivo
Adicionar um botão "Alterar CPF" na tela de detalhes do currículo, que abre um modal para corrigir o CPF. O novo CPF é gravado no currículo e no cadastro do cliente vinculado, mantendo os dois iguais.

## O que será feito

1. **Botão na tela do currículo** (`src/routes/curriculos.$id.tsx`): ao lado do CPF exibido no topo, um botão "Alterar CPF" abre um modal.

2. **Modal de alteração:**
   - Campo de CPF com máscara automática (000.000.000-00), pré-preenchido com o CPF atual.
   - Validação com a regra já existente (`cpfValido`): 11 dígitos e verificadores válidos — nenhuma mudança na regra de validação.
   - Bloqueio se o novo CPF já estiver em uso por outro currículo, com mensagem clara.
   - Botão salvar com estado "Salvando…" e trava contra cliques duplicados; em erro, o modal permanece aberto com o valor digitado.

3. **Gravação no servidor** (nova função `alterarCpfCurriculo` em `src/lib/curriculo.functions.ts`):
   - Exige usuário autenticado com permissão de currículos (`tem_permissao`, chave `curriculos.visualizar` — mesma usada hoje nas ações do módulo).
   - Valida o CPF novamente no servidor.
   - Verifica unicidade: rejeita se outro currículo já usa o CPF.
   - Atualiza `curriculos.cpf` e, quando houver `cliente_id` vinculado, atualiza também o CPF no cadastro do cliente na mesma operação.
   - Currículo sem cliente vinculado: atualiza apenas o currículo.

4. **Após salvar:** a tela recarrega os dados e mostra o novo CPF formatado; toast de confirmação.

## O que NÃO muda
- Regra de validação de CPF (mesma função `cpfValido` já existente).
- Link público do currículo (o CPF nunca é exposto no link público — continua assim).
- Nenhum outro módulo (WhatsApp, Sorteios, FOTO EXPRESS).
- Nenhuma migração de banco: a coluna e o índice de unicidade já existem.

## Verificação
- Testes com Playwright: alterar para CPF válido, tentar CPF inválido, tentar CPF já usado por outro currículo, e confirmar que o cadastro do cliente vinculado foi atualizado junto.
- Build e testes existentes do módulo.
- Nada será publicado sem seu pedido.
