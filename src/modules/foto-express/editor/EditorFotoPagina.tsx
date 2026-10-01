import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, CloudOff, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { salvarEdicaoFotoExpress } from "@/lib/foto-express.functions";
import { useItemEditor, useItensGaleria } from "../hooks/useFotoExpress";
import { calcularQualidadeFoto } from "../lib/qualidade";
import { derivarCrop, dimensoesMoldura, limitarPosicao, calcularGeometria, type EdicaoFoto } from "../lib/transformacaoFoto";
import type { Orientacao } from "../types";
import { AreaEdicao } from "./AreaEdicao";
import { ControlesEditor } from "./ControlesEditor";
import { IndicadorQualidade } from "./IndicadorQualidade";

const EDICAO_INICIAL: EdicaoFoto = { zoom: 1, posicaoX: 0, posicaoY: 0, rotacao: 0, espelharHorizontal: false, espelharVertical: false, modoAjuste: "PREENCHER" };
type EstadoSalvar = "LIMPO" | "PENDENTE" | "SALVANDO" | "SALVO" | "ERRO";

export function EditorFotoPagina({ trabalhoId, itemId }: { trabalhoId: string; itemId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const salvar = useServerFn(salvarEdicaoFotoExpress);
  const itemQuery = useItemEditor(trabalhoId, itemId);
  const itensQuery = useItensGaleria(trabalhoId);
  const { user } = useAuth();
  const { pode, carregando: carregandoPermissoes } = usePermissoes(user?.id);
  const podeEditar = pode("foto_express.trabalhos.editar");
  const [edicao, setEdicao] = useState<EdicaoFoto>(EDICAO_INICIAL);
  const [orientacao, setOrientacao] = useState<Orientacao>("AUTOMATICA");
  const [estadoSalvar, setEstadoSalvar] = useState<EstadoSalvar>("LIMPO");
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const [carregadoId, setCarregadoId] = useState<string | null>(null);
  const revisaoRef = useRef(0);

  const item = itemQuery.data;
  useEffect(() => {
    if (!item || carregadoId === item.id) return;
    setEdicao({
      zoom: Number(item.configuracao.zoom), posicaoX: Number(item.configuracao.posicao_x), posicaoY: Number(item.configuracao.posicao_y),
      rotacao: Number(item.configuracao.rotacao), espelharHorizontal: item.configuracao.espelhar_horizontal,
      espelharVertical: item.configuracao.espelhar_vertical, modoAjuste: item.configuracao.modo_ajuste === "AJUSTAR" ? "AJUSTAR" : "PREENCHER",
    });
    setOrientacao(item.orientacao as Orientacao); setCarregadoId(item.id); setEstadoSalvar("LIMPO"); setImagemFalhou(false);
  }, [item, carregadoId]);

  const formatoCm = useMemo(() => item?.formato ? dimensoesMoldura(Number(item.formato.largura_cm), Number(item.formato.altura_cm), orientacao, { largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, edicao.rotacao) : null, [item, orientacao, edicao.rotacao]);
  const molduraCalculo = useMemo(() => formatoCm ? { largura: formatoCm.largura * 100, altura: formatoCm.altura * 100 } : null, [formatoCm]);

  const mutation = useMutation({
    mutationFn: async ({ revisao, dados }: { revisao: number; dados: { edicao: EdicaoFoto; orientacao: Orientacao } }) => {
      if (!item || !molduraCalculo) throw new Error("Formato de impressão não definido.");
      const geometria = calcularGeometria({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, molduraCalculo, dados.edicao);
      const posicao = limitarPosicao(geometria, dados.edicao.posicaoX, dados.edicao.posicaoY);
      const edicaoLimitada = { ...dados.edicao, posicaoX: posicao.x, posicaoY: posicao.y };
      const crop = derivarCrop({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, molduraCalculo, edicaoLimitada);
      await salvar({ data: { trabalhoId, itemId, zoom: edicaoLimitada.zoom, posicaoX: edicaoLimitada.posicaoX, posicaoY: edicaoLimitada.posicaoY, rotacao: edicaoLimitada.rotacao as 0 | 90 | 180 | 270, cropX: crop.x, cropY: crop.y, cropLargura: crop.largura, cropAltura: crop.altura, espelharHorizontal: edicaoLimitada.espelharHorizontal, espelharVertical: edicaoLimitada.espelharVertical, modoAjuste: edicaoLimitada.modoAjuste, orientacao: dados.orientacao } });
      return revisao;
    },
    onMutate: () => setEstadoSalvar("SALVANDO"),
    onSuccess: (revisao) => { if (revisao === revisaoRef.current) setEstadoSalvar("SALVO"); queryClient.invalidateQueries({ queryKey: ["foto-express", "itens", trabalhoId] }); },
    onError: () => setEstadoSalvar("ERRO"),
  });

  const marcarAlterado = useCallback(() => { revisaoRef.current += 1; setEstadoSalvar("PENDENTE"); }, []);
  const alterarEdicao = useCallback((valor: EdicaoFoto) => { setEdicao(valor); marcarAlterado(); }, [marcarAlterado]);
  const alterarOrientacao = useCallback((valor: Orientacao) => { setOrientacao(valor); setEdicao((atual) => ({ ...atual, posicaoX: 0, posicaoY: 0 })); marcarAlterado(); }, [marcarAlterado]);
  const executarSalvar = useCallback(() => {
    if (!podeEditar || estadoSalvar === "LIMPO" || estadoSalvar === "SALVO" || mutation.isPending) return;
    mutation.mutate({ revisao: revisaoRef.current, dados: { edicao, orientacao } });
  }, [podeEditar, estadoSalvar, mutation, edicao, orientacao]);
  useEffect(() => {
    if (estadoSalvar !== "PENDENTE") return;
    const timer = window.setTimeout(executarSalvar, 700);
    return () => window.clearTimeout(timer);
  }, [estadoSalvar, executarSalvar]);

  const pedirSalvar = () => window.setTimeout(executarSalvar, 0);
  const redefinir = () => { setEdicao(EDICAO_INICIAL); setOrientacao("AUTOMATICA"); marcarAlterado(); window.setTimeout(executarSalvar, 0); };
  const navegarPara = async (destino: string | undefined) => {
    if (!destino) return;
    if (estadoSalvar === "PENDENTE" || estadoSalvar === "ERRO") executarSalvar();
    await navigate({ to: "/foto-express/$trabalhoId/fotos/$itemId/editar", params: { trabalhoId, itemId: destino } });
  };

  if (itemQuery.isLoading || carregandoPermissoes) return <div className="space-y-4 p-4 sm:p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-[520px] w-full" /></div>;
  if (itemQuery.isError || !item) return <div className="p-4 sm:p-6"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Não foi possível abrir a foto</AlertTitle><AlertDescription className="space-y-3"><p>Confira sua conexão e tente novamente.</p><Button variant="outline" onClick={() => itemQuery.refetch()}>Tentar novamente</Button></AlertDescription></Alert></div>;
  if (!item.formato || !formatoCm || !molduraCalculo) return <div className="p-4 sm:p-6"><Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Escolha um formato</AlertTitle><AlertDescription className="space-y-3"><p>Defina o formato desta foto na Galeria antes de editar.</p><Button asChild variant="outline"><Link to="/foto-express/$id/fotos" params={{ id: trabalhoId }}>Voltar para Galeria</Link></Button></AlertDescription></Alert></div>;

  const lista = itensQuery.data ?? [];
  const indice = lista.findIndex((foto) => foto.id === itemId);
  const anterior = indice > 0 ? lista[indice - 1]?.id : undefined;
  const proximo = indice >= 0 && indice < lista.length - 1 ? lista[indice + 1]?.id : undefined;
  const crop = derivarCrop({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, molduraCalculo, edicao);
  const qualidade = calcularQualidadeFoto({ larguraPx: item.arquivo.largura_px, alturaPx: item.arquivo.altura_px, larguraCm: formatoCm.largura, alturaCm: formatoCm.altura, orientacao: "RETRATO", rotacao: edicao.rotacao, crop: { largura: crop.largura, altura: crop.altura } });
  const estado = estadoSalvar === "SALVANDO" ? "Salvando" : estadoSalvar === "ERRO" ? "Erro ao salvar" : estadoSalvar === "PENDENTE" ? "Alterações pendentes" : "Salvo";

  return <div className="space-y-5 p-4 sm:p-6">
    <PageHeader title="Editar foto" description={item.arquivo.nome_original} actions={<Button variant="outline" asChild><Link to="/foto-express/$id/fotos" params={{ id: trabalhoId }}><ArrowLeft className="mr-2 h-4 w-4" />Galeria</Link></Button>} />
    {!podeEditar && <Alert><CloudOff className="h-4 w-4" /><AlertTitle>Somente leitura</AlertTitle><AlertDescription>Você pode visualizar esta edição, mas não alterá-la.</AlertDescription></Alert>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4"><AreaEdicao url={imagemFalhou ? "" : item.originalUrl ?? ""} nome={item.arquivo.nome_original} original={{ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }} proporcao={formatoCm.largura / formatoCm.altura} edicao={edicao} somenteLeitura={!podeEditar} onChange={alterarEdicao} onCommit={pedirSalvar} onImageError={() => setImagemFalhou(true)} />
        {imagemFalhou && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Imagem indisponível</AlertTitle><AlertDescription><Button variant="outline" className="mt-2" onClick={async () => { setImagemFalhou(false); await itemQuery.refetch(); }}>Tentar novamente</Button></AlertDescription></Alert>}
        <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={!anterior} onClick={() => navegarPara(anterior)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><span className="text-sm text-muted-foreground">{indice >= 0 ? `${indice + 1} de ${lista.length}` : ""}</span><Button variant="outline" disabled={!proximo} onClick={() => navegarPara(proximo)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
      </div>
      <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Ajustes</CardTitle><Badge variant={estadoSalvar === "ERRO" ? "destructive" : "outline"}>{mutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{estado}</Badge></CardHeader><CardContent className="space-y-6"><ControlesEditor edicao={edicao} orientacao={orientacao} somenteLeitura={!podeEditar} onChange={alterarEdicao} onOrientacao={alterarOrientacao} onCommit={pedirSalvar} onReset={redefinir} /><IndicadorQualidade resultado={qualidade} />{estadoSalvar === "ERRO" && <Button className="w-full" variant="destructive" onClick={executarSalvar}>Tentar salvar novamente</Button>}</CardContent></Card>
    </div>
  </div>;
}