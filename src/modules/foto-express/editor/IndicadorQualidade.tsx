import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ROTULO_QUALIDADE, type ResultadoQualidade } from "../lib/qualidade";

export function IndicadorQualidade({ resultado }: { resultado: ResultadoQualidade }) {
  const critica = resultado.dpi !== null && resultado.dpi < 150;
  const baixa = resultado.dpi !== null && resultado.dpi < 220;
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><span className="text-sm font-medium">Qualidade</span><Badge variant={baixa ? "destructive" : "outline"}>{ROTULO_QUALIDADE[resultado.qualidade]}{resultado.dpi !== null ? ` · ${resultado.dpi} DPI` : ""}</Badge></div>
    {baixa && <Alert variant={critica ? "destructive" : "default"}>{critica ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}<AlertTitle>{critica ? "Qualidade muito baixa" : "Atenção à qualidade"}</AlertTitle><AlertDescription>Esta foto pode perder qualidade nesse tamanho de impressão.</AlertDescription></Alert>}
  </div>;
}