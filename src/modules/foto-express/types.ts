import type { Database } from "@/integrations/supabase/types";

export type Trabalho = Database["public"]["Tables"]["foto_express_trabalhos"]["Row"];
export type Formato = Database["public"]["Tables"]["foto_express_formatos"]["Row"];
export type ArquivoFoto = Database["public"]["Tables"]["foto_express_arquivos"]["Row"];
export type ItemFoto = Database["public"]["Tables"]["foto_express_itens"]["Row"];
export type ConfiguracaoFoto = Database["public"]["Tables"]["foto_express_configuracoes"]["Row"];
export type TextoFoto = Database["public"]["Tables"]["foto_express_textos"]["Row"];
export type MontagemFoto = Database["public"]["Tables"]["foto_express_montagens"]["Row"];
export type FolhaFoto = Database["public"]["Tables"]["foto_express_folhas"]["Row"];
export type OcorrenciaFoto = Database["public"]["Tables"]["foto_express_ocorrencias"]["Row"];
export type GeracaoFoto = Database["public"]["Tables"]["foto_express_geracoes"]["Row"];
export type ArquivoImpressaoFoto = Database["public"]["Tables"]["foto_express_arquivos_impressao"]["Row"];
export type Orientacao = "AUTOMATICA" | "RETRATO" | "PAISAGEM";
export type Qualidade = "EXCELENTE" | "BOA" | "BAIXA" | "MUITO_BAIXA" | "SEM_FORMATO";

export interface ItemGaleria extends ItemFoto {
  arquivo: ArquivoFoto;
  formato: Formato | null;
  configuracao: ConfiguracaoFoto | null;
  thumbnailUrl?: string;
}

export interface ItemEditor extends ItemGaleria {
  configuracao: ConfiguracaoFoto;
  originalUrl?: string;
}
