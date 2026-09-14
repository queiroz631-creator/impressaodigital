# Ajuste de entrada de nota no portal público

Ajustar os campos da tela de registro de notas do portal de Sorteios para facilitar a digitação e reforçar a validação, sem alterar regras de negócio, fluxo ou outros módulos.

## O que será feito

1. **Valor da nota (R$)** — formatar automaticamente enquanto o participante digita, no padrão moeda brasileira:
   - Aceitar apenas dígitos durante a digitação.
   - Inserir automaticamente os separadores de milhar (ponto) e decimal (vírgula).
   - Exemplo: digitar `1234` exibe `1.234,00`; digitar `567` exibe `5,67`.
   - Manter a conversão interna para centavos existente (`centavosDeTexto`).

2. **Número da nota** — permitir apenas caracteres numéricos (`0-9`):
   - Bloquear letras, espaços, traços, pontos e outros caracteres no próprio campo.
   - Ajustar a validação server-side para aceitar somente dígitos, mantendo o limite máximo atual de 60 caracteres.

3. **Demais telas e regras permanecem inalteradas** — sem mudanças em CPF, telefone, cadastro, termos, sessão, cupons, informações, administração, WhatsApp, Bot, Z-API, Conexões, Orçamentos, Calculadora, Preços ou Currículos.

## Arquivos modificados

- `src/routes/sorteios-publico.notas.tsx` — adicionar máscara de moeda ao campo de valor e filtrar caracteres no campo de número da nota.
- `src/lib/sorteios-publico.functions.ts` — restringir o `esquemaNota.numero` a somente dígitos, mantendo o comprimento máximo de 60.

## Testes

1. Digitar letras no campo "Número da nota" — nenhuma letra entra.
2. Colar valor com letras/traços no campo "Número da nota" — só ficam os dígitos.
3. Digitar `1234` no campo "Valor da nota" — exibe `1.234,00`.
4. Digitar `56` — exibe `0,56`.
5. Digitar `100099` — exibe `1.000,99`.
6. Enviar nota com número e valor formatados — grava corretamente em centavos.
7. Tentar enviar número da nota com caractere não numérico — erro de validação amigável.

## Verificação final

- `npx tsgo --noEmit`
- Lint dos arquivos modificados
- Build
- Remover dados de teste, se houver.
- Sem commit, push ou deploy.
