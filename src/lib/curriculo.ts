/** Tipos, constantes e utilidades do módulo Currículo Vitae. */

export type StatusCurriculo = "rascunho" | "completo";
export type ObjetivoTipo = "sugerido" | "personalizado" | "nao_informar";

export interface CurriculoRegistro {
  id: string;
  cliente_id: string | null;
  status: string;
  nome_completo: string;
  cpf: string;
  telefone_principal: string;
  data_nascimento: string | null;
  estado_civil: string | null;
  email: string | null;
  documentacao_completa: boolean | null;
  habilitacao: boolean;
  categoria_habilitacao: string | null;
  escolaridade: string | null;
  curso_superior: string | null;
  objetivo_tipo: string;
  objetivo_texto: string | null;
  exibir_data_atualizacao: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  pos_graduacao_nome: string | null;
  numero: string | null;
  experiencia_possui: boolean;
  experiencia_frase: string | null;
  habilidades_observacao: string | null;
}

/** Frase padrão quando o candidato não possui experiência profissional. */
export const FRASE_SEM_EXPERIENCIA = "Em busca da 1ª oportunidade";

export interface TelefoneItem {
  telefone: string;
}
export interface CursoItem {
  nome_curso: string;
  instituicao: string | null;
  ano: string | null;
}
export interface FormacaoItem {
  nome_curso: string;
  instituicao: string | null;
  ano: string | null;
  nivel?: string | null;
}
export interface ExperienciaItem {
  empresa: string | null;
  cargo: string | null;
  periodo: string | null;
  atividades: string | null;
}
export interface HabilidadeItem {
  habilidade_id: string | null;
  descricao: string;
}

export interface CurriculoCompleto {
  curriculo: CurriculoRegistro;
  telefones: TelefoneItem[];
  cursos: CursoItem[];
  formacoes: FormacaoItem[];
  experiencias: ExperienciaItem[];
  habilidades: HabilidadeItem[];
}

/** Campos do currículo que podem ser gravados pelo formulário. */
export type CamposCurriculo = Partial<
  Pick<
    CurriculoRegistro,
    | "nome_completo"
    | "telefone_principal"
    | "data_nascimento"
    | "estado_civil"
    | "email"
    | "documentacao_completa"
    | "habilitacao"
    | "categoria_habilitacao"
    | "escolaridade"
    | "curso_superior"
    | "objetivo_tipo"
    | "objetivo_texto"
    | "exibir_data_atualizacao"
    | "endereco"
    | "bairro"
    | "cidade"
    | "uf"
    | "cep"
    | "pos_graduacao_nome"
    | "numero"
    | "experiencia_possui"
    | "experiencia_frase"
    | "habilidades_observacao"
  >
>;

export interface PayloadEtapa {
  campos?: CamposCurriculo;
  telefones?: TelefoneItem[];
  cursos?: CursoItem[];
  formacoes?: FormacaoItem[];
  experiencias?: ExperienciaItem[];
  habilidades?: HabilidadeItem[];
  finalizar?: boolean;
}

export const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável", "Outros"];

export const ESCOLARIDADES = [
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Cursando",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Cursando",
  "Ensino Médio Completo",
  "Ensino Superior Incompleto",
  "Ensino Superior Cursando",
  "Ensino Superior Completo",
  "Pós-graduação",
];

export const CATEGORIAS_HABILITACAO = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

/** Níveis permitidos ao informar uma graduação adicional. */
export const NIVEIS_FORMACAO = [
  "Ensino Superior Incompleto",
  "Ensino Superior Cursando",
  "Ensino Superior Completo",
  "Pós-graduação",
];

/** Texto de uma formação adicional (nível — curso — instituição — ano). */
export function formacaoLinha(f: FormacaoItem) {
  return [f.nivel || "", f.nome_curso, f.instituicao ?? "", f.ano ?? ""]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" — ");
}

export function escolaridadeTemCurso(valor?: string | null) {
  return !!valor && valor.startsWith("Ensino Superior");
}

export function escolaridadeTemPos(valor?: string | null) {
  return !!valor && valor === "Pós-graduação";
}

