# Nº da Sorte — Geração por intervalo (antes da Etapa 5)

Ajuste pontual sobre as Etapas 1–4, sem recriar o módulo e sem tocar em números, participações, premiações, comprovantes ou retiradas existentes.

## O que muda para o administrador

- Cadastro/edição da campanha ganha **Número inicial** e **Número final**, pré-preenchidos com prefixo + 00000 e prefixo + 99999 (ex.: campanha 12 → 1200000 a 1299999).
- Validação: ambos com o prefixo da campanha + exatamente 5 dígitos; inicial ≤ final.
- Enquanto não houver números gerados, os dois limites podem ser alterados livremente.
- Depois de gerar números, só é permitido **Ampliar intervalo** (aumentar o número final até prefixo + 99999), com confirmação mostrando intervalo anterior e novo.
- Painel de números mostra: prefixo, inicial, final, total possível, já gerados e restantes.
- Ao cadastrar prêmio sem capacidade: "Não existem números disponíveis suficientes neste intervalo. Aumente o número final da campanha para continuar." — nada é gerado parcialmente.

## Compatibilidade

- Campanhas existentes recebem o intervalo padrão completo (00000–99999), então nada que já foi gerado fica fora do intervalo.
- Página pública, comprovantes, QR de retirada, estatísticas e a regra do ganhador bloqueado na mesma campanha continuam iguais.

## Detalhes técnicos

- Migração aditiva (cópia idêntica em `supabase/migrations/`): colunas `sufixo_inicial`/`sufixo_final` (integer, default 0/99999, CHECK 0..99999 e inicial ≤ final) em `numero_sorte_campanhas`; tabela `numero_sorte_intervalo_historico` (campanha, anteriores, novos, usuário, data) com GRANT + RLS por `tem_permissao`.
- Trigger de proteção: com números já gerados, bloqueia alterar o inicial ou reduzir o final; registra histórico em toda alteração.
- `numero_sorte_gerar_numeros` reescrita: `FOR UPDATE` na campanha (serializa geração simultânea), calcula disponíveis = tamanho do intervalo − usados no intervalo, falha antes de inserir se faltar; sorteio aleatório dentro do intervalo com retentativa em colisão e, quando o intervalo estiver muito ocupado, escolha entre os sufixos livres via `generate_series` ordenado aleatoriamente. UNIQUE (campanha_id, sufixo) existente continua impedindo duplicações.
- Nova função `numero_sorte_ampliar_intervalo(campanha, novo_final)` com checagem de permissão; server function correspondente.
- UI em `NumeroSortePagina.tsx` (formulário da campanha + bloco de intervalo e diálogo de ampliação).
- Helpers puros em `src/modules/numero-sorte/lib/codigo.ts` (montar/validar limites, capacidade, validar ampliação) + testes cobrindo prefixos de 1/2/3 dígitos, zeros à esquerda, prefixo de outra campanha, redução recusada, ampliação e capacidade insuficiente. Concorrência e geração real ficam verificadas pela lógica do banco; sem criar dados de teste no banco compartilhado.

## Observação

O banco da prévia é o mesmo da loja: a migração (aditiva) será aplicada nele, como nas etapas anteriores. Nada será publicado e a `main` não é alterada. Ao final, entrego lista de arquivos, migração, testes e riscos.
