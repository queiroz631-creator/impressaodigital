import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Images, LayoutGrid, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { salvarMontagemFotoExpress } from "@/lib/foto-express.functions";
import { useItensGaleria, useMontagem, usePapeis, useTextosTrabalho, useTrabalho } from "../hooks/useFotoExpress";
import { calcularQualidadeFoto } from "../lib/qualidade";
import { assinaturaMontagemPorPapeis, capacidadeEstimadaFormato, montarFolhas, type ConfiguracaoMontagem, type OrientacaoPapel, type PlanoMontagem } from "../lib/montagem";
import { PreviewFolha } from "../montagem/PreviewFolha";
import type { ItemGaleria, PapelFoto } from "../types";
import { GeracaoImpressao } from "./GeracaoImpressao";

const configurarPapel = (papel: PapelFoto): ConfiguracaoMontagem => ({
  papelId: papel.id, papelNome: papel.nome, larguraMm: Number(papel.largura_mm), alturaMm: Number(papel.altura_mm),
  orientacao: papel.orientacao === "RETRATO" || papel.orientacao === "PAISAGEM"
    ? papel.orientacao
    : Number(papel.largura_mm) <= Number(papel.altura_mm) ? "RETRATO" : "PAISAGEM",
  orientacaoFotos: "AUTOMATICA",
  margemSuperiorMm: Number(papel.margem_superior_mm), margemInferiorMm: Number(papel.margem_inferior_mm),
  margemEsquerdaMm: Number(papel.margem_esquerda_mm), margemDireitaMm: Number(papel.margem_direita_mm),
  espacamentoMm: Number(papel.espacamento_mm), permitirRotacao: papel.permitir_rotacao,
});

type GrupoMontagem = { papel: PapelFoto; config: ConfiguracaoMontagem; itens: ItemGaleria[]; plano: PlanoMontagem };
type ModoOrientacao = "TODOS" | "POR_PAPEL";

