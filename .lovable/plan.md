# Correção dos campos de nota (portal público de Sorteios)

Dois ajustes na tela de registro de nota, apenas no comportamento de digitação.

## 1. Número da nota — somente números

Hoje o campo só sugere teclado numérico no celular; no computador aceita letras.
Passa a ignorar qualquer caractere que não seja número, mantendo apenas os dígitos digitados ou colados.

## 2. Valor da nota — vírgula e ponto de milhar automáticos durante a digitação

Máscara de moeda por acúmulo de dígitos: aceita somente números e formata a cada tecla,
sempre considerando os dois últimos dígitos como centavos. A vírgula e os pontos de milhar
aparecem sozinhos — não é preciso digitar vírgula nem ponto.

Exemplos de digitação (tecla a tecla):

- `1` → `0,01`
- `12` → `0,12`
- `123` → `1,23`
- `1234` → `12,34`
- `12345` → `123,45`
- `123456` → `1.234,56`
- `1234567` → `12.345,67`

- O valor continua sendo convertido internamente em centavos pela mesma regra atual.
- Ao corrigir uma nota existente, o campo já aparece preenchido no mesmo formato.

## Fora do escopo

Nenhuma outra tela, módulo, regra de negócio, tabela ou campo. Sem commit, push ou deploy.

## Detalhes técnicos

- Arquivo único: `src/routes/sorteios-publico.notas.tsx`.
- `numero`: `onChange` aplica `replace(/\D/g, "")`.
- `valor`: `formatarMoedaDigitando` passa a ser máscara por acúmulo — guarda só os dígitos
  (`valor.replace(/\D/g, "")`), separa os 2 últimos como centavos e formata o inteiro com
  `toLocaleString("pt-BR")`; campo continua com `inputMode="decimal"`.
- `centavosDeTexto` / `textoDeCentavos` permanecem intactos e continuam sendo a conversão
  final para centavos.
- Verificação: apenas `npx tsgo --noEmit`.
