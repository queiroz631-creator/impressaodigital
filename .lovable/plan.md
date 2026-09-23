# Cores por status na lista "Minhas notas" (portal do participante)

Na tela **Minhas notas** do portal, cada situação da nota passa a ter uma cor própria no selo à direita do cartão:

| Situação | Cor |
| --- | --- |
| Válida | verde |
| Inválida | vermelho |
| Pendente | laranja |
| Cancelada | cinza |

Hoje o selo usa as cores gerais do portal (que é vermelho), então **Válida** e **Inválida** aparecem quase iguais e **Pendente** fica num tom rosado. O ajuste é só visual: nenhuma regra, mensagem ou gravação muda.

## Como fica

Fundo claro na cor da situação com o texto em tom escuro da mesma cor — leve de ler no celular e sem brigar com o vermelho do portal:

```text
Válida     →  fundo verde-claro,  texto verde-escuro
Inválida   →  fundo vermelho-claro, texto vermelho-escuro
Pendente   →  fundo laranja-claro, texto laranja-escuro
Cancelada  →  fundo cinza-claro,   texto cinza-escuro
```

Uma situação desconhecida (se aparecer no futuro) continua aparecendo em cinza, com o nome dela escrito.

## Fora do escopo

Nenhuma outra tela, nenhum selo de sorteio, nenhuma regra de negócio, nada no banco. As telas administrativas de Sorteios não são tocadas. Sem commit, push ou deploy.

## Detalhes técnicos

- Arquivo único alterado: `src/modules/sorteios/components/publico/StatusNotaBadge.tsx` (usado apenas em `src/routes/sorteios-publico.notas.tsx`).
- Segue o mesmo padrão já existente em `src/modules/sorteios/components/StatusSorteioBadge.tsx`: `Badge variant="outline"` + mapa `Record<string, string>` de classes fixas do Tailwind, sem cor escrita em valor hexadecimal:
  - `VALIDA`: `bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200`
  - `INVALIDA`: `bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200`
  - `PENDENTE`: `bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200`
  - `CANCELADA`: `bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`
  - Fallback: `bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`
- Os rótulos ("Válida", "Inválida", "Pendente", "Cancelada") permanecem os mesmos.
- Verificação: `bunx tsgo --noEmit` e conferência visual da lista no portal (notas com cada situação, se existirem).