export function RevisaoPagina({ trabalhoId }: { trabalhoId: string }) {
  const { data: trabalho } = useTrabalho(trabalhoId);
  const itensQuery = useItensGaleria(trabalhoId); const itens = itensQuery.data ?? [];
  const textosQuery = useTextosTrabalho(itens.map((item) => item.id)); const textos = textosQuery.data ?? [];
  const montagemQuery = useMontagem(trabalhoId); const papeisQuery = usePapeis(); const papeis = papeisQuery.data ?? [];
  const { user } = useAuth(); const { pode } = usePermissoes(user?.id); const podeEditar = pode("foto_express.trabalhos.editar");
  const salvar = useServerFn(salvarMontagemFotoExpress); const qc = useQueryClient();
  const [indice, setIndice] = useState(0); const [assinatura, setAssinatura] = useState("");
  const [modoOrientacao, setModoOrientacao] = useState<ModoOrientacao>("TODOS");
  const [orientacaoTodos, setOrientacaoTodos] = useState<OrientacaoPapel>("AUTOMATICA");
  const [orientacoesPorPapel, setOrientacoesPorPapel] = useState<Record<string, OrientacaoPapel>>({});

  const resultado = useMemo<{ grupos: GrupoMontagem[]; plano: PlanoMontagem | null; erro: string | null }>(() => {
    if (papeisQuery.isLoading) return { grupos: [], plano: null, erro: null };
    if (!itens.length) return { grupos: [], plano: null, erro: "Adicione fotos antes de montar." };
    const mapa = new Map<string, ItemGaleria[]>();
    for (const item of itens) {
      const papelId = item.formato?.papel_padrao_id;
      if (!papelId) return { grupos: [], plano: null, erro: `O formato da foto ${item.ordem + 1} não possui papel padrão.` };
      const lista = mapa.get(papelId) ?? []; lista.push(item); mapa.set(papelId, lista);
    }
    try {
      const grupos: GrupoMontagem[] = [];
      let proximoNumero = 1;
      for (const papel of papeis) {
        const itensGrupo = mapa.get(papel.id); if (!itensGrupo?.length) continue;
        const orientacaoFotos = modoOrientacao === "TODOS" ? orientacaoTodos : orientacoesPorPapel[papel.id] ?? "AUTOMATICA";
        const config = { ...configurarPapel(papel), orientacaoFotos }; const calculado = montarFolhas(itensGrupo, config);
        const plano = { ...calculado, folhas: calculado.folhas.map((folha) => ({ ...folha, numero: proximoNumero++, papelId: papel.id, papelNome: papel.nome })) };
        grupos.push({ papel, config, itens: itensGrupo, plano });
      }
      if (grupos.length !== mapa.size) return { grupos: [], plano: null, erro: "Um papel padrão usado pelas fotos está inativo ou indisponível." };
      const folhas = grupos.flatMap((grupo) => grupo.plano.folhas);
      const areaUtilMm2 = grupos.reduce((soma, grupo) => soma + grupo.plano.areaUtilMm2, 0);
      const areaOcupadaMm2 = grupos.reduce((soma, grupo) => soma + grupo.plano.areaOcupadaMm2, 0);
      return { grupos, plano: { folhas, orientacaoEscolhida: grupos.every((grupo) => grupo.plano.orientacaoEscolhida === grupos[0]?.plano.orientacaoEscolhida) ? (grupos[0]?.plano.orientacaoEscolhida ?? "RETRATO") : "RETRATO", areaUtilMm2, areaOcupadaMm2, aproveitamento: areaUtilMm2 ? Number((areaOcupadaMm2 / areaUtilMm2 * 100).toFixed(3)) : 0 }, erro: null };
    } catch (erro) { return { grupos: [], plano: null, erro: erro instanceof Error ? erro.message : "Não foi possível montar as folhas." }; }
  }, [itens, modoOrientacao, orientacaoTodos, orientacoesPorPapel, papeis, papeisQuery.isLoading]);

  useEffect(() => { const configs = resultado.grupos.map((grupo) => grupo.config); if (configs.length) void assinaturaMontagemPorPapeis(itens, textos, configs).then(setAssinatura); else setAssinatura(""); }, [itens, textos, resultado.grupos]);
  useEffect(() => { setIndice(0); }, [resultado.plano?.folhas.length]);

  const alertas = useMemo(() => itens.flatMap((item) => {
    const avisos: string[] = [];
    if (!item.formato) avisos.push(`Foto ${item.ordem + 1}: escolha um formato.`);
    else if (!item.formato.papel_padrao_id) avisos.push(`Foto ${item.ordem + 1}: o formato ${item.formato.nome} está sem papel padrão.`);
    if (item.quantidade < 1) avisos.push(`Foto ${item.ordem + 1}: quantidade inválida.`);
    if (!item.thumbnailUrl) avisos.push(`Foto ${item.ordem + 1}: imagem indisponível.`);
    const configuracao = item.configuracao; const cropValido = configuracao && Number(configuracao.crop_largura) > 0 && Number(configuracao.crop_altura) > 0;
    if (item.formato && !cropValido) avisos.push(`Foto ${item.ordem + 1}: configuração incompleta; abra o editor para conferir.`);
    if (item.formato && configuracao && cropValido) {
      const qualidade = calcularQualidadeFoto({ larguraPx: item.arquivo.largura_px, alturaPx: item.arquivo.altura_px, larguraCm: Number(item.formato.largura_cm) * Number(item.formato.area_foto_largura), alturaCm: Number(item.formato.altura_cm) * Number(item.formato.area_foto_altura), orientacao: item.orientacao, crop: { largura: Number(configuracao.crop_largura), altura: Number(configuracao.crop_altura) }, rotacao: Number(configuracao.rotacao) });
      if (qualidade.dpi !== null && qualidade.dpi < 220) avisos.push(`Foto ${item.ordem + 1}: ${qualidade.dpi} DPI${qualidade.dpi < 150 ? " — qualidade muito baixa" : " — qualidade baixa"}.`);
    }
    return avisos;
  }), [itens]);

  const desatualizada = Boolean(montagemQuery.data && montagemQuery.data.assinatura !== assinatura);
  const alterarModoOrientacao = (modo: ModoOrientacao) => {
    if (modo === "POR_PAPEL") setOrientacoesPorPapel(Object.fromEntries(resultado.grupos.map((grupo) => [grupo.papel.id, orientacaoTodos])));
    setModoOrientacao(modo);
  };
  const restaurarOrientacoes = () => {
    setOrientacaoTodos("AUTOMATICA");
    setOrientacoesPorPapel(Object.fromEntries(resultado.grupos.map((grupo) => [grupo.papel.id, "AUTOMATICA"])));
    setIndice(0);
  };
  const mutation = useMutation({
    mutationFn: async () => {
      if (!resultado.plano?.folhas.length || !resultado.grupos.length) throw new Error(resultado.erro ?? "Não há folhas para confirmar.");
      return salvar({ data: { trabalhoId, assinatura, versao: montagemQuery.data?.versao ?? 0, grupos: resultado.grupos.map((grupo) => ({ papelId: grupo.papel.id, orientacaoEscolhida: grupo.plano.orientacaoEscolhida, folhas: grupo.plano.folhas })) } });
    },
    onSuccess: () => { toast.success("Montagem confirmada por papel."); void qc.invalidateQueries({ queryKey: ["foto-express", "montagem", trabalhoId] }); },
    onError: (erro: Error) => toast.error(erro.message.includes("MONTAGEM_DESATUALIZADA") ? "A montagem foi alterada em outra tela. Recarregue e tente novamente." : erro.message),
  });

  if (itensQuery.isLoading || textosQuery.isLoading) return <p className="text-sm text-muted-foreground">Carregando revisão...</p>;
  const orientacaoGeracao = resultado.grupos.length > 1 ? "MISTA" : resultado.grupos[0]?.plano.orientacaoEscolhida ?? "RETRATO";
  return <><PageHeader titulo={`Revisão #${String(trabalho?.numero ?? "").padStart(6, "0")}`} subtitulo={trabalho?.cliente_nome || "Conferência e montagem automática"} />
    <div className="mb-4 flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/foto-express/$id/fotos" params={{ id: trabalhoId }}><Images className="mr-2 h-4 w-4" />Galeria</Link></Button>{desatualizada && <Badge variant="destructive" className="self-center">Montagem desatualizada</Badge>}</div>
    {alertas.length > 0 && <Alert className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Avisos da revisão</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-4">{alertas.map((aviso, i) => <li key={`${aviso}-${i}`}>{aviso}</li>)}</ul></AlertDescription></Alert>}
    {resultado.erro && <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Montagem indisponível</AlertTitle><AlertDescription>{resultado.erro}</AlertDescription></Alert>}
    <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"><div className="space-y-4">
      <Card><CardHeader><CardTitle>Dados do trabalho</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><Dado nome="Fotos" valor={String(itens.length)} /><Dado nome="Cópias" valor={String(itens.reduce((soma, item) => soma + item.quantidade, 0))} /><Dado nome="Cliente" valor={trabalho?.cliente_nome || "Não informado"} /><Dado nome="Telefone" valor={trabalho?.cliente_telefone || "Não informado"} /></CardContent></Card>
      <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Orientação dos formatos</CardTitle><Button type="button" variant="ghost" size="sm" disabled={!podeEditar || !resultado.grupos.length} onClick={restaurarOrientacoes}><RotateCcw className="mr-2 h-4 w-4" />Restaurar</Button></div></CardHeader><CardContent className="space-y-4">
        {resultado.grupos.length > 1 && <div className="space-y-2"><Label htmlFor="modo-orientacao">Configurar</Label><Select value={modoOrientacao} onValueChange={(valor: ModoOrientacao) => alterarModoOrientacao(valor)} disabled={!podeEditar}><SelectTrigger id="modo-orientacao"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os papéis juntos</SelectItem><SelectItem value="POR_PAPEL">Cada papel separadamente</SelectItem></SelectContent></Select></div>}
        {(resultado.grupos.length <= 1 || modoOrientacao === "TODOS") && <OrientacaoSelect id="orientacao-todos" label={resultado.grupos.length > 1 ? "Formatos em todos os papéis" : "Formatos dentro do papel"} value={orientacaoTodos} onChange={setOrientacaoTodos} disabled={!podeEditar} />}
        <p className="text-xs text-muted-foreground">Retrato e Paisagem fixam a posição do formato. Automática escolhe a posição com melhor aproveitamento. O papel não é alterado.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Papéis da montagem</CardTitle></CardHeader><CardContent className="space-y-4">{resultado.grupos.map((grupo) => <div key={grupo.papel.id} className="space-y-3 border-b pb-4 last:border-b-0 last:pb-0"><div className="flex items-center justify-between gap-2"><p className="font-medium">{grupo.papel.nome}</p><Badge variant="outline">{grupo.plano.folhas.length} folha(s)</Badge></div>{resultado.grupos.length > 1 && modoOrientacao === "POR_PAPEL" && <OrientacaoSelect id={`orientacao-${grupo.papel.id}`} label={`Formatos no papel ${grupo.papel.nome}`} value={orientacoesPorPapel[grupo.papel.id] ?? "AUTOMATICA"} onChange={(orientacao) => setOrientacoesPorPapel((atuais) => ({ ...atuais, [grupo.papel.id]: orientacao }))} disabled={!podeEditar} />}<p className="text-sm text-muted-foreground">{grupo.itens.length} foto(s) · {grupo.itens.reduce((soma, item) => soma + item.quantidade, 0)} cópia(s) · {grupo.plano.aproveitamento}% aproveitado</p><div className="flex flex-wrap gap-1.5">{[...new Map(grupo.itens.filter((item) => item.formato).map((item) => [item.formato?.id, item.formato])).values()].map((formato) => formato ? <Badge key={formato.id} variant="secondary">{formato.nome}: até {capacidadeEstimadaFormato(formato, grupo.papel)}/folha</Badge> : null)}</div></div>)}</CardContent></Card>
      {resultado.plano && <GeracaoImpressao trabalhoId={trabalhoId} numeroTrabalho={trabalho?.numero} habilitada={Boolean(podeEditar && montagemQuery.data && !desatualizada && montagemQuery.data.snapshot_confirmado)} folhas={resultado.plano.folhas.length} papel={resultado.grupos.length > 1 ? `${resultado.grupos.length} papéis` : resultado.grupos[0]?.papel.nome ?? "—"} orientacao={orientacaoGeracao} />}
    </div><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />Prévia das folhas</CardTitle>{resultado.plano && <div className="flex flex-wrap gap-2"><Badge variant="outline">{resultado.plano.folhas.length} folha(s)</Badge><Badge variant="outline">{resultado.grupos.length} papel(is)</Badge><Badge variant="outline">{resultado.plano.aproveitamento}% aproveitado</Badge></div>}</div></CardHeader><CardContent className="space-y-5">{resultado.plano && <PreviewFolha plano={resultado.plano} indice={indice} onIndice={setIndice} itens={itens} textos={textos} />}<Button className="w-full" disabled={!podeEditar || mutation.isPending || !resultado.plano?.folhas.length || !assinatura || Boolean(resultado.erro)} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmar montagem</Button></CardContent></Card></div>
  </>;
}

function Dado({ nome, valor }: { nome: string; valor: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{nome}</p><p className="truncate font-medium">{valor}</p></div>; }

function OrientacaoSelect({ id, label, value, onChange, disabled }: { id: string; label: string; value: OrientacaoPapel; onChange: (valor: OrientacaoPapel) => void; disabled: boolean }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={(valor: OrientacaoPapel) => onChange(valor)} disabled={disabled}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AUTOMATICA">Automática</SelectItem><SelectItem value="RETRATO">Retrato</SelectItem><SelectItem value="PAISAGEM">Paisagem</SelectItem></SelectContent></Select></div>;
}