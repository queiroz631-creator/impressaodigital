# Por que "ANA LUIZA DE JESUS SANTOS" aparece como não sincronizada

## Diagnóstico (confirmado no banco)

- O cadastro dela **já está ligado ao Lojamix**: identificador de origem 9935,
  com a marca de alteração "LOJA" (ou seja, veio da loja para o sistema).
- Na participação do sorteio "Dia das Criança", o indicador está
  `PENDENTE` e sem data de sincronização.

Causa: quando o cliente chega **da loja para o sistema**, a rotina que grava o
cadastro (`receberClientesLote`) já salva a ligação com a loja, mas **não
atualiza o indicador do participante**. Esse indicador só é marcado como
"Sincronizado" pela rotina de vínculo do sentido oposto (sistema → loja), que
nunca é chamada para quem já chegou vinculado.

Ou seja: não é falha de sincronização — a ligação existe e está correta; só o
indicador não é atualizado nesse caminho.

Observação separada: essa participante está com "Concorre ao sorteio"
desligado. Isso é independente do indicador e não será alterado.

## Correção

1. Em `receberClientesLote` (`src/lib/sorteios-sync.server.ts`), após criar ou
   atualizar o cliente com a ligação da loja, marcar as participações desse
   cliente como sincronizadas, reaproveitando a função já existente
   `marcarParticipantesSincronizados` (nada de lógica duplicada).
   Falha ao atualizar o indicador nunca interrompe o recebimento do cliente: a
   ligação é o dado oficial, o indicador é informativo.
2. Atualização única dos registros atuais: participantes cujo cliente já possui
   ligação com a loja passam a exibir "Sincronizado", com a data de agora.

## Fora do escopo

Elegibilidade, "concorre ao sorteio", notas, validação, cancelamento, cupons,
saldo, fila, marcadores, rotas, programa da loja e telas continuam iguais.
Nenhuma mudança de estrutura no banco. Sem commit, envio ou publicação.
