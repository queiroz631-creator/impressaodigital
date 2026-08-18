import { brl, dataBR } from "./format";
import type { DadosDocumento } from "./documento";

const NAVY = "#1a1a5e";
const LARGURA = 900;
const MARGEM = 48;

interface Linha {
  texto: string;
  tipo: "titulo" | "sub" | "texto" | "chave" | "total" | "sep";
  valor?: string;
}

function montarLinhas(d: DadosDocumento): Linha[] {
  const linhas: Linha[] = [];
  linhas.push({ texto: "DADOS DO CLIENTE", tipo: "sub" });
  linhas.push({ texto: "Nome", tipo: "chave", valor: d.clienteNome || "-" });
  linhas.push({ texto: "Telefone", tipo: "chave", valor: d.clienteTelefone || "-" });
  if (d.validade) linhas.push({ texto: "Validade", tipo: "chave", valor: dataBR(d.validade) });

  for (const item of d.itens) {
    linhas.push({ texto: "sep", tipo: "sep" });
    linhas.push({ texto: `${item.titulo} — ${item.material}`, tipo: "sub" });
    linhas.push({ texto: "Material utilizado", tipo: "chave", valor: item.material });
    linhas.push({ texto: "Tipo de impressão", tipo: "chave", valor: item.tipoImpressao });
    if (item.tamanho) linhas.push({ texto: "Formato", tipo: "chave", valor: item.tamanho });
    if (item.frenteVerso) linhas.push({ texto: "Frente e verso", tipo: "chave", valor: "Sim" });
    if (item.copiaManual) linhas.push({ texto: "Cópia manual", tipo: "chave", valor: "Sim" });
    linhas.push({
      texto: "Quantidade de arquivos",
      tipo: "chave",
      valor: String(item.quantidadeArquivos),
    });
    linhas.push({
      texto: "Total de páginas orçado",
      tipo: "chave",
      valor: String(item.paginasTotal),
    });
    for (const a of item.acabamentos) {
      linhas.push({
        texto: `Acabamento: ${a.nome}`,
        tipo: "chave",
        valor: a.incluso ? `${a.quantidade}x · "Incluso"` : "Não incluso",
      });
    }
    linhas.push({ texto: `Total ${item.titulo}`, tipo: "total", valor: brl(item.total) });
  }

  if (d.mostrarTotal !== false) {
    linhas.push({ texto: "sep", tipo: "sep" });
    linhas.push({ texto: "VALOR TOTAL", tipo: "total", valor: brl(d.total) });
  }
  if (d.observacao) {
    linhas.push({ texto: "sep", tipo: "sep" });
    linhas.push({ texto: "Observações", tipo: "sub" });
    for (const l of d.observacao.split("\n")) linhas.push({ texto: l, tipo: "texto" });
  }
  return linhas;
}

/** Gera e baixa uma imagem PNG do orçamento com layout profissional. */
export function gerarOrcamentoImagem(d: DadosDocumento, baixar = true) {
  const linhas = montarLinhas(d);
  const alturaLinha = 30;
  const topo = 190;
  const altura = topo + linhas.length * alturaLinha + 110;

  const canvas = document.createElement("canvas");
  const escala = 2;
  canvas.width = LARGURA * escala;
  canvas.height = altura * escala;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");
  ctx.scale(escala, escala);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LARGURA, altura);

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, LARGURA, 130);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Helvetica, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(d.empresaNome, MARGEM, 52);
  ctx.font = "14px Helvetica, Arial, sans-serif";
  const contato = [d.empresaTelefone, d.empresaEmail, d.empresaEndereco].filter(Boolean).join("  •  ");
  if (contato) ctx.fillText(contato, MARGEM, 78);
  ctx.textAlign = "right";
  ctx.font = "bold 16px Helvetica, Arial, sans-serif";
  ctx.fillText(`Orçamento ${d.numero}`, LARGURA - MARGEM, 52);
  ctx.font = "14px Helvetica, Arial, sans-serif";
  ctx.fillText(`Data: ${dataBR(d.data)}`, LARGURA - MARGEM, 78);

  let y = topo;
  for (const linha of linhas) {
    if (linha.tipo === "sep") {
      ctx.strokeStyle = "#dcdce6";
      ctx.beginPath();
      ctx.moveTo(MARGEM, y - 12);
      ctx.lineTo(LARGURA - MARGEM, y - 12);
      ctx.stroke();
      y += alturaLinha;
      continue;
    }
    ctx.textAlign = "left";
    if (linha.tipo === "sub") {
      ctx.fillStyle = NAVY;
      ctx.font = "bold 17px Helvetica, Arial, sans-serif";
    } else if (linha.tipo === "total") {
      ctx.fillStyle = "#0f7a3d";
      ctx.font = "bold 17px Helvetica, Arial, sans-serif";
    } else {
      ctx.fillStyle = "#33334d";
      ctx.font = "15px Helvetica, Arial, sans-serif";
    }
    ctx.fillText(linha.texto, MARGEM, y);
    if (linha.valor) {
      ctx.textAlign = "right";
      if (linha.tipo !== "total") ctx.font = "bold 15px Helvetica, Arial, sans-serif";
      ctx.fillText(linha.valor, LARGURA - MARGEM, y);
    }
    y += alturaLinha;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#6e6e82";
  ctx.font = "13px Helvetica, Arial, sans-serif";
  ctx.fillText(d.rodape, LARGURA / 2, altura - 40);

  const link = document.createElement("a");
  link.download = `orcamento-${d.numero}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
