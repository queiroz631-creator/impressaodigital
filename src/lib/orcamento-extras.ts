import type { Configuracao } from "@/hooks/useDados";

export const PIX_MENSAGEM_PADRAO =
  "Pagamento via PIX:\nChave: {chave_pix}\nBeneficiário: {nome_pix}\nBanco: {banco_pix}";

export const PRAZO_MENSAGEM_PADRAO =
  "Prazo de entrega: {prazo} após a aprovação e pagamento do serviço.";

export type PrazoTipo = "horas" | "dias";

/** Texto do prazo em linguagem natural (ex.: "3 dias", "1 hora"). */
export function rotuloPrazo(tipo: PrazoTipo | "", quantidade: number) {
  const qtd = Math.max(0, Number(quantidade) || 0);
  if (!tipo || qtd <= 0) return "";
  if (tipo === "horas") return `${qtd} ${qtd === 1 ? "hora" : "horas"}`;
  return `${qtd} ${qtd === 1 ? "dia" : "dias"}`;
}

/** Monta a mensagem final de PIX usando as configurações da empresa. */
export function montarTextoPix(config: Configuracao | null | undefined) {
  if (!config) return "";
  const modelo = (config.pix_mensagem ?? "").trim() || PIX_MENSAGEM_PADRAO;
  const texto = modelo
    .replaceAll("{chave_pix}", config.pix_chave ?? "-")
    .replaceAll("{nome_pix}", config.pix_nome ?? config.empresa_nome ?? "-")
    .replaceAll("{banco_pix}", config.pix_banco ?? "-")
    .replaceAll("{empresa}", config.empresa_nome ?? "-");
  return texto.trim();
}

/** Monta a mensagem final de prazo usando o modelo configurado. */
export function montarTextoPrazo(
  config: Configuracao | null | undefined,
  tipo: PrazoTipo | "",
  quantidade: number,
) {
  const prazo = rotuloPrazo(tipo, quantidade);
  if (!prazo) return "";
  const modelo = (config?.mensagem_prazo_orcamento ?? "").trim() || PRAZO_MENSAGEM_PADRAO;
  return modelo.replaceAll("{prazo}", prazo).trim();
}
