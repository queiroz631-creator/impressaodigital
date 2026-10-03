const CHAVE = "foto-express-portal-fluxo";
export type FluxoFotos = { cpf?: string; telefone?: string; lembrar?: boolean; encontrado?: boolean; nome?: string | null; telefoneFinal?: string | null; faltantes?: ("nome" | "data_nascimento")[] };
export function lerFluxoFotos(): FluxoFotos { if (typeof window === "undefined") return {}; try { return JSON.parse(sessionStorage.getItem(CHAVE) ?? "{}"); } catch { return {}; } }
export function gravarFluxoFotos(valor: FluxoFotos) { sessionStorage.setItem(CHAVE, JSON.stringify(valor)); }
export function limparFluxoFotos() { sessionStorage.removeItem(CHAVE); }