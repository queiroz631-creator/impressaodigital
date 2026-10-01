import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ConfiguracaoMontagem, OrientacaoPapel, PapelId } from "../lib/montagem";

export function ConfiguracaoPapel({ valor, onChange }: { valor: ConfiguracaoMontagem; onChange: (v: ConfiguracaoMontagem) => void }) {
  const numero = (chave: keyof ConfiguracaoMontagem, bruto: string) => onChange({ ...valor, [chave]: Math.max(0, Number(bruto) || 0) });
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Papel</Label><Select value={valor.papel} onValueChange={(v: PapelId) => onChange({ ...valor, papel: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A4">A4 · 210 × 297 mm</SelectItem><SelectItem value="A3">A3 · 297 × 420 mm</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Orientação</Label><Select value={valor.orientacao} onValueChange={(v: OrientacaoPapel) => onChange({ ...valor, orientacao: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AUTOMATICA">Automática</SelectItem><SelectItem value="RETRATO">Retrato</SelectItem><SelectItem value="PAISAGEM">Paisagem</SelectItem></SelectContent></Select></div></div>
    <div className="grid grid-cols-2 gap-3"><Campo label="Margem superior" value={valor.margemSuperiorMm} onChange={(v) => numero("margemSuperiorMm", v)} /><Campo label="Margem inferior" value={valor.margemInferiorMm} onChange={(v) => numero("margemInferiorMm", v)} /><Campo label="Margem esquerda" value={valor.margemEsquerdaMm} onChange={(v) => numero("margemEsquerdaMm", v)} /><Campo label="Margem direita" value={valor.margemDireitaMm} onChange={(v) => numero("margemDireitaMm", v)} /></div>
    <Campo label="Espaçamento entre fotos (mm)" value={valor.espacamentoMm} onChange={(v) => numero("espacamentoMm", v)} />
    <div className="flex items-center justify-between gap-4 rounded-md border p-3"><div><Label htmlFor="permitir-giro">Girar peças para aproveitar o papel</Label><p className="text-xs text-muted-foreground">A fotografia e seus textos giram juntos.</p></div><Switch id="permitir-giro" checked={valor.permitirRotacao} onCheckedChange={(v) => onChange({ ...valor, permitirRotacao: v })} /></div>
  </div>;
}
function Campo({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input type="number" min={0} step={0.5} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }