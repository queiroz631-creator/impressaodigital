/**
 * Validações do cadastro do participante (sempre `public.clientes`).
 *
 * Regras desta etapa:
 * - CPF guardado somente com números, exatamente 11 dígitos, com dígitos
 *   verificadores válidos; vazio equivale a NULL;
 * - nome completo precisa ter primeiro nome e sobrenome.
 */

import { cpfValido, formatarCpf, somenteNumeros } from "@/lib/curriculo";

export { cpfValido, formatarCpf, somenteNumeros };

/** CPF normalizado para gravação: só dígitos, ou null quando vazio. */
export function normalizarCpf(valor?: string | null): string | null {
  const digitos = somenteNumeros(valor ?? "");
  return digitos.length ? digitos : null;
}

export interface ResultadoValidacao {
  ok: boolean;
  erro?: string;
}

export function validarCpf(valor?: string | null): ResultadoValidacao {
  const cpf = normalizarCpf(valor);
  if (!cpf) return { ok: false, erro: "Informe o CPF." };
  if (cpf.length !== 11) return { ok: false, erro: "O CPF deve ter 11 números." };
  if (!cpfValido(cpf)) return { ok: false, erro: "CPF inválido." };
  return { ok: true };
}

/** Exige primeiro nome e sobrenome (ex.: "JOÃO" é inválido, "JOÃO SILVA" é válido). */
export function validarNomeCompleto(valor?: string | null): ResultadoValidacao {
  const partes = (valor ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p.length >= 2);
  if (partes.length < 2) return { ok: false, erro: "Informe o nome e o sobrenome." };
  return { ok: true };
}

export function validarDataNascimento(valor?: string | null): ResultadoValidacao {
  if (!valor) return { ok: false, erro: "Informe a data de nascimento." };
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return { ok: false, erro: "Data de nascimento inválida." };
  if (data > new Date()) return { ok: false, erro: "A data de nascimento não pode ser futura." };
  return { ok: true };
}

/**
 * Campos que o fluxo público poderá completar apenas quando estiverem vazios.
 * O CPF nunca é alterado pelo fluxo público e nada preenchido é sobrescrito.
 */
export const CAMPOS_COMPLETAVEIS = ["nome", "telefone", "data_nascimento", "email"] as const;

export type CampoCompletavel = (typeof CAMPOS_COMPLETAVEIS)[number];

/** Mantém apenas os campos que estão vazios no cadastro atual. */
export function apenasCamposFaltantes<T extends Record<string, unknown>>(
  atual: T,
  informado: Partial<Record<CampoCompletavel, string | null>>,
): Partial<Record<CampoCompletavel, string | null>> {
  const saida: Partial<Record<CampoCompletavel, string | null>> = {};
  for (const campo of CAMPOS_COMPLETAVEIS) {
    const valorAtual = atual[campo];
    const vazio = valorAtual === null || valorAtual === undefined || valorAtual === "";
    const novo = informado[campo];
    if (vazio && novo) saida[campo] = novo;
  }
  return saida;
}
