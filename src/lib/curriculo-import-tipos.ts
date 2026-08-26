/** Estrutura devolvida pela leitura/interpretação de um currículo importado. */

export interface CamposImportados {
  nome_completo: string;
  telefone_principal: string;
  data_nascimento: string;
  estado_civil: string;
  email: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  documentacao_completa: boolean | null;
  habilitacao: boolean;
  categoria_habilitacao: string;
  escolaridade: string;
  curso_superior: string;
  pos_graduacao_nome: string;
  objetivo_texto: string;
}

export interface CurriculoImportado {
  campos: CamposImportados;
  cpf: string;
  telefones: string[];
  cursos: { nome_curso: string; instituicao: string; ano: string }[];
  formacoes: { nivel: string; nome_curso: string; instituicao: string; ano: string }[];
  experiencias: { empresa: string; cargo: string; periodo: string; atividades: string }[];
  habilidades: string[];
  confiancaBaixa: string[];
}

export const ROTULOS_IMPORT: Record<string, string> = {
  nome_completo: "Nome completo",
  telefone_principal: "Telefone principal",
  data_nascimento: "Data de nascimento",
  estado_civil: "Estado civil",
  email: "E-mail",
  endereco: "Endereço",
  numero: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  cep: "CEP",
  escolaridade: "Escolaridade",
  curso_superior: "Curso superior",
  pos_graduacao_nome: "Pós-graduação",
  categoria_habilitacao: "Categoria da CNH",
  objetivo_texto: "Objetivo",
};

/** Conta o que foi identificado e o que ficou faltando. */
export function resumoImportacao(dados: CurriculoImportado) {
  const encontrados: string[] = [];
  const faltando: string[] = [];

  for (const [chave, rotulo] of Object.entries(ROTULOS_IMPORT)) {
    const valor = (dados.campos as unknown as Record<string, unknown>)[chave];
    if (typeof valor === "string" && valor.trim()) encontrados.push(rotulo);
    else faltando.push(rotulo);
  }

  if (dados.cursos.length) encontrados.push(`Cursos (${dados.cursos.length})`);
  else faltando.push("Cursos complementares");

  if (dados.experiencias.length) encontrados.push(`Experiências (${dados.experiencias.length})`);
  else faltando.push("Experiência profissional");

  if (dados.habilidades.length) encontrados.push(`Habilidades (${dados.habilidades.length})`);
  else faltando.push("Habilidades");

  return { encontrados, faltando, verificar: dados.confiancaBaixa };
}
