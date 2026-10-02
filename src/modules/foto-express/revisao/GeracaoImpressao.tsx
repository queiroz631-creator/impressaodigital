import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import JSZip from "jszip";
import { Archive, Download, FileImage, FileText, Loader2, Printer, RotateCcw } from "lucide-react";
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

export function GeracaoImpressao({ trabalhoId, numeroTrabalho, habilitada, folhas, papel, orientacao }: { trabalhoId: string; numeroTrabalho: number | undefined; habilitada: boolean; folhas: number; papel: string; orientacao: string }) {
  const [saida, setSaida] = useState<SaidaGeracao>("PDF");
  const [progresso, setProgresso] = useState<ProgressoGeracao | null>(null);
  const [baixandoTodos, setBaixandoTodos] = useState(false);
  const [progressoDownload, setProgressoDownload] = useState(0);
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
  const arquivosValidos = ultima?.arquivos.filter((arquivo) => arquivo.estado === "VALIDADO") ?? [];
  const baixarTodos = async () => {
    if (arquivosValidos.length < 2 || baixandoTodos) return;
    setBaixandoTodos(true);
    setProgressoDownload(0);
    try {
      const zip = new JSZip();
      for (let indice = 0; indice < arquivosValidos.length; indice += 1) {
        const arquivo = arquivosValidos[indice];
        if (!arquivo) continue;
        const resultado = await download({ data: { arquivoId: arquivo.id } });
        const resposta = await fetch(resultado.url);
        if (!resposta.ok) throw new Error(`Não foi possível baixar ${resultado.nome}.`);
        zip.file(resultado.nome, await resposta.blob());
        setProgressoDownload(indice + 1);
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `foto-express-${String(numeroTrabalho ?? trabalhoId.slice(0, 8)).padStart(6, "0")}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${arquivosValidos.length} arquivos reunidos no ZIP.`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível preparar o ZIP.");
    } finally {
      setBaixandoTodos(false);
      setProgressoDownload(0);
    }
  };
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" />Arquivo de impressão</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-sm"><Dado nome="Papel" valor={papel} /><Dado nome="Orientação" valor={orientacao === "MISTA" ? "Conforme o papel" : orientacao === "PAISAGEM" ? "Paisagem" : "Retrato"} /><Dado nome="Qualidade" valor="300 DPI" /></div>
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
      {ultima?.estado === "CONCLUIDA" && <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Arquivos concluídos</p>{arquivosValidos.length > 1 && <Button type="button" size="sm" disabled={baixandoTodos} onClick={() => void baixarTodos()}>{baixandoTodos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}{baixandoTodos ? `Preparando ${progressoDownload}/${arquivosValidos.length}` : "Baixar todos"}</Button>}</div>
        {baixandoTodos && <Progress value={progressoDownload / arquivosValidos.length * 100} />}
        <div className="flex flex-wrap gap-2">{arquivosValidos.map((arquivo) => <Button key={arquivo.id} variant="outline" size="sm" disabled={baixandoTodos} onClick={() => void abrirDownload(arquivo.id)}>{arquivo.tipo === "PDF" ? <FileText className="mr-2 h-4 w-4" /> : <FileImage className="mr-2 h-4 w-4" />}<Download className="mr-2 h-3.5 w-3.5" />{arquivo.tipo === "PDF" ? "Baixar PDF" : `Folha ${arquivo.folha_numero}`}</Button>)}</div>
      </div>}
    </CardContent>
  </Card>;
}

function Opcao({ id, valor, titulo, descricao }: { id: string; valor: string; titulo: string; descricao: string }) { return <Label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3"><RadioGroupItem id={id} value={valor} /><span><span className="block font-medium">{titulo}</span><span className="text-xs text-muted-foreground">{descricao}</span></span></Label>; }
function Dado({ nome, valor }: { nome: string; valor: string }) { return <div><p className="text-xs text-muted-foreground">{nome}</p><p className="font-medium">{valor}</p></div>; }