ALTER TABLE materiais ADD COLUMN IF NOT EXISTS quantidade_arquivos_fixo integer DEFAULT 3;
ALTER TABLE materiais ADD COLUMN IF NOT EXISTS preco_arquivos_fixo numeric DEFAULT 0;