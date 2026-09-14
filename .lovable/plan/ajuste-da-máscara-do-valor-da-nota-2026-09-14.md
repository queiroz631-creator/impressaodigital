# Ajuste da máscara do valor da nota

Ajustar somente o campo "Valor da nota (R$)" na tela de registro de notas do portal público de Sorteios para formatar automaticamente no padrão moeda brasileira durante a digitação.

## O que será feito

1. **Máscara de moeda em tempo real** — enquanto o participante digita, o campo exibe separadores de milhar (ponto) e decimal (vírgula):
   - `1` → `1,00`
   - `12` → `12,00`
   - `123` → `123,00`
   - `1234` → `1.234,00`
   - `12345` → `12.345,00`
   - `1234,56` → `1.234,56`
   - `56,78` → `56,78`

2. **Filtrar entrada** — aceitar apenas dígitos e, opcionalmente, uma vírgula para os centavos.

3. **Conversão interna** — continuar usando a função existente `centavosDeTexto` para converter o valor formatado em centavos antes de enviar ao servidor.

## Fora do escopo

- Não alterar o campo "Número da nota".
- Não alterar `centavosDeTexto` nem outras regras de negócio.
- Não alterar outras telas, módulos ou funcionalidades (CPF, telefone, cadastro, termos, painel, cupons, informações, administração, WhatsApp, Bot, Z-API, Conexões, Orçamentos, Calculadora, Preços, Currículos).
- Não criar tabela ou campo novo.

## Arquivos modificados

- `src/routes/sorteios-publico.notas.tsx` — aplicar máscara de moeda no campo de valor.

## Verificação final

- `npx tsgo --noEmit`
- Sem commit, push ou deploy.
