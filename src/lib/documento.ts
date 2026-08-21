export interface ArquivoDoc {
  nome: string;
  tipo: string;
  paginas: number;
  /** Quantidade de cópias do arquivo (mínimo 1). Registros antigos assumem 1. */
  copias?: number;
  /** Frente e verso individual do arquivo. Registros antigos assumem false. */
  frenteVerso?: boolean;
  /** Indica que a contagem de páginas precisa ser informada manualmente. */
  paginasManuais?: boolean;
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
  /** Páginas que excedem 1 página por arquivo. */
  paginasAdicionais: number;
  copiasAdicionais: number;
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
  /** Texto de pagamento via PIX (quando incluído no orçamento). */
  pix?: string | null | undefined;
  /** Mensagem de prazo de entrega (quando informado). */
  prazoTexto?: string | null | undefined;
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