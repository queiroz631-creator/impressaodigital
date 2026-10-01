import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Images, LayoutGrid, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { salvarMontagemFotoExpress } from "@/lib/foto-express.functions";
import { useItensGaleria, useMontagem, useTextosTrabalho, useTrabalho } from "../hooks/useFotoExpress";
import { calcularQualidadeFoto } from "../lib/qualidade";
import { montarFolhas, assinaturaMontagem, PAPEIS, type ConfiguracaoMontagem, type PlanoMontagem } from "../lib/montagem";
import { ConfiguracaoPapel } from "./ConfiguracaoPapel";
import { PreviewFolha } from "../montagem/PreviewFolha";

const PADRAO: ConfiguracaoMontagem = { papel: "A4", orientacao: "AUTOMATICA", margemSuperiorMm: 5, margemInferiorMm: 5, margemEsquerdaMm: 5, margemDireitaMm: 5, espacamentoMm: 2, permitirRotacao: true };
export function RevisaoPagina({ trabalhoId }: { trabalhoId: string }) {
  const { data: trabalho } = useTrabalho(trabalhoId); const itensQuery = useItensGaleria(trabalhoId); const itens = itensQuery.data ?? [];
  const textosQuery = useTextosTrabalho(itens.map((i) => i.id)); const textos = textosQuery.data ?? []; const montagemQuery = useMontagem(trabalhoId);
  const { user } = useAuth(); const { pode } = usePermissoes(user?.id); const podeEditar = pode("foto_express.trabalhos.editar"); const salvar = useServerFn(salvarMontagemFotoExpress); const qc = useQueryClient();
  const [config, setConfig] = useState<ConfiguracaoMontagem>(PADRAO); const [indice, setIndice] = useState(0); const [assinatura, setAssinatura] = useState("");
  useEffect(() => { const m = montagemQuery.data; if (!m) return; setConfig({ papel: m.papel === "A3" ? "A3" : "A4", orientacao: m.orientacao_solicitada === "RETRATO" || m.orientacao_solicitada === "PAISAGEM" ? m.orientacao_solicitada : "AUTOMATICA", margemSuperiorMm: Number(m.margem_superior_mm), margemInferiorMm: Number(m.margem_inferior_mm), margemEsquerdaMm: Number(m.margem_esquerda_mm), margemDireitaMm: Number(m.margem_direita_mm), espacamentoMm: Number(m.espacamento_mm), permitirRotacao: m.permitir_rotacao }); }, [montagemQuery.data]);
  useEffect(() => { void assinaturaMontagem(itens, textos, config).then(setAssinatura); }, [itens, textos, config]);
  const resultado = useMemo<{ plano: PlanoMontagem | null; erro: string | null }>(() => { try { return { plano: montarFolhas(itens, config), erro: null }; } catch (e) { return { plano: null, erro: e instanceof Error ? e.message : "Não foi possível montar as folhas." }; } }, [itens, config]);
  useEffect(() => { setIndice(0); }, [resultado.plano?.folhas.length, config]);
  const alertas = useMemo(() => itens.flatMap((item) => {
    const avisos: string[] = [];
    if (!item.formato) avisos.push(`Foto ${item.ordem + 1}: escolha um formato.`);
    if (item.quantidade < 1) avisos.push(`Foto ${item.ordem + 1}: quantidade inválida.`);
    if (!item.thumbnailUrl) avisos.push(`Foto ${item.ordem + 1}: imagem indisponível.`);
    const configuracaoItem = item.configuracao;
    const cropValido = configuracaoItem && Number(configuracaoItem.crop_largura) > 0 && Number(configuracaoItem.crop_altura) > 0;
    if (item.formato && !cropValido) avisos.push(`Foto ${item.ordem + 1}: configuração incompleta; abra o editor para conferir.`);
    if (item.formato && configuracaoItem && cropValido) {
      const q = calcularQualidadeFoto({ larguraPx: item.arquivo.largura_px, alturaPx: item.arquivo.altura_px, larguraCm: Number(item.formato.largura_cm) * Number(item.formato.area_foto_largura), alturaCm: Number(item.formato.altura_cm) * Number(item.formato.area_foto_altura), orientacao: item.orientacao, crop: { largura: Number(configuracaoItem.crop_largura), altura: Number(configuracaoItem.crop_altura) }, rotacao: Number(configuracaoItem.rotacao) });
      if (q.dpi !== null && q.dpi < 220) avisos.push(`Foto ${item.ordem + 1}: ${q.dpi} DPI${q.dpi < 150 ? " — qualidade muito baixa" : " — qualidade baixa"}.`);
    }
    return avisos;
  }), [itens]);
  const desatualizada = Boolean(montagemQuery.data && montagemQuery.data.assinatura !== assinatura);
  const mutation = useMutation({ mutationFn: async () => { const plano = resultado.plano; if (!plano?.folhas.length) throw new Error(resultado.erro ?? "Não há folhas para confirmar."); const papel = PAPEIS[config.papel]; const largura = plano.orientacaoEscolhida === "PAISAGEM" ? Math.max(papel.larguraMm, papel.alturaMm) : Math.min(papel.larguraMm, papel.alturaMm); const altura = plano.orientacaoEscolhida === "PAISAGEM" ? Math.min(papel.larguraMm, papel.alturaMm) : Math.max(papel.larguraMm, papel.alturaMm); return salvar({ data: { trabalhoId, papel: config.papel, papelLarguraMm: largura, papelAlturaMm: altura, orientacaoSolicitada: config.orientacao, orientacaoEscolhida: plano.orientacaoEscolhida, margemSuperiorMm: config.margemSuperiorMm, margemInferiorMm: config.margemInferiorMm, margemEsquerdaMm: config.margemEsquerdaMm, margemDireitaMm: config.margemDireitaMm, espacamentoMm: config.espacamentoMm, permitirRotacao: config.permitirRotacao, assinatura, versao: montagemQuery.data?.versao ?? 0, folhas: plano.folhas } }); }, onSuccess: () => { toast.success("Montagem confirmada."); void qc.invalidateQueries({ queryKey: ["foto-express", "montagem", trabalhoId] }); }, onError: (e: Error) => { toast.error(e.message.includes("MONTAGEM_DESATUALIZADA") ? "A montagem foi alterada em outra tela. Recarregue e tente novamente." : e.message); } });
  if (itensQuery.isLoading || textosQuery.isLoading) return <p className="text-sm text-muted-foreground">Carregando revisão...</p>;
  return <><PageHeader titulo={`Revisão #${String(trabalho?.numero ?? "").padStart(6, "0")}`} subtitulo={trabalho?.cliente_nome || "Conferência e montagem automática"} />
    <div className="mb-4 flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/foto-express/$id/fotos" params={{ id: trabalhoId }}><Images className="mr-2 h-4 w-4" />Galeria</Link></Button>{desatualizada && <Badge variant="destructive" className="self-center">Montagem desatualizada</Badge>}</div>
    {alertas.length > 0 && <Alert className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Avisos da revisão</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-4">{alertas.map((a, i) => <li key={`${a}-${i}`}>{a}</li>)}</ul></AlertDescription></Alert>}
    {resultado.erro && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Montagem indisponível</AlertTitle><AlertDescription>{resultado.erro}</AlertDescription></Alert>}
    <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><div className="space-y-4"><Card><CardHeader><CardTitle>Dados do trabalho</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><Dado nome="Fotos" valor={String(itens.length)} /><Dado nome="Cópias" valor={String(itens.reduce((s, i) => s + i.quantidade, 0))} /><Dado nome="Cliente" valor={trabalho?.cliente_nome || "Não informado"} /><Dado nome="Telefone" valor={trabalho?.cliente_telefone || "Não informado"} /></CardContent></Card><Card><CardHeader><CardTitle>Papel e montagem</CardTitle></CardHeader><CardContent><ConfiguracaoPapel valor={config} onChange={setConfig} /></CardContent></Card></div>
      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />Prévia das folhas</CardTitle>{resultado.plano && <div className="flex flex-wrap gap-2"><Badge variant="outline">{resultado.plano.folhas.length} folha(s)</Badge><Badge variant="outline">{resultado.plano.orientacaoEscolhida === "PAISAGEM" ? "Paisagem" : "Retrato"}</Badge><Badge variant="outline">{resultado.plano.aproveitamento}% aproveitado</Badge></div>}</div></CardHeader><CardContent className="space-y-5">{resultado.plano && <PreviewFolha plano={resultado.plano} indice={indice} onIndice={setIndice} itens={itens} textos={textos} />}<Button className="w-full" disabled={!podeEditar || mutation.isPending || !resultado.plano?.folhas.length || !assinatura} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmar montagem</Button></CardContent></Card></div>
  </>;
}
function Dado({ nome, valor }: { nome: string; valor: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{nome}</p><p className="truncate font-medium">{valor}</p></div>; }