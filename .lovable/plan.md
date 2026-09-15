# Por que os clientes não estão sincronizados

## O que os dados mostram

- Notas chegam normalmente (envios da loja a cada ciclo, o último às 23:53).
- Clientes: existe **um único** envio de clientes na história do sistema, às 15:06 de hoje, com 100 registros — feito pela versão antiga do programa, quando ainda não existiam as regras de elegibilidade. Desde então, **nenhum lote de clientes foi enviado**.
- Dos 573 clientes no sistema, só 15 têm CPF; os 100 vindos da loja estão quase todos sem CPF e sem telefone (vieram daquela corrida antiga).

## Causa

O programa da loja usa dois marcadores para saber de onde continuar, e os dois já estão no fim:

1. **Marcador de cadastros novos** — a corrida antiga levou o marcador até o último cadastro existente (id 123). Como ele só olha cadastros com número maior, nenhum cliente antigo é reenviado, mesmo tendo CPF, telefone e nota no período.
2. **Marcador de notas** — no ciclo de clientes, quando a faixa de notas não devolve ninguém elegível, o marcador **avança de qualquer forma** até o fim. Se um cliente for descartado por qualquer motivo (CPF sem dígitos válidos, telefone curto, nome vazio), a faixa é considerada consumida e aquele cliente nunca volta a ser avaliado.

Somando: a versão atual não tem nenhum caminho de recuperação. Nem a reconciliação da loja revisa clientes elegíveis (essa revisão não existe nesta versão do programa). E os descartes são silenciosos — não aparecem no resumo nem na tela de status, então não há como saber quantos foram e por quê.

## Correção proposta (somente no programa da loja, `api-local/`)

1. **Revisão periódica de elegíveis** (recuperação): novo passo no ciclo que varre os cadastros em blocos usando os mesmos critérios (Pessoa Física, CPF válido, telefone com 10+ dígitos, nota no período do sorteio ativo), com um marcador próprio que reinicia do começo ao terminar a varredura. Envio idempotente pelo `origemId`, então reenviar não duplica. Isso recupera os clientes antigos e qualquer um perdido pelos marcadores.
2. **Motivos de descarte visíveis**: o resumo de clientes passa a contar `semNome`, `semCpf`, `cpfInvalido`, `semTelefone`, e esses números aparecem na tela de status/resultado do último ciclo.
3. **Reconciliação da loja volta a revisar clientes elegíveis**, junto com a revisão de situações que já existe.
4. **Ação "Reprocessar clientes"**: rota local + botão que zera os marcadores de clientes (cadastros, notas e revisão) para uma varredura completa sob demanda. Não apaga nada, não mexe nos marcadores de notas fiscais.

## Fora do escopo

- Nada muda no sistema/site: sem migração, sem alteração nas rotas de recebimento, na validação de notas, em cupons, saldo ou cancelamentos.
- Consultas de notas no SQL Server permanecem exatamente como estão; nenhuma escrita nova no SQL Server.
- Sem dados fictícios, sem testes, sem commit, push ou publicação.

## Detalhes técnicos

- `app/sql_store.py`: nova consulta padrão `clientes_revisao` (mesmos filtros de `clientes_loja_sistema`, paginada por `id_entidade > desde_id`, sem depender de id de nota).
- `app/repositories/clientes_repo.py`: `revisar_elegiveis(limite, desde_id, inicio, fim)`.
- `app/services/clientes.py`: `_filtrar_clientes` devolve motivos; novo passo C `revisar_elegiveis()` usando `ultimo_id_cliente_revisado` (já previsto em `app/utils/estado.py`), com bloco de tamanho `REVISAO_BLOCO`; reset dos marcadores em `reiniciar_clientes()`.
- `app/schemas/sync.py`: campos de motivos em `ResumoClientes`.
- `app/worker.py`: inclui o passo de revisão no ciclo.
- `app/routes/controle.py`: `POST /api/local/clientes-reprocessar`; `app/routes/reconciliar.py` chama a revisão de elegíveis.
- Interface de configuração/status: exibe os motivos de descarte e o botão de reprocessar.
