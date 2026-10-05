import { supabase } from "@/integrations/supabase/client";
import { carregarFontesRenderizacao } from "./fontes";
import { canvasParaJpeg, renderizarFolha } from "./renderizador";
import type { DestinoGeracao, PreparacaoGeracao } from "./types";

export type ProgressoGeracao = { etapa: string; atual?: number; total?: number };

const PONTOS_POR_MM = 72 / 25.4;

async function enviar(destino: DestinoGeracao, blob: Blob) {
  const { error } = await supabase.storage.from(destino.bucket).uploadToSignedUrl(destino.caminho, destino.token, blob, { contentType: destino.mime, upsert: false });
  if (error) throw new Error(`Não foi possível salvar ${destino.nomeArquivo}: ${error.message}`);
}

export async function gerarArquivos(preparacao: PreparacaoGeracao, onProgresso: (p: ProgressoGeracao) => void) {
  await carregarFontesRenderizacao();
  const { manifesto, destinos } = preparacao;
  const destinoPdf = destinos.find((d) => d.tipo === "PDF");
  const precisaJpg = destinos.some((d) => d.tipo === "JPG");
  const pdfLib = destinoPdf ? await import("pdf-lib") : null;
  const pdf = pdfLib ? await pdfLib.PDFDocument.create() : null;
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
    if (pdf) {
      const bytes = new Uint8Array(await jpg.arrayBuffer());
      memoria.bytesJpgNoPdf += bytes.byteLength;
      const largura = Number(folha.largura_mm) * PONTOS_POR_MM;
      const altura = Number(folha.altura_mm) * PONTOS_POR_MM;
      const imagem = await pdf.embedJpg(bytes);
      const pagina = pdf.addPage([largura, altura]);
      pagina.drawImage(imagem, { x: 0, y: 0, width: largura, height: altura });
    }
    canvas.width = 1; canvas.height = 1;
  }
  if (pdf && destinoPdf) {
    onProgresso({ etapa: "Gerando PDF" });
    const bytes = await pdf.save({ useObjectStreams: true });
    const conteudoPdf = new Uint8Array(bytes.byteLength);
    conteudoPdf.set(bytes);
    const blob = new Blob([conteudoPdf.buffer], { type: "application/pdf" });
    memoria.picoEstimadoBytes = Math.max(memoria.picoEstimadoBytes, memoria.bytesJpgNoPdf + blob.size);
    await enviar(destinoPdf, blob);
  }
  return memoria;
}