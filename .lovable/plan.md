# Fechamento do sorteio (ATIVO → ENCERRADO)

Encerrar um sorteio de forma controlada: conferir tudo antes, congelar a base
depois, sem apagar nada e com registro completo no histórico.

## Estados

O projeto já tem cinco situações e nenhuma nova será criada:

```text
RASCUNHO  ->  ATIVO  ->  ENCERRADO  ->  SORTEADO
                 \          \
                  ---->  CANCELADO  <----
```

`ENCERRADO` é o fechamento desta etapa. `SORTEADO` é a apuração, que fica para
a próxima etapa. Não existem (e não serão criados) estados "APURADO" ou
"FINALIZADO" — a nomenclatura atual é mantida.

## O que o usuário passa a ver

No painel do sorteio, uma seção nova **Conferência para encerramento** com:
participantes, participantes que concorrem, notas válidas, notas canceladas,
notas pendentes, cupons ativos, cupons cancelados, cupons utilizados, saldo
acumulado, fontes pendentes, contribuições, lista de pendências e lista de
inconsistências.

No topo da seção, o resultado: **Conferência aprovada** ou **Existem
pendências**, com cada motivo escrito por extenso (por exemplo "3 notas válidas
ainda não geraram cupons" ou "participante X: saldo R$ 8,85 diferente das
fontes R$ 6,85").

O botão **Encerrar sorteio** aparece nessa seção e fica desabilitado enquanto
houver pendência. Ao clicar, abre uma confirmação: "Tem certeza que deseja
encerrar este sorteio? Após o encerramento, novas notas, participações e cupons
não poderão alterar a base deste sorteio."

Depois de encerrado, a seção passa a mostrar o **retrato** do fechamento: data e
hora, quem encerrou e os números exatamente como estavam no momento do
encerramento — lidos do retrato gravado, não recalculados a partir dos dados de
hoje. Todas as telas de consulta (notas, cupons, participantes, prêmios, termos,
auditoria) continuam funcionando normalmente.

O botão só aparece quando a conferência exibida está aprovada, mas a decisão
nunca é do navegador: o servidor refaz a conferência inteira dentro da transação
de encerramento e recusa se algo mudou nesse intervalo.


## Conferência: o que bloqueia o encerramento

Pendências (podem mudar a quantidade de cupons):
notas com situação PENDENTE; notas válidas sem cupons processados; sorteio com
`valor_por_cupom_centavos` igual a zero.

Inconsistências (a base não fecha matematicamente ou tem dado inválido):
saldo gravado do participante diferente da soma das fontes pendentes; saldo
gravado diferente do cálculo atual do projeto (notas válidas processadas menos
cupons que valem); soma das contribuições diferente do `valor_base_centavos` do
cupom; cupom ativo sem lastro em notas ainda válidas; **cupom não cancelado
(ATIVO ou UTILIZADO) sem composição**; contribuição apontando para nota
inexistente, para outro participante, para outro sorteio ou para nota que não
está mais válida; número de cupom repetido no sorteio; fonte CANCELADA ou
ESGOTADA com valor pendente; fonte pendente maior que o valor original; nota
válida processada sem fonte.

Cada item traz o participante, a nota ou o cupom envolvido e a diferença em
reais, para o administrador saber exatamente onde está o problema.

Observação, nunca bloqueio: sorteio sem `data_fim`, `data_fim` ainda no futuro,
**saldo residual** em participantes (R$ 8,85 não é inconsistência; continua
existindo e entra no retrato), e os cupons **CANCELADOS históricos** sem
composição, que permanecem preservados para auditoria — a exigência de
composição vale só para cupons não cancelados.


Nada é corrigido automaticamente: a conferência é somente leitura.

## Detalhes técnicos

### Migração (aditiva, banco de desenvolvimento)

1. `ALTER TABLE public.sorteios` com três colunas nulas:
   `encerrado_em timestamptz`, `encerrado_por uuid`,
   `conferencia_encerramento jsonb`.
2. `public.sorteio_conferencia(_sorteio_id uuid) RETURNS jsonb` — somente
   leitura, `SECURITY DEFINER`, `search_path=public`, `EXECUTE` para
   `authenticated` e `service_role` (leitura já é liberada pelas policies).
   Devolve `{sorteio:{...}, totais:{...}, pendencias:[...], inconsistencias:[...],
   aprovada:bool}`; cada item de pendência/inconsistência traz `codigo`,
   `mensagem`, `quantidade` e os ids envolvidos (participante/nota/cupom).
3. `public.sorteio_encerrar(_sorteio_id uuid, _usuario_id uuid) RETURNS jsonb` —
   `SECURITY DEFINER`, `EXECUTE` somente `service_role`. Uma única transação, na
   ordem: `SELECT ... FROM sorteios WHERE id=_sorteio_id FOR UPDATE` (dois
   administradores nunca encerram ao mesmo tempo; o segundo espera e depois vê o
   status já `ENCERRADO`) → se já está `ENCERRADO`, devolve
   `{resultado:'IGNORADO'}` sem gravar nada → exige status `ATIVO` → chama
   `sorteio_conferencia` **dentro da transação**, ignorando qualquer conferência
   vinda do navegador → se `aprovada = false`, levanta exceção devolvendo as
   pendências e desfaz tudo → `UPDATE sorteios SET status='ENCERRADO',
   encerrado_em=now(), encerrado_por=_usuario_id,
   conferencia_encerramento=<esse mesmo retrato> WHERE id=… AND status='ATIVO'`
   (0 linhas → exceção) → insere a auditoria. O retrato gravado é
   obrigatoriamente o mesmo objeto que autorizou o encerramento, nunca uma
   segunda leitura. Qualquer falha desfaz o UPDATE e a auditoria juntos: não
   existe sorteio encerrado sem auditoria nem auditoria sem encerramento.
   Auditoria `sorteio.encerrado` (tabela existente `sorteio_auditoria`, origem
   `painel`, `usuario_id` preenchido) com: `de`, `para`, participantes,
   participantes concorrentes, notas válidas/canceladas/pendentes, cupons
   ativos/cancelados/utilizados, saldo acumulado, fontes pendentes,
   contribuições e o retrato completo da conferência.
4. Congelamento por trigger `BEFORE INSERT OR UPDATE`, função única
   `public.sorteio_bloquear_base_encerrada()` aplicada a `sorteio_notas`,
   `sorteio_participantes`, `sorteio_cupons`, `sorteio_saldo_fontes` e
   `sorteio_cupom_contribuicoes` — só nessas cinco. Lê o sorteio da linha e, se
   estiver `ENCERRADO`, `SORTEADO` ou `CANCELADO`, levanta exceção **antes** de
   qualquer dado ser alterado. `SELECT`, consultas administrativas, auditoria e
   histórico não são afetados. Como é `BEFORE`, a trava também impede que o
   cancelamento de nota pela sincronização chegue a mexer em saldo, cupons,
   fontes ou contribuições do sorteio encerrado: a nota é recusada de forma
   controlada, o lote registra o erro dessa nota e segue processando as demais,
   sem nenhuma mudança na arquitetura da sincronização.


Sem DROP, sem rename, sem coluna obrigatória, sem tocar nas funções de saldo,
cupons, fontes, contribuições ou cancelamento.

### Servidor

- Novo `src/lib/sorteios-encerramento.server.ts`: `conferenciaSorteio(id)` e
  `encerrarSorteio(id, usuarioId)`, ambos via `supabaseAdmin.rpc`, no mesmo
  padrão de `sorteios-cupons.server.ts`.
- `src/lib/sorteios.functions.ts`: duas server fns novas com
  `requireSupabaseAuth` + `exigirGestao` (permissão `sorteios.gerenciar`, a
  mesma já usada) — `conferenciaEncerramentoSorteio` e `encerrarSorteio`, que
  importa o `.server.ts` dentro do handler.
- `alterarStatusSorteio` passa a recusar a transição direta `ATIVO → ENCERRADO`
  com a mensagem "Use a conferência de encerramento", para que o fechamento
  nunca escape da conferência. As outras transições ficam iguais.

### Frontend

- `useSorteios.ts`: hook `useConferenciaEncerramento(id)` chamando a nova server
  fn; `CAMPOS_SORTEIO` ganha `encerrado_em, encerrado_por,
  conferencia_encerramento`.
- Novo componente `src/modules/sorteios/components/ConferenciaEncerramento.tsx`
  com os 11 indicadores (participantes, participantes concorrentes, notas
  válidas, notas canceladas, notas pendentes, cupons ativos, cupons cancelados,
  cupons utilizados, saldo acumulado, fontes pendentes, contribuições), as listas
  de pendências e inconsistências por extenso e o botão com `AlertDialog` de
  confirmação. Reaproveita `IndicadorCard` e `brl`/`dataHoraBR` já existentes.

- `src/routes/sorteios.$id.index.tsx`: renderiza a seção quando o status é
  `ATIVO` (conferência + botão) ou `ENCERRADO` (retrato do fechamento).
- `services/status.ts`: `ROTULO_TRANSICAO` deixa de oferecer "Encerrar sorteio"
  no bloco genérico de transições (passa a ser a ação da nova seção).
- `types/index.ts`: tipos da conferência; `src/integrations/supabase/types.ts`
  regenerado.

### Testes no banco de desenvolvimento

Os 12 cenários pedidos, com dados temporários criados e removidos ao final e o
sorteio devolvido a `ATIVO` no encerramento de cada teste que o alterar:
encerramento permitido com base correta; bloqueio por nota válida não
processada, por cupom sem lastro, por saldo divergente e por contribuição
inválida; segunda tentativa em sorteio já encerrado sem efeito; duas tentativas
simultâneas com apenas uma vencedora; falha no meio com rollback total;
participação e geração de cupom recusadas após o encerramento; consultas
históricas intactas; auditoria `sorteio.encerrado` completa. No fim, reconferência
dos invariantes (saldo = fontes pendentes, contribuições = valor do cupom, nenhum
cupom ativo sem lastro, nenhum número duplicado, nenhuma nota pendente).

## Fora desta etapa

Apuração do número vencedor, ganhadores, prêmios entregues, comunicação com o
cliente, WhatsApp, e-mail, Lojamix, API local, sincronização, fila, cursores,
produção, commit, deploy e publicação.