const CONECTIVOS = new Set(["de", "da", "do", "dos", "das", "e"]);
const SIGLAS = new Set(["RG", "CPF", "CNH", "UF", "CEP", "MEI", "TI", "RH"]);

/**
 * Normaliza texto para "Inicial maiúscula" de cada palavra, preservando
 * siglas conhecidas e mantendo conectivos em minúsculo.
 * Aplicada apenas no momento de salvar — nunca durante a digitação.
 */
export function capitalizarTexto(valor: string): string {
  if (!valor) return valor;
  const limpo = valor.replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  return limpo
    .split(" ")
    .map((palavra, indice) => {
      if (SIGLAS.has(palavra.toUpperCase()) && palavra.length <= 4 && palavra === palavra.toUpperCase()) {
        return palavra;
      }
      const lower = palavra.toLowerCase();
      if (indice > 0 && CONECTIVOS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/* -------------------------------------------------------------- CPF */

export function somenteNumeros(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

export function formatarCpf(v: string) {
  const n = somenteNumeros(v).slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

export function cpfValido(valor: string) {
  const cpf = somenteNumeros(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

/* --------------------------------------------------------- Telefone */

export function formatarTelefone(v: string) {
  const n = somenteNumeros(v).slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

/* ------------------------------------------------------ Vazios úteis */

export function objetivoFinal(c: CurriculoRegistro) {
  if (c.objetivo_tipo === "nao_informar") return "";
  return (c.objetivo_texto ?? "").trim();
}

export function formacaoFinal(c: CurriculoRegistro) {
  if (!c.escolaridade) return "";
  if (escolaridadeTemPos(c.escolaridade) && c.pos_graduacao_nome) {
    return `${c.escolaridade} — ${c.pos_graduacao_nome}`;
  }
  if (escolaridadeTemCurso(c.escolaridade) && c.curso_superior) {
    return `${c.escolaridade} — ${c.curso_superior}`;
  }
  return c.escolaridade;
}

/** Rua com o número na frente, quando informado. */
export function ruaComNumero(c: CurriculoRegistro): string {
  const rua = (c.endereco ?? "").trim();
  const numero = (c.numero ?? "").trim();
  if (!rua) return numero;
  return numero ? `${rua}, ${numero}` : rua;
}

/** Frase exibida quando o candidato não possui experiência profissional. */
export function fraseSemExperiencia(c: CurriculoRegistro): string {
  return (c.experiencia_frase ?? "").trim() || FRASE_SEM_EXPERIENCIA;
}

/** Observação livre exibida abaixo das habilidades. */
export function observacaoHabilidades(c: CurriculoRegistro): string {
  return (c.habilidades_observacao ?? "").trim();
}

/** Monta uma linha única com o endereço completo, quando houver. */
export function enderecoCompleto(c: CurriculoRegistro): string {
  return [ruaComNumero(c), c.bairro, [c.cidade, c.uf].filter(Boolean).join(" - "), c.cep ? `CEP ${c.cep}` : ""]
    .filter(Boolean)
    .join(", ");
}

/**
 * Endereço em duas linhas:
 * 1) rua/nº e bairro  2) cidade - UF e CEP.
 */
export function enderecoLinhas(c: CurriculoRegistro): string[] {
  const linha1 = [ruaComNumero(c), c.bairro].filter(Boolean).join(", ");
  const linha2 = [[c.cidade, c.uf].filter(Boolean).join(" - "), c.cep ? `CEP ${c.cep}` : ""]
    .filter(Boolean)
    .join(" — ");
  return [linha1, linha2].filter(Boolean);
}

export function informacoesAdicionais(c: CurriculoRegistro) {
  const linhas: string[] = [];
  if (c.documentacao_completa === true) linhas.push("Possui documentação completa.");
  if (c.documentacao_completa === false) linhas.push("Documentação incompleta.");
  if (c.habilitacao) {
    linhas.push(
      c.categoria_habilitacao ? `Possui habilitação — categoria ${c.categoria_habilitacao}.` : "Possui habilitação.",
    );
  }
  return linhas;
}
