# Valor mínimo da nota no sorteio

Ao criar (e editar) um sorteio, passa a existir um campo **Valor mínimo da nota**. Notas com valor abaixo desse mínimo são recusadas na hora, com aviso do valor exigido.

## Como fica para o usuário

- **Cadastro/edição do sorteio**: novo campo "Valor mínimo da nota (R$)", opcional. Em branco = sem mínimo.
- **Portal do participante**: ao registrar uma nota abaixo do mínimo, aparece a mensagem "O valor mínimo da nota para este sorteio é R$ X,XX" e a nota não é registrada.
- **Aviso na tela de cadastro de nota** do portal: quando houver mínimo, ele é exibido junto ao campo de valor.
- **Sorteios já existentes**: começam sem mínimo; nada muda até você definir um valor.

## Detalhes técnicos

**Banco (migração aditiva, gravada também em `supabase/migrations/` com nome datado)**
- `ALTER TABLE public.sorteios ADD COLUMN valor_minimo_nota_centavos integer NOT NULL DEFAULT 0` + `CHECK (valor_minimo_nota_centavos >= 0)`.
- Sem backfill (0 = sem mínimo). Regenerar os tipos do banco.

**Validações / formulário**
- `src/modules/sorteios/validations/sorteio.ts`: campo `valor_minimo_nota_centavos` (inteiro, >= 0, default 0) no `esquemaSorteio`.
- `src/modules/sorteios/components/FormularioSorteio.tsx`: campo de texto em reais usando `centavosDeTexto`/`textoDeCentavos`, ao lado do valor por cupom. Segue a mesma regra de bloqueio de campos críticos já aplicada ao valor por cupom.
- `src/modules/sorteios/types/index.ts`: campo novo no tipo `Sorteio` e nos dados públicos do sorteio.

**Servidor**
- `src/lib/sorteios.functions.ts`: `criarSorteio`/`atualizarSorteio` passam a gravar o campo.
- `src/lib/sorteios-publico.functions.ts`:
  - `dadosPublicosSorteio` devolve `valor_minimo_nota_centavos` (para o aviso na tela).
  - `registrarNotaParticipante`: depois de conferir o período, comparar `data.valor_centavos` com o mínimo do sorteio carregado na sessão e, se menor, lançar `ErroPortal("VALOR_MINIMO", ...)` com o valor formatado — antes de qualquer gravação. A checagem é do servidor; o valor nunca vem do navegador.

**Portal (frontend)**
- `src/routes/sorteios-publico.notas.tsx`: exibir o mínimo junto ao campo de valor e mostrar a mensagem de recusa devolvida pelo servidor.

## Fora do escopo

Geração de cupons, saldo, validação contra a base do Lojamix, sincronização e demais regras já existentes permanecem intactas. Sem deploy e sem publicação.
