# Módulo Sorteios

Etapa 1 — **fundação apenas**: banco, segurança, tipos e validações. Não há
portal público, login de participante, API local, sincronização, cron, geração
de cupons, validação automática de notas nem mecanismo do sorteio.

## Estrutura

```text
src/modules/sorteios/
├── components/    # telas do módulo (etapas seguintes)
├── hooks/         # hooks do módulo (etapas seguintes)
├── services/      # regras puras e acesso a dados (saldo.ts nesta etapa)
├── types/         # tipos das tabelas do módulo
└── validations/   # CPF, nome completo, data de nascimento
```

## Relação com `clientes`

`public.clientes` é o **cadastro mestre** do participante. O módulo não tem
tabela própria de pessoas: `sorteio_participantes` referencia `clientes.id` e
nunca repete CPF, nome, telefone ou data de nascimento.

Foram acrescentados a `clientes` apenas dois campos indispensáveis:
`cpf` (somente dígitos) e `data_nascimento`.

## CPF: identificador de negócio × id interno

- `clientes.id` é apenas o identificador interno do Supabase.
- O **CPF** é a chave de correspondência entre Supabase e base local, pois
  cada banco tem o seu próprio id.
- CPF é sempre normalizado sem máscara (`123.456.789-00` → `12345678900`),
  precisa ter 11 dígitos e passar na validação dos dígitos verificadores
  (`CHECK` + `public.cpf_valido`).
- Unicidade por índice parcial `WHERE cpf IS NOT NULL`, para não invalidar os
  clientes antigos sem CPF.

## Completar cadastro

- CPF informado → normaliza → procura em `clientes`.
- Encontrado: usa o cliente existente; campos **vazios** podem ser completados.
- Campo já preenchido: preservado — o fluxo público nunca sobrescreve.
- O CPF nunca é alterado pelo fluxo público.
- Nome completo exige primeiro nome e sobrenome.

## Participação e histórico

- `sorteio_participantes`: uma participação por cliente em cada sorteio
  (`UNIQUE (sorteio_id, cliente_id)`); o saldo pertence àquela participação.
- Nova participação começa com saldo, notas e cupons em zero — saldo não passa
  de um sorteio para outro.
- `sorteio_historico`: um registro por cliente e sorteio
  (`UNIQUE (cliente_id, sorteio_id)`), preservado permanentemente.

## Notas

- `sorteio_notas`: nota informada pelo participante
  (`PENDENTE`, `VALIDA`, `INVALIDA`, `CANCELADA`).
- `UNIQUE (sorteio_id, numero)`: um número de nota só é usado uma vez por
  sorteio, o que impede recadastrar/revalidar a mesma nota.
- Correção de nota inválida volta para `PENDENTE`, com registro em auditoria.

## Base de notas local

`sorteio_notas_base` recebe as notas do sistema da loja (número, valor,
`data_nota`, `origem_id`). A `data_nota` serve para sincronização, auditoria e
recorte por período (a partir de `sorteios.data_inicio`).

## Validação por número + valor

A validação futura compara **somente** número da nota e valor em centavos com
`sorteio_notas_base`. A data **nunca** é usada para validar.

## Cancelamentos

- Nota `CANCELADA` → gatilho marca todos os cupons dela como `CANCELADO`.
- Cancelar um cupom **não** cancela a nota.
- Nenhuma nota e nenhum cupom é apagado; cupons cancelados não participam.
- Nesta etapa nenhum saldo é recalculado automaticamente.

## Saldo

Regra pura em `services/saldo.ts`: cada múltiplo de
`sorteios.valor_por_cupom_centavos` gera um cupom e o resto fica como saldo.
Ex.: R$ 20,00 por cupom, R$ 45,00 em notas válidas → 2 cupons e saldo R$ 5,00.

## Cupons

`sorteio_cupons` sempre aponta para a nota que o originou, com
`UNIQUE (sorteio_id, numero)`. Os números serão **aleatórios** — nunca 1, 2, 3.
A geração fica para a etapa seguinte.

## Portal público do participante (Etapa 3)

Rotas públicas em `/sorteios-publico` (entrada por CPF, telefone, cadastro,
termos, painel, notas, cupons e informações), independentes do painel
administrativo. A URL pública sai de `urlPublicaSorteios()`
(`SORTEIOS_PUBLIC_URL`/`VITE_SORTEIOS_PUBLIC_URL`, com retorno ao próprio
endereço do site quando não configurada); ao abrir o domínio público, a raiz
redireciona para o portal.

- Descoberta do sorteio somente no servidor: apenas um `ATIVO` por vez;
  `RASCUNHO` nunca é exposto; mais de um ativo deixa o portal indisponível.
- Sessão do participante em cookie HttpOnly/SameSite (`sp_sessao`, 2h), com
  token hasheado em `sorteio_sessoes` e "lembrar neste dispositivo" (30 dias,
  revogável ao sair). A sessão relê o sorteio a cada acesso: se virar
  RASCUNHO ou houver outro ativo, é bloqueada.
- Acesso em etapas: CPF → telefone → cadastro/identificação → termos →
  painel. Cadastro e participação são atômicos
  (`sorteio_portal_criar_participacao`, executável apenas pelo servidor).
- Notas ficam `PENDENTE` no registro; só nota `INVALIDA` pode ser corrigida;
  cupons são somente leitura. Em `ENCERRADO`/`CANCELADO`/`SORTEADO` as ações
  são bloqueadas e as informações continuam visíveis.
- Limite de tentativas por IP (`sorteio_tentativas`), auditoria com origem
  `portal` e nenhuma política RLS pública: as tabelas de sessão/tentativas só
  são acessíveis pelo servidor.
- As páginas do portal usam `noindex, nofollow` e nunca carregam CPF,
  telefone ou IDs nas URLs.



Arquitetura preparada para `SUPABASE_PARA_LOCAL` e `LOCAL_PARA_SUPABASE`,
sempre correspondendo clientes por CPF. `sorteio_participantes.sincronizacao_status`
começa em `PENDENTE` — nada é considerado sincronizado por padrão.
`sorteio_sincronizacoes` registra cada execução (tipo, direção, contagens, erro).
A API local será feita em etapa posterior.

## Auditoria

`sorteio_auditoria` guarda cadastro, alteração, validação, invalidação (com
motivo), cancelamento de nota, geração e cancelamento de cupons, aceite de
termos e sincronizações. Sem exclusão de registros.

## Segurança (RLS)

Todas as tabelas têm RLS ativa. Nesta etapa o acesso é apenas do painel:
`public.pode_sorteios()` = administrador (`has_role`) **ou**
`tem_permissao(auth.uid(), 'sorteios.visualizar')`. Nenhuma política pública
foi criada e nenhuma permissão de outro módulo foi alterada.

## Próximas etapas

1. Geração aleatória de cupons e validação automática de notas.
2. API local e sincronização bidirecional por CPF.
3. Mecanismo do sorteio e registro de ganhadores.
