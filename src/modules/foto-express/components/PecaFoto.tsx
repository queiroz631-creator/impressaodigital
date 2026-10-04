import { calcularGeometria, dimensoesMoldura, dimensoesVisualizacaoGaleria, type EdicaoFoto } from "../lib/transformacaoFoto";
import { familiaFonte, FONTES_TEXTO } from "../lib/texto";
import type { ItemGaleria, TextoFoto } from "../types";

const PADRAO: EdicaoFoto = { zoom: 1, posicaoX: 0, posicaoY: 0, rotacao: 0, espelharHorizontal: false, espelharVertical: false, modoAjuste: "PREENCHER" };
export function PecaFoto({ item, textos = [], identificacao, orientacaoFormato, orientarVisualizacao = false }: { item: ItemGaleria; textos?: TextoFoto[]; identificacao?: string; orientacaoFormato?: "RETRATO" | "PAISAGEM"; orientarVisualizacao?: boolean }) {
  const f = item.formato; if (!f) return null;
  const largura = Number(item.largura_personalizada_cm ?? f.largura_cm); const altura = Number(item.altura_personalizada_cm ?? f.altura_cm);
  const edicao: EdicaoFoto = item.configuracao ? { zoom: Number(item.configuracao.zoom), posicaoX: Number(item.configuracao.posicao_x), posicaoY: Number(item.configuracao.posicao_y), rotacao: Number(item.configuracao.rotacao), espelharHorizontal: item.configuracao.espelhar_horizontal, espelharVertical: item.configuracao.espelhar_vertical, modoAjuste: item.configuracao.modo_ajuste === "AJUSTAR" ? "AJUSTAR" : "PREENCHER" } : PADRAO;
  const orientacao = orientacaoFormato ?? item.orientacao;
  const dimensoesCanonicas = dimensoesMoldura(largura, altura, orientacao, { largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, edicao.rotacao);
  const dimensoes = orientarVisualizacao ? dimensoesVisualizacaoGaleria(dimensoesCanonicas.largura, dimensoesCanonicas.altura, orientacao) : dimensoesCanonicas;
  const area = { x: Number(f.area_foto_x), y: Number(f.area_foto_y), w: Number(f.area_foto_largura), h: Number(f.area_foto_altura) };
  const moldura = { largura: dimensoes.largura * area.w * 100, altura: dimensoes.altura * area.h * 100 };
  const g = calcularGeometria({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, moldura, edicao);
  return <div className="relative h-full w-full overflow-hidden bg-background [container-type:size]" style={{ backgroundColor: f.cor_fundo }}>
    <div className="absolute overflow-hidden" style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}>
      {item.thumbnailUrl && <img src={item.thumbnailUrl} alt={item.arquivo.nome_original} draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: `${50 + g.deslocamentoX / moldura.largura * 100}%`, top: `${50 + g.deslocamentoY / moldura.altura * 100}%`, width: `${g.larguraImagem / moldura.largura * 100}%`, height: `${g.alturaImagem / moldura.altura * 100}%`, transform: `translate(-50%, -50%) rotate(${edicao.rotacao}deg) scaleX(${edicao.espelharHorizontal ? -1 : 1}) scaleY(${edicao.espelharVertical ? -1 : 1})` }} />}
    </div>
    {textos.map((t) => <div key={t.id} className="absolute z-10 whitespace-pre-wrap break-words" style={{ left: `${Number(t.posicao_x) * 100}%`, top: `${Number(t.posicao_y) * 100}%`, width: `${Number(t.largura_normalizada) * 100}%`, fontSize: `calc(${Number(t.tamanho_normalizado) * 100} * 1cqh)`, fontFamily: familiaFonte(t.fonte_id), lineHeight: FONTES_TEXTO.find((fonte) => fonte.id === t.fonte_id)?.lineHeight ?? 1.2, color: t.cor, fontWeight: t.negrito ? 700 : 400, fontStyle: t.italico ? "italic" : "normal", textAlign: t.alinhamento === "ESQUERDA" ? "left" : t.alinhamento === "DIREITA" ? "right" : "center", transform: `translate(-50%, -50%) rotate(${Number(t.rotacao)}deg)` }}>{t.conteudo}</div>)}
    {identificacao && <span className="absolute bottom-1 left-1 z-20 bg-background/90 px-1 text-[10px] text-foreground">{identificacao}</span>}
  </div>;
}