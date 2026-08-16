export interface ArquivoDoc {
  nome: string;
  tipo: string;
  paginas: number;
}

export interface AcabamentoDoc {
  nome: string;
  quantidade: number;
  total: number;
  incluso: boolean;
}

export interface ItemDoc {
  titulo: string;
  material: string;
  tipoImpressao: string;
  tamanho?: string | null;
  frenteVerso?: boolean;
  copiaManual?: boolean;
  arquivos: ArquivoDoc[];
  quantidadeArquivos: number;
  paginasTotal: number;
  acabamentos: AcabamentoDoc[];
  total: number;
}

export interface DadosDocumento {
  numero: string;
  data: string;
  /** Exibe (ou não) o valor total do orçamento no documento. */
  mostrarTotal?: boolean;
  empresaNome: string;
  empresaTelefone?: string | null | undefined;
  empresaEmail?: string | null | undefined;
  empresaEndereco?: string | null | undefined;
  rodape: string;
  clienteNome: string;
  clienteTelefone?: string | null | undefined;
  validade?: string | null | undefined;
  observacao?: string | null | undefined;
  itens: ItemDoc[];
  total: number;
}

/** Extrai a extensão/tipo legível de um nome de arquivo. */
export function tipoDoArquivo(nome: string, mime?: string) {
  const ext = nome.split(".").pop();
  if (ext && ext.length <= 5) return ext.toUpperCase();
  if (mime) return mime.split("/").pop()?.toUpperCase() ?? "-";
  return "-";
}