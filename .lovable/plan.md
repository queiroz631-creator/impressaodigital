# Ajustar a identificação do ganhador

Na aba **Sortear**, simplificar a identificação exibida e proteger os dados pessoais do ganhador.

## Alterações na tela

- Remover o campo/coluna **Cliente** do card de ganhador e do **Histórico dos ganhadores**.
- Manter **Participante** como o nome da pessoa sorteada.
- Exibir **CPF** e **Telefone** somente pelos quatro últimos dígitos, por exemplo `•••• 1234`.
- Aplicar a mesma apresentação tanto ao resultado recém-sorteado quanto aos resultados carregados do histórico após atualizar a página.
- Quando o CPF ou telefone não estiver preenchido, mostrar `—`.

## Dados e privacidade

- Atualizar as rotinas existentes `sorteio_realizar` e `sorteio_apuracao_resumo`; não criar tabela nem coluna nova.
- Buscar CPF e telefone pelo cliente já vinculado ao participante vencedor.
- Retornar ao navegador somente os quatro últimos dígitos normalizados de cada dado, sem enviar CPF ou telefone completos.
- Manter internamente os vínculos existentes entre sorteio, prêmio, cupom, participante e cliente; apenas o campo Cliente deixa de ser apresentado nessa tela.

## Escopo preservado

- Não alterar a escolha do vencedor, elegibilidade, ordem dos prêmios, concorrência, auditoria ou transição de situação.
- Não alterar notas, saldo, fontes, contribuições, cupons, fechamento, reabertura ou integrações.
- Atualizar os tipos usados pela apuração para os dois novos valores parciais.
- Verificar tipos e compilação, sem realizar sorteio real, sem testes que alterem dados e sem publicar.
