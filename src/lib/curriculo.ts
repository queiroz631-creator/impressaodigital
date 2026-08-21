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
}

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

export const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
];

export const ESCOLARIDADES = [
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Completo",
  "Ensino Superior Incompleto",
  "Ensino Superior Cursando",
  "Ensino Superior Completo",
  "Pós-graduação",
];

export const CATEGORIAS_HABILITACAO = ["A", "B", "AB", "C", "D", "E"];

export function escolaridadeTemCurso(valor?: string | null) {
  return !!valor && valor.startsWith("Ensino Superior");
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
  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
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
  if (escolaridadeTemCurso(c.escolaridade) && c.curso_superior) {
    return `${c.escolaridade} — ${c.curso_superior}`;
  }
  return c.escolaridade;
}

export function informacoesAdicionais(c: CurriculoRegistro) {
  const linhas: string[] = [];
  if (c.documentacao_completa === true) linhas.push("Possui documentação completa.");
  if (c.documentacao_completa === false) linhas.push("Documentação incompleta.");
  if (c.habilitacao) {
    linhas.push(
      c.categoria_habilitacao
        ? `Possui habilitação — categoria ${c.categoria_habilitacao}.`
        : "Possui habilitação.",
    );
  }
  return linhas;
}
