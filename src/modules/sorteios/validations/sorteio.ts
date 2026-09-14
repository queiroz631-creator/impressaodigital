import { z } from "zod";

/**
 * Validações do módulo Sorteios (Etapa 2 — administração).
 *
 * Dinheiro sempre em centavos (inteiro). Nada de float.
 */

/** "1.234,56" | "1234,56" | "20" → 123456 | 123456 | 2000 (centavos). */
export function centavosDeTexto(valor: string): number | null {
  const limpo = (valor ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const normalizado = limpo.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/** 2000 → "20,00" (para preencher o campo do formulário). */
export function textoDeCentavos(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/** ISO → valor aceito por <input type="datetime-local"> no fuso local. */
export function paraDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** datetime-local (fuso local) → ISO com fuso, sem alterar o timezone do sistema. */
export function paraIso(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const dataObrigatoria = z.string().trim().min(1, "Informe a data");

export const esquemaSorteio = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome do sorteio"),
    numero_sorteio: z
      .number({ message: "Informe o número do sorteio" })
      .int("O número deve ser inteiro")
      .positive("O número deve ser maior que zero"),
    descricao: z.string().trim().max(2000).default(""),
    data_inicio: dataObrigatoria,
    data_fim: dataObrigatoria,
    data_sorteio: dataObrigatoria,
    valor_por_cupom_centavos: z
      .number({ message: "Informe o valor por cupom" })
      .int()
      .positive("O valor por cupom deve ser maior que zero"),
    quantidade_maxima_cupons: z
      .number()
      .int()
      .positive("O limite deve ser maior que zero")
      .nullable()
      .default(null),
  })
  .superRefine((v, ctx) => {
    const inicio = new Date(v.data_inicio).getTime();
    const fim = new Date(v.data_fim).getTime();
    const sorteio = new Date(v.data_sorteio).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || !Number.isFinite(sorteio)) {
      ctx.addIssue({ code: "custom", message: "Data inválida", path: ["data_inicio"] });
      return;
    }
    if (fim <= inicio) {
      ctx.addIssue({
        code: "custom",
        message: "A data de fim deve ser posterior à data de início",
        path: ["data_fim"],
      });
    }
    if (sorteio < fim) {
      ctx.addIssue({
        code: "custom",
        message: "A data do sorteio deve ser igual ou posterior ao encerramento",
        path: ["data_sorteio"],
      });
    }
  });

export type DadosSorteio = z.infer<typeof esquemaSorteio>;

export const esquemaPremio = z.object({
  nome: z.string().trim().min(2, "Informe o nome do prêmio"),
  descricao: z.string().trim().max(2000).default(""),
  quantidade: z
    .number({ message: "Informe a quantidade" })
    .int()
    .positive("A quantidade deve ser maior que zero"),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().default(true),
});

export type DadosPremio = z.infer<typeof esquemaPremio>;

export const esquemaTermos = z.object({
  versao: z
    .number({ message: "Informe a versão" })
    .int("A versão deve ser inteira")
    .positive("A versão deve ser maior que zero"),
  titulo: z.string().trim().max(200).default(""),
  regras: z.string().trim().max(20000).default(""),
  como_participar: z.string().trim().max(20000).default(""),
  validade: z.string().trim().max(20000).default(""),
  como_sera_realizado: z.string().trim().max(20000).default(""),
  informacoes: z.string().trim().max(20000).default(""),
  premios: z.string().trim().max(20000).default(""),
  outras_condicoes: z.string().trim().max(20000).default(""),
});

export type DadosTermos = z.infer<typeof esquemaTermos>;

/** CPF exibido parcialmente: 123.***.**9-00 → "123.***.**9-00". */
export function mascararCpf(cpf?: string | null): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return d ? "***" : "-";
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

/** Telefone exibido parcialmente: (34) ****-1234. */
export function mascararTelefone(telefone?: string | null): string {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (!d) return "-";
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length < 8) return "***";
  return `(${d.slice(0, 2)}) ****-${d.slice(-4)}`;
}
