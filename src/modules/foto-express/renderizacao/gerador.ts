import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { carregarFontesRenderizacao } from "./fontes";
import { canvasParaJpeg, renderizarFolha } from "./renderizador";
import type { DestinoGeracao, PreparacaoGeracao } from "./types";

export type ProgressoGeracao = { etapa: string; atual?: number; total?: number };

async function enviar(destino: DestinoGeracao, blob: Blob) {
  const { error } = await supabase.storage.from(destino.bucket).uploadToSignedUrl(destino.caminho, destino.token, blob, { contentType: destino.mime, upsert: false });
  if (error) throw new Error(`Não foi possível salvar ${destino.nomeArquivo}: ${error.message}`);
}

export async function gerarArquivos(preparacao: PreparacaoGeracao, onProgresso: (p: ProgressoGeracao) => void) {
  await carregarFontesRenderizacao();
  const { manifesto, destinos } = preparacao;
  const destinoPdf = destinos.find((d) => d.tipo === "PDF");
  const precisaJpg = destinos.some((d) => d.tipo === "JPG");
  let pdf: jsPDF | null = null;
  const memoria = { picoEstimadoBytes: 0, bytesJpgNoPdf: 0 };
  for (let indice = 0; indice < manifesto.folhas.length; indice += 1) {
    const folha = manifesto.folhas[indice];
    if (!folha) continue;
    onProgresso({ etapa: `Renderizando folha ${indice + 1} de ${manifesto.folhas.length}`, atual: indice + 1, total: manifesto.folhas.length });
    const canvas = await renderizarFolha(manifesto, folha, preparacao.originais);
    memoria.picoEstimadoBytes = Math.max(memoria.picoEstimadoBytes, canvas.width * canvas.height * 4);
    const jpg = await canvasParaJpeg(canvas);
    if (precisaJpg) {
      const destino = destinos.find((d) => d.tipo === "JPG" && d.folhaNumero === folha.numero);
      if (!destino) throw new Error(`Destino da folha ${folha.numero} ausente.`);
      onProgresso({ etapa: `Salvando folha ${indice + 1} de ${manifesto.folhas.length}`, atual: indice + 1, total: manifesto.folhas.length });
      await enviar(destino, jpg);
    }
    if (destinoPdf) {
      const orientacao = Number(folha.largura_mm) > Number(folha.altura_mm) ? "landscape" : "portrait";
      if (!pdf) pdf = new jsPDF({ orientation: orientacao, unit: "mm", format: [Number(folha.largura_mm), Number(folha.altura_mm)], compress: true });
      else pdf.addPage([Number(folha.largura_mm), Number(folha.altura_mm)], orientacao);
      const bytes = new Uint8Array(await jpg.arrayBuffer());
      memoria.bytesJpgNoPdf += bytes.byteLength;
      pdf.addImage(bytes, "JPEG", 0, 0, Number(folha.largura_mm), Number(folha.altura_mm), undefined, "FAST");
    }
    canvas.width = 1; canvas.height = 1;
  }
  if (pdf && destinoPdf) {
    onProgresso({ etapa: "Gerando PDF" });
    const blob = pdf.output("blob");
    memoria.picoEstimadoBytes = Math.max(memoria.picoEstimadoBytes, memoria.bytesJpgNoPdf + blob.size);
    await enviar(destinoPdf, blob);
    pdf = null;
  }
  return memoria;
}