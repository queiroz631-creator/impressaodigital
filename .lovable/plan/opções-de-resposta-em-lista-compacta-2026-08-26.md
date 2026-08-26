# Opções de resposta em lista compacta

Muda apenas a apresentação do bloco "Opções de resposta" dentro do editor de etapa
(BOT → FLUXOS → CONFIGURAR FLUXO). Nenhuma regra do bot, do fluxo ou do banco muda.

## Como fica

Uma lista dentro de um cartão com borda, uma opção por linha:

```text
Tipo: Escolha de opção · Ação: Aguardar resposta

┌────────────────────────────────────────────────────────────────┐
│ 1. Fazer orçamento   Iniciar outro fluxo → Fazer Orçamento   ↑ ↓ ✎ 🗑 │
│ 2. Consultar pedido  Iniciar outro fluxo → Consultar Pedido  ↑ ↓ ✎ 🗑 │
│ 3. Currículo         Iniciar outro fluxo → Currículo         ↑ ↓ ✎ 🗑 │
└────────────────────────────────────────────────────────────────┘
[✎ EDITAR]  [+ ADICIONAR OPÇÃO]
```

- Cada linha: número + título em destaque, e ao lado, em texto menor e cinza, o
  resumo da ação (rótulo da ação e, quando houver, "→ nome do fluxo/etapa destino").
- Opção inativa aparece com o selo "Inativa".
- Ícones à direita: subir, descer, editar (lápis) e excluir (lixeira vermelha).
- Acima da lista, a linha "Tipo: … · Ação: …" com o tipo de resposta e a ação da etapa.
- Abaixo, os botões EDITAR e + ADICIONAR OPÇÃO.

## Edição

O lápis expande a própria linha, mostrando os campos que já existem hoje
(título, valor digitado, ação, fluxo/etapa destino e "opção ativa") e um botão
CONCLUIR que recolhe a linha. Nada é salvo no banco até SALVAR ETAPA, como já é hoje.
Adicionar opção cria a linha já expandida para preenchimento.

## Detalhes técnicos

- Arquivo único: `src/components/bot/FluxoConfigurador.tsx`, componente `EditorEtapa`.
- Substitui o bloco atual (cada opção sempre com todos os campos abertos) por uma
  lista com estado local `opcaoAberta` controlando qual índice está em edição.
- Resumo da ação via `rotuloAcaoOpcao` (já existente) + busca do nome em
  `outrosFluxos` / `etapas`.
- Setas reordenam o array `form.opcoes` (a ordem é gravada no salvamento da etapa,
  como já acontece).
