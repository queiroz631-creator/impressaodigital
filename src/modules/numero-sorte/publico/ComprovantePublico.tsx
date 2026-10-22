import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, FileDown, Gift, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dataBR, dataHoraBR } from "@/lib/format";
import {
  formatarCodigoRetirada,
  rotuloSituacao,
  situacaoEfetiva,
  type SituacaoPremiacao,
} from "@/modules/numero-sorte/lib/retirada";

export type PremioComprovante = {
  nome: string; descricao: string; imagem: string | null; condicoes: string; local: string;
  instrucoes: string; numero: string; prazo_em: string; reservado_em: string;
  campanha: string; cliente: string; situacao: string;
  token: string | null; codigoRetirada: string | null;
};

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const par of texto.split("\n")) {
    let atual = "";
    for (const p of par.split(" ")) {
      const t = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(t).width > largura && atual) { linhas.push(atual); atual = p; } else atual = t;
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Desenha o comprovante (sem CPF/telefone) para baixar como imagem ou PDF. */
async function desenhar(p: PremioComprovante, qr: string, codigo: string, situacao: string): Promise<HTMLCanvasElement> {
  const W = 900;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = 1700;
  const ctx = cv.getContext("2d")!;
  // Cores de impressão independentes do tema.
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, cv.height);
  ctx.fillStyle = "#111111"; ctx.textAlign = "center";
  let y = 70;
  ctx.font = "bold 34px Arial"; ctx.fillText("Nº DA SORTE — COMPROVANTE DE PREMIAÇÃO", W / 2, y, W - 60);
  y += 50; ctx.font = "26px Arial"; ctx.fillText(p.campanha, W / 2, y, W - 60);
  y += 30;
  const img = new Image(); img.src = qr; await img.decode();
  ctx.drawImage(img, (W - 420) / 2, y, 420, 420); y += 460;
  ctx.font = "bold 56px Courier New"; ctx.fillText(codigo, W / 2, y); y += 40;
  ctx.font = "22px Arial"; ctx.fillText("Código de retirada", W / 2, y); y += 50;
  ctx.textAlign = "left";
  const linha = (rotulo: string, valor: string) => {
    if (!valor) return;
    ctx.font = "bold 24px Arial"; ctx.fillText(rotulo, 60, y); y += 32;
    ctx.font = "24px Arial";
    for (const l of quebrar(ctx, valor, W - 120)) { ctx.fillText(l, 60, y); y += 30; }
    y += 14;
  };
  linha("Cliente", p.cliente);
  linha("Número da sorte", p.numero);
  linha("Prêmio", p.nome);
  linha("Descrição", p.descricao);
  linha("Condições para retirada", p.condicoes);
  linha("Data da premiação", dataHoraBR(p.reservado_em));
  linha("Retirar até", dataHoraBR(p.prazo_em));
  linha("Local", p.local);
  linha("Situação", situacao);
  ctx.font = "italic 20px Arial";
  for (const l of quebrar(ctx, "A retirada está sujeita às condições e ao prazo estabelecidos na campanha.", W - 120)) {
    ctx.fillText(l, 60, y); y += 28;
  }
  const final = document.createElement("canvas");
  final.width = W; final.height = y + 40;
  final.getContext("2d")!.drawImage(cv, 0, 0);
  return final;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ComprovantePublico({ premio, jaGanhou }: { premio: PremioComprovante; jaGanhou?: boolean }) {
  const [qr, setQr] = useState("");
  const situacao = situacaoEfetiva(premio.situacao as SituacaoPremiacao, premio.prazo_em);
  const codigo = premio.codigoRetirada ? formatarCodigoRetirada(premio.codigoRetirada) : "";
  const link = premio.token && typeof window !== "undefined"
    ? `${window.location.origin}/numero-da-sorte/validar/${premio.token}` : "";

  useEffect(() => {
    if (link) void QRCode.toDataURL(link, { width: 600, margin: 2 }).then(setQr);
  }, [link]);

  async function imagem(): Promise<Blob> {
    const cv = await desenhar(premio, qr, codigo, rotuloSituacao[situacao]);
    return await new Promise((r) => cv.toBlob((b) => r(b!), "image/png"));
  }
  async function salvarImagem() { baixar(await imagem(), `comprovante-${premio.codigoRetirada}.png`); }
  async function salvarPdf() {
    const { PDFDocument } = await import("pdf-lib");
    const png = new Uint8Array(await (await imagem()).arrayBuffer());
    const doc = await PDFDocument.create();
    const im = await doc.embedPng(png);
    const largura = 420; const altura = (im.height / im.width) * largura;
    const page = doc.addPage([largura + 40, altura + 40]);
    page.drawImage(im, { x: 20, y: 20, width: largura, height: altura });
    const bytes = await doc.save();
    baixar(new Blob([bytes as BlobPart], { type: "application/pdf" }), `comprovante-${premio.codigoRetirada}.pdf`);
  }
  const textoCompartilhar = `Ganhei no Nº da Sorte (${premio.campanha})! Prêmio: ${premio.nome}. Código de retirada: ${codigo}`;
  async function compartilhar() {
    try {
      const arquivo = new File([await imagem()], "comprovante.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) await navigator.share({ files: [arquivo], text: textoCompartilhar });
      else if (navigator.share) await navigator.share({ text: textoCompartilhar });
      else toast.info("Seu aparelho não permite compartilhar. Baixe a imagem.");
    } catch { /* cancelado */ }
  }

  return (
    <Card className="border-primary"><CardContent className="space-y-4 pt-6 text-center">
      <Gift className="mx-auto h-10 w-10 text-primary" />
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">Nº DA SORTE — COMPROVANTE DE PREMIAÇÃO</p>
      {jaGanhou && situacao === "reservado" && (
        <p className="text-sm font-medium">Você já foi contemplado nesta campanha e não poderá participar novamente.</p>
      )}
      <p className="text-xl font-bold text-primary">
        Parabéns! Você ganhou um prêmio. Guarde este comprovante e apresente-o no momento da retirada.
      </p>
      <Badge variant={situacao === "reservado" ? "default" : situacao === "entregue" ? "secondary" : "destructive"}>
        {rotuloSituacao[situacao]}
      </Badge>
      {qr && situacao === "reservado" && <img src={qr} alt="QR Code de retirada" className="mx-auto w-56 rounded-lg bg-card" />}
      {codigo && (
        <div>
          <p className="font-mono text-3xl font-bold tracking-widest">{codigo}</p>
          <p className="text-xs text-muted-foreground">Código de retirada</p>
        </div>
      )}
      {premio.imagem && <img src={premio.imagem} alt={premio.nome} className="mx-auto max-h-56 rounded-lg object-contain" />}
      <p className="text-xl font-semibold">{premio.nome}</p>
      {premio.descricao && <p className="whitespace-pre-line text-muted-foreground">{premio.descricao}</p>}
      <div className="space-y-1 text-left text-sm">
        <p><span className="font-medium">Campanha:</span> {premio.campanha}</p>
        <p><span className="font-medium">Cliente:</span> {premio.cliente}</p>
        <p><span className="font-medium">Número da sorte:</span> {premio.numero}</p>
        {premio.condicoes && <p><span className="font-medium">Condições:</span> {premio.condicoes}</p>}
        {premio.instrucoes && <p><span className="font-medium">Instruções:</span> {premio.instrucoes}</p>}
        <p><span className="font-medium">Premiado em:</span> {dataBR(premio.reservado_em)}</p>
        <p><span className="font-medium">Retirar até:</span> {dataHoraBR(premio.prazo_em)}</p>
        {premio.local && <p><span className="font-medium">Local:</span> {premio.local}</p>}
      </div>
      {codigo && qr && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void salvarPdf()}><FileDown className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" onClick={() => void salvarImagem()}><Download className="h-4 w-4" /> Imagem</Button>
          <Button variant="outline" onClick={() => void compartilhar()}><Share2 className="h-4 w-4" /> Compartilhar</Button>
          <Button variant="outline" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(textoCompartilhar)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" className="col-span-2"
            onClick={() => void navigator.clipboard.writeText(codigo).then(() => toast.success("Código copiado."))}>
            <Copy className="h-4 w-4" /> Copiar código
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">A retirada está sujeita às condições e ao prazo estabelecidos na campanha.</p>
    </CardContent></Card>
  );
}
