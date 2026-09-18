# Desativar a gravação de clientes na loja (Lojamix), mantendo o código

## O que muda no funcionamento

O programa da loja para de gravar qualquer cliente no Lojamix: nada é criado,
nada é atualizado e nenhum vínculo novo é feio no sentido sistema → loja.
Todo o resto continua igual: notas, situações de notas, clientes que vêm da
loja para o sistema e a revisão de clientes.

Nenhum código é apagado — o fluxo fica desligado por uma chave, pronto para
ser religado quando você quiser continuar.

## Como fica

Nova chave de configuração **"gravar clientes no Lojamix"**, desligada por
padrão. Com ela desligada:

- as duas etapas de gravação (clientes do sistema → loja e clientes pendentes)
  não rodam no ciclo automático;
- os marcadores e a fila não avançam, então nada é perdido: quando religar,
  os clientes pendentes continuam de onde pararam;
- a tela mostra essas etapas como "desligada", em vez de contadores zerados,
  para não parecer erro;
- as chamadas manuais dessas etapas respondem informando que estão desligadas,
  sem gravar nada.

O que vem da loja para o sistema continua funcionando normalmente, inclusive o
vínculo automático de participante e notas quando o cliente chega com nota de
sorteio ativo.

## Detalhes técnicos

Arquivos da API local:

- `app/settings_store.py` e `app/config.py`: nova opção
  `gravar_clientes_no_lojamix` (padrão `False`).
- `app/worker.py`: quando desligada, `clientes_sistema_loja` e
  `clientes_pendentes_loja` retornam `{"desligado": True}` sem executar —
  sem leitura da fila, sem confirmação de cursor.
- `app/services/clientes.py`: `aplicar_alteracoes()` e
  `enviar_pendentes_para_loja()` passam a checar a chave no início e sair sem
  efeito (respostas marcadas como desligadas). Nada removido de
  `_resolver_cliente`, `criar`, vínculo por CPF ou modo simulação.
- `app/gui/main.py`: caixa de seleção para a nova opção e exibição
  "desligada" nas duas etapas.
- `api-local/README.md`: registro da opção.

Nada muda no site, nas rotas, no banco, nas migrações, na validação de notas,
cupons ou saldo. Sem commit, envio ou publicação.

## Depois de aplicar

Na loja: gere o executável novamente; a opção já vem desligada. Para voltar a
gravar no futuro, basta ligá-la em Configurações.
