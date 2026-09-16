# Verificação do fluxo Sistema → Lojamix (clientes pendentes)

## O que a verificação mostrou

O fluxo está rodando, mas **nada é gravado no Lojamix porque o modo simulação
continua ligado** (padrão de instalação `simulacao_criacao_cliente = true`).

Evidências:

- Os dois clientes prontos ("marco paulo" e "joão pereira") continuam sem
  ligação com a loja (`origem_id` vazio).
- A fila de sincronização tem 2 itens de cliente Sistema → Loja já marcados
  como SINCRONIZADO, e o cursor do programa da loja avançou até a sequência 33.
  Ou seja: o programa leu, processou como "simulado" e confirmou.
- A tela do programa não exibe nenhuma linha das etapas "clientes (sistema →
  loja)" e "clientes pendentes" — ela só mostra os resumos de loja → sistema e
  da revisão. Por isso a impressão de que a etapa não existe.

Dois problemas reais a corrigir, além de desligar a simulação:

1. A tela não mostra o resultado do envio Sistema → Loja (criados, vinculados,
   atualizados, simulados, sem participação, erros) — invisível para o operador.
2. Um cliente apenas **simulado** faz a fila ser marcada como SINCRONIZADO e o
   cursor avançar, como se tivesse sido gravado. A recuperação existe (a
   varredura circular de pendentes reencontra quem está sem `origem_id`), mas o
   registro da fila fica enganoso.

## O que será ajustado (somente `api-local/`)

### 1. Tela mostra o fluxo Sistema → Lojamix

Em `gui/main.py`, o resumo passa a incluir as duas etapas que faltam:

- "Clientes (sistema → loja)": criados, vinculados, atualizados, simulados,
  erros.
- "Clientes pendentes (sistema → loja)": recebidos, criados, vinculados,
  atualizados, simulados, sem participação ativa, marcador, "voltou ao início",
  erros.

E um aviso destacado quando a simulação estiver ligada: "Modo simulação ligado:
nenhum cliente novo é criado no Lojamix." Assim o operador entende na hora por
que os contadores mostram apenas "simulados".

### 2. Simulação não marca o item da fila como concluído

Em `app/services/clientes.py`, no ciclo `aplicar_alteracoes`:

- Quando a resolução do cliente terminar em "simulado" (nada gravado), o item
  deixa de ser contado como aplicado e o cursor **não** avança por causa dele:
  o ciclo para naquele ponto e informa "simulação ligada" no resumo.
- Assim que a simulação for desligada, o mesmo item é processado de verdade e o
  cursor segue normalmente.
- Nada é apagado da fila e nenhuma outra etapa muda.

### 3. Nenhuma mudança de regra

Elegibilidade, transação única de criação (entidade + pessoa física), vínculo
por CPF, chamada de vinculação no sistema, marcadores de clientes, varredura
circular e o fluxo de notas permanecem exatamente como estão. Nada no site, no
banco ou nas rotas.

## Como confirmar depois do ajuste

1. Na aba de configuração do programa, desligar "simulação de criação de
   cliente" e salvar.
2. Clicar em "Sincronizar agora".
3. A tela deve mostrar, na etapa de pendentes, `criados` ou `vinculados` maior
   que zero — e os dois cadastros passam a ter ligação com a loja.

## Arquivos previstos

- `api-local/gui/main.py`
- `api-local/app/services/clientes.py`
- `api-local/app/schemas/sync.py` (apenas um contador de "bloqueado por
  simulação", se necessário)
