import type { DadosDocumento, ItemDoc } from "./documento";
import { brl } from "./format";

const OBS_FINAL = "Obs.: o serviço será iniciado *após a nossa confirmação do recebimento*";

function doisDigitos(valor: number) {
  const n = Math.max(0, Math.floor(Number(valor) || 0));
  return String(n).padStart(2, "0");
}

/** Linhas dos acabamentos: inclusos com a quantidade, não inclusos como "Nenhum". */
function linhasAcabamentos(item: ItemDoc) {
  return item.acabamentos.map((a) =>
    a.incluso === false ? `${a.nome}: Nenhum` : `${a.nome}: ${Math.max(1, Number(a.quantidade) || 1)}x`,
  );
}

/** Destaca o valor do prazo: "Prazo de entrega: *3 horas ...*". */
function linhaPrazo(texto: string) {
  const limpo = texto.trim();
  const pos = limpo.indexOf(":");
  if (pos < 0) return `*${limpo}*`;
  return `${limpo.slice(0, pos + 1)} *${limpo.slice(pos + 1).trim()}*`;
}

/** Mantém apenas as linhas com dados do PIX (Chave / Beneficiário / Banco). */
function linhasPix(texto: string) {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => {
      const pos = l.indexOf(":");
      return pos > 0 && l.slice(pos + 1).trim().length > 0;
    });
}

/** Monta o texto simplificado do orçamento para envio pelo WhatsApp. */
export function textoOrcamentoZap(doc: DadosDocumento) {
  const partes: string[] = ["*Segue Orçamento:*"];

  for (const item of doc.itens) {
    partes.push(`Qtd Arquivos: ${doisDigitos(item.quantidadeArquivos)}`);
    partes.push(`Total Pagina: ${doisDigitos(item.paginasTotal)}`);
    partes.push(item.material);

    const acabamentos = linhasAcabamentos(item);
    if (acabamentos.length > 0) {
      partes.push(acabamentos.join("\n"));
    }
  }

  if (doc.mostrarTotal !== false) {
    partes.push(`*Valor Total: ${brl(doc.total)}*`);
  }

  if (doc.prazoTexto) {
    partes.push(linhaPrazo(doc.prazoTexto));
  }

  if (doc.pix) {
    const pix = linhasPix(doc.pix);
    if (pix.length > 0) partes.push(pix.join("\n\n"));
  }

  partes.push(OBS_FINAL);

  return partes.join("\n\n");
}
