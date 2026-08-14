export type TipoImpressao = "pb" | "color" | "ambas";

export interface Material {
  id: string;
  nome: string;
  descricao: string;
  preco_pb: number;
  preco_color: number;
  ativo: boolean;
  ordem: number;
}

export interface LinhaCalculo {
  material: Material;
  valorUnitario: number;
  valorUnitarioPb: number;
  valorUnitarioColor: number;
  paginasPb: number;
  paginasColor: number;
  totalPb: number;
  totalColor: number;
  total: number;
}

export interface EntradaCalculo {
  tipo: TipoImpressao;
  paginasTotal: number;
  paginasPb: number;
  paginasColor: number;
}

export function paginasEfetivas(entrada: EntradaCalculo) {
  if (entrada.tipo === "pb") return { pb: entrada.paginasTotal, color: 0 };
  if (entrada.tipo === "color") return { pb: 0, color: entrada.paginasTotal };
  return { pb: entrada.paginasPb, color: entrada.paginasColor };
}

export function calcularLinhas(materiais: Material[], entrada: EntradaCalculo): LinhaCalculo[] {
  const { pb, color } = paginasEfetivas(entrada);
  return materiais
    .filter((m) => m.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((material) => {
      const precoPb = Number(material.preco_pb) || 0;
      const precoColor = Number(material.preco_color) || 0;
      const totalPb = pb * precoPb;
      const totalColor = color * precoColor;
      const paginas = pb + color;
      const total = totalPb + totalColor;
      return {
        material,
        valorUnitario: paginas > 0 ? total / paginas : entrada.tipo === "color" ? precoColor : precoPb,
        valorUnitarioPb: precoPb,
        valorUnitarioColor: precoColor,
        paginasPb: pb,
        paginasColor: color,
        totalPb,
        totalColor,
        total,
      };
    });
}

export function resumoLinhas(linhas: LinhaCalculo[]) {
  if (linhas.length === 0) return null;
  const ordenadas = [...linhas].sort((a, b) => a.total - b.total);
  const menor = ordenadas[0];
  const maior = ordenadas[ordenadas.length - 1];
  const media = linhas.reduce((acc, l) => acc + l.total, 0) / linhas.length;
  return { menor, maior, media };
}