# Botão "Ver dados completos" no histórico de ganhadores

## Objetivo

Na aba **Sortear**, o histórico de ganhadores continua mostrando CPF e telefone protegidos (`•••• XXXX`). Cada linha ganha um botão (ícone de olho) que abre um modal com os dados completos do participante — buscados no servidor somente quando o usuário pede.

## O que será feito

1. **Nova operação no servidor** — `dadosCompletosGanhador` em `src/lib/sorteios.functions.ts`:
   - Exige a permissão `sorteios.visualizar` (mesma da tela).
   - Recebe o `ganhadorId`, confirma que o ganhador existe e resolve o participante e o cliente vinculados.
   - Devolve dados completos em uma única resposta: nome, CPF (formatado), telefone (formatado), data de nascimento, e-mail, número do cupom vencedor, prêmio e data do sorteio.
   - Sem alterar o banco: reaproveita `sorteio_ganhadores`, `sorteio_participantes` e `clientes` como estão.

2. **Tipos** — novo tipo `DadosCompletosGanhador` em `src/modules/sorteios/types/index.ts`.

3. **Interface** — em `PainelSortear.tsx` (componente `Historico`):
   - Nova coluna "Dados" com um botão de ícone (olho) por linha.
   - Ao clicar, o modal carrega os dados via servidor (com estado de carregamento e mensagem de erro se falhar).
   - O modal mostra os dados completos em destaque, incluindo CPF e telefone sem máscara.
   - A listagem e o card do ganhador continuam protegidos — a revelação acontece só no modal, sob demanda.

## O que não muda

- Nenhuma alteração em apuração, encerramento, saldo, cupons, fontes, contribuições ou integração Lojamix.
- A listagem do histórico continua mostrando apenas os 4 últimos dígitos.
- O portal público do participante não é afetado.

## Verificação

- `bunx tsgo --noEmit` sem erros e build OK.
- Conferir no navegador: botão visível no histórico, modal abre com os dados completos, listagem segue mascarada.

Sem commit, push, deploy ou publicação.
