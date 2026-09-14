# Correção dos campos de nota (portal público de Sorteios)

Dois ajustes na tela de registro de nota, apenas no comportamento de digitação.

## 1. Número da nota — somente números

Hoje o campo só sugere teclado numérico no celular; no computador aceita letras.
Passa a ignorar qualquer caractere que não seja número, mantendo apenas os dígitos digitados ou colados.

## 2. Valor da nota — permitir centavos

Hoje a formatação acontece a cada tecla, o que apaga a vírgula assim que ela é digitada e impede informar centavos.

Novo comportamento:

- Enquanto digita: aceita apenas números e uma vírgula, exibindo o que foi digitado (ex: `1234,5`).
- Ao sair do campo (ou ao registrar): formata no padrão brasileiro completo.
  - `1234` → `1.234,00`
  - `1234,56` → `1.234,56`
  - `56,7` → `56,70`
- Máximo de duas casas depois da vírgula.
- O valor continua sendo convertido internamente em centavos pela mesma regra atual.

## Fora do escopo

Nenhuma outra tela, módulo, regra de negócio, tabela ou campo. Sem commit, push ou deploy.

## Detalhes técnicos

- Arquivo único: `src/routes/sorteios-publico.notas.tsx`.
- `numero`: `onChange` aplica `replace(/\D/g, "")`.
- `valor`: `onChange` sanitiza para dígitos + uma vírgula (sem formatar); `onBlur` chama a
  formatação de moeda; `salvar()` normaliza antes de `centavosDeTexto` para o caso de envio
  sem blur. `centavosDeTexto` / `textoDeCentavos` permanecem intactos.
- Verificação: apenas `npx tsgo --noEmit`.
