import type { Json } from "@/integrations/supabase/types";

export type SaidaGeracao = "PDF" | "JPG" | "PDF_JPG";

export type ManifestoArquivo = {
  id: string;
  original_bucket: string;
  original_path: string;
  nome_original: string;
  tipo_mime: string;
  largura_px: number;
  altura_px: number;
};

export type ManifestoFormato = {
  largura_cm: number;
  altura_cm: number;
  area_foto_x: number;
  area_foto_y: number;
  area_foto_largura: number;
  area_foto_altura: number;
  cor_fundo: string;
};

export type ManifestoConfiguracao = {
  zoom: number;
  posicao_x: number;
  posicao_y: number;
  rotacao: number;
  espelhar_horizontal: boolean;
  espelhar_vertical: boolean;
  modo_ajuste: string;
};

export type ManifestoTexto = {
  id: string;
  conteudo: string;
  posicao_x: number;
  posicao_y: number;
  largura_normalizada: number;
  tamanho_normalizado: number;
  fonte_id: string;
  cor: string;
  alinhamento: string;
  negrito: boolean;
  italico: boolean;
  rotacao: number;
  ordem: number;
};

export type ManifestoItem = {
  item: { id: string; orientacao: string; largura_personalizada_cm: number | null; altura_personalizada_cm: number | null };
  arquivo: ManifestoArquivo;
  formato: ManifestoFormato;
  configuracao: ManifestoConfiguracao;
  textos: ManifestoTexto[];
};

export type ManifestoOcorrencia = {
  item_id: string;
  indice_copia: number;
  x_mm: number;
  y_mm: number;
  largura_mm: number;
  altura_mm: number;
  rotacao_folha: number;
};

export type ManifestoFolha = {
  id: string;
  numero: number;
  largura_mm: number;
  altura_mm: number;
  ocorrencias: ManifestoOcorrencia[];
};

export type ManifestoGeracao = {
  versao_manifesto: number;
  trabalho: { id: string; numero: number };
  folhas: ManifestoFolha[];
  itens: ManifestoItem[];
};

export type DestinoGeracao = {
  id: string;
  tipo: "PDF" | "JPG";
  folhaNumero: number | null;
  bucket: string;
  caminho: string;
  nomeArquivo: string;
  mime: "application/pdf" | "image/jpeg";
  token: string;
};

export type PreparacaoGeracao = {
  geracaoId: string;
  manifesto: ManifestoGeracao;
  originais: Record<string, string>;
  destinos: DestinoGeracao[];
};

export function validarManifesto(valor: Json): ManifestoGeracao {
  if (!valor || Array.isArray(valor) || typeof valor !== "object") throw new Error("Manifesto de geração inválido.");
  const manifesto = valor as unknown as ManifestoGeracao;
  if (manifesto.versao_manifesto !== 1 || !Array.isArray(manifesto.folhas) || !manifesto.folhas.length || !Array.isArray(manifesto.itens) || !manifesto.itens.length) throw new Error("Versão do manifesto incompatível.");
  const itens = new Map(manifesto.itens.map((entrada) => [entrada.item.id, entrada]));
  const copias = new Set<string>();
  for (const folha of manifesto.folhas) {
    if (!Number.isFinite(Number(folha.numero)) || Number(folha.numero) < 1 || Number(folha.largura_mm) <= 0 || Number(folha.altura_mm) <= 0 || !Array.isArray(folha.ocorrencias)) throw new Error("Folha inválida no manifesto.");
    for (const ocorrencia of folha.ocorrencias) {
      const item = itens.get(ocorrencia.item_id);
      const chave = `${ocorrencia.item_id}:${ocorrencia.indice_copia}`;
      if (!item || copias.has(chave) || ocorrencia.indice_copia < 1 || ocorrencia.indice_copia > Number((item.item as { quantidade?: number }).quantidade ?? 0) || ![0, 90].includes(Number(ocorrencia.rotacao_folha))) throw new Error("Ocorrência inválida no manifesto.");
      copias.add(chave);
    }
  }
  const total = manifesto.itens.reduce((soma, entrada) => soma + Number((entrada.item as { quantidade?: number }).quantidade ?? 0), 0);
  if (copias.size !== total) throw new Error("O manifesto não contém todas as cópias esperadas.");
  return manifesto;
}