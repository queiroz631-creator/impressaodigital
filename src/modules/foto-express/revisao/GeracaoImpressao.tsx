import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileImage, FileText, Loader2, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { atualizarGeracaoFotoExpress, concluirGeracaoFotoExpress, falharGeracaoFotoExpress, obterDownloadGeracaoFotoExpress, prepararGeracaoFotoExpress } from "@/lib/foto-express.functions";
import { gerarArquivos, type ProgressoGeracao } from "../renderizacao/gerador";
import { validarManifesto, type PreparacaoGeracao, type SaidaGeracao } from "../renderizacao/types";
import { useGeracoes } from "../hooks/useFotoExpress";

export function GeracaoImpressao({ trabalhoId, habilitada, folhas, papel, orientacao }: { trabalhoId: string; habilitada: boolean; folhas: number; papel: string; orientacao: string }) {
  const [saida, setSaida] = useState<SaidaGeracao>("PDF");
  const [progresso, setProgresso] = useState<ProgressoGeracao | null>(null);
  const preparar = useServerFn(prepararGeracaoFotoExpress);
  const atualizar = useServerFn(atualizarGeracaoFotoExpress);
  const concluir = useServerFn(concluirGeracaoFotoExpress);
  const falhar = useServerFn(falharGeracaoFotoExpress);
  const download = useServerFn(obterDownloadGeracaoFotoExpress);
  const geracoes = useGeracoes(trabalhoId);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const bruto = await preparar({ data: { trabalhoId, saida } });
      const preparacao: PreparacaoGeracao = { ...bruto, manifesto: validarManifesto(bruto.manifesto), destinos: bruto.destinos as PreparacaoGeracao["destinos"] };
      try {
        let ultimaEtapa = "";
        const memoria = await gerarArquivos(preparacao, (p) => {
          setProgresso(p);
          if (p.etapa !== ultimaEtapa) { ultimaEtapa = p.etapa; void atualizar({ data: { geracaoId: preparacao.geracaoId, etapa: p.etapa } }); }
        });
        setProgresso({ etapa: "Verificando arquivos" });
        await concluir({ data: { geracaoId: preparacao.geracaoId } });
        return memoria;
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "Falha durante a geração.";
        await falhar({ data: { geracaoId: preparacao.geracaoId, erro: mensagem } }).catch(() => undefined);
        throw erro;
      }
    },
    onSuccess: (memoria) => { setProgresso(null); toast.success(`Arquivo de impressão concluído. Pico estimado: ${Math.round(memoria.picoEstimadoBytes / 1024 / 1024)} MB.`); void qc.invalidateQueries({ queryKey: ["foto-express", "geracoes", trabalhoId] }); },
    onError: (erro: Error) => { setProgresso(null); toast.error(erro.message); void qc.invalidateQueries({ queryKey: ["foto-express", "geracoes", trabalhoId] }); },
  });
  const abrirDownload = async (arquivoId: string) => {
    try { const resultado = await download({ data: { arquivoId } }); window.location.assign(resultado.url); }
    catch (erro) { toast.error(erro instanceof Error ? erro.message : "Download indisponível."); }
  };
  const ultima = geracoes.data?.[0];
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" />Arquivo de impressão</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-sm"><Dado nome="Papel" valor={papel} /><Dado nome="Orientação" valor={orientacao === "PAISAGEM" ? "Paisagem" : "Retrato"} /><Dado nome="Qualidade" valor="300 DPI" /></div>
      <RadioGroup value={saida} onValueChange={(valor) => setSaida(valor as SaidaGeracao)} className="grid sm:grid-cols-3">
        <Opcao id="saida-pdf" valor="PDF" titulo="PDF" descricao={`${folhas} página(s)`} />
        <Opcao id="saida-jpg" valor="JPG" titulo="JPG" descricao={`${folhas} arquivo(s)`} />
        <Opcao id="saida-ambos" valor="PDF_JPG" titulo="PDF + JPG" descricao="Todos os formatos" />
      </RadioGroup>
      {mutation.isPending && progresso && <div className="space-y-2"><div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{progresso.etapa}</div>{progresso.total && <Progress value={(progresso.atual ?? 0) / progresso.total * 100} />}</div>}
      <Button className="w-full" disabled={!habilitada || mutation.isPending || folhas < 1} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : ultima?.estado === "ERRO" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}{ultima?.estado === "ERRO" ? "Tentar novamente" : "Gerar arquivo de impressão"}</Button>
      {!habilitada && <p className="text-sm text-muted-foreground">Confirme uma montagem atual antes de gerar.</p>}
      {ultima?.estado === "ERRO" && <p className="text-sm text-destructive">{ultima.erro || "A geração não foi concluída."}</p>}
      {ultima?.estado === "PROCESSANDO" && !mutation.isPending && <p className="text-sm text-muted-foreground">{ultima.etapa}</p>}
      {ultima?.estado === "CONCLUIDA" && <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Arquivos concluídos</p><div className="flex flex-wrap gap-2">{ultima.arquivos.filter((arquivo) => arquivo.estado === "VALIDADO").map((arquivo) => <Button key={arquivo.id} variant="outline" size="sm" onClick={() => void abrirDownload(arquivo.id)}>{arquivo.tipo === "PDF" ? <FileText className="mr-2 h-4 w-4" /> : <FileImage className="mr-2 h-4 w-4" />}<Download className="mr-2 h-3.5 w-3.5" />{arquivo.tipo === "PDF" ? "Baixar PDF" : `Folha ${arquivo.folha_numero}`}</Button>)}</div></div>}
    </CardContent>
  </Card>;
}

function Opcao({ id, valor, titulo, descricao }: { id: string; valor: string; titulo: string; descricao: string }) { return <Label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3"><RadioGroupItem id={id} value={valor} /><span><span className="block font-medium">{titulo}</span><span className="text-xs text-muted-foreground">{descricao}</span></span></Label>; }
function Dado({ nome, valor }: { nome: string; valor: string }) { return <div><p className="text-xs text-muted-foreground">{nome}</p><p className="font-medium">{valor}</p></div>; }