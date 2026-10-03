import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { aplicarTextoTodasFotosFotoExpress, criarTextoFotoExpress, duplicarTextoFotoExpress, excluirTextoFotoExpress, moverTextoFotoExpress, removerTextoTodasFotosFotoExpress, salvarEdicaoFotoExpress, salvarTextoFotoExpress } from "@/lib/foto-express.functions";
import { useFormatos, useItemEditor, useItensNavegacao, useTextosItem } from "../hooks/useFotoExpress";
import { calcularQualidadeFoto } from "../lib/qualidade";
import { derivarCrop, dimensoesMoldura, limitarPosicao, calcularGeometria, type EdicaoFoto } from "../lib/transformacaoFoto";
import type { Orientacao, TextoFoto } from "../types";
import { AreaEdicao } from "./AreaEdicao";
import { ControlesEditor } from "./ControlesEditor";
import { IndicadorQualidade } from "./IndicadorQualidade";
import { ControlesTexto } from "./textos/ControlesTexto";

const EDICAO_INICIAL: EdicaoFoto = { zoom: 1, posicaoX: 0, posicaoY: 0, rotacao: 0, espelharHorizontal: false, espelharVertical: false, modoAjuste: "PREENCHER" };
type EstadoSalvar = "LIMPO" | "PENDENTE" | "SALVANDO" | "SALVO" | "ERRO";

export function EditorFotoPagina({ trabalhoId, itemId }: { trabalhoId: string; itemId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const salvar = useServerFn(salvarEdicaoFotoExpress);
  const criarTexto = useServerFn(criarTextoFotoExpress);
  const salvarTexto = useServerFn(salvarTextoFotoExpress);
  const duplicarTexto = useServerFn(duplicarTextoFotoExpress);
  const aplicarTextoTodas = useServerFn(aplicarTextoTodasFotosFotoExpress);
  const removerTextoTodas = useServerFn(removerTextoTodasFotosFotoExpress);
  const excluirTexto = useServerFn(excluirTextoFotoExpress);
  const moverTexto = useServerFn(moverTextoFotoExpress);
  const itemQuery = useItemEditor(trabalhoId, itemId);
  const itensQuery = useItensNavegacao(trabalhoId);
  const formatosQuery = useFormatos();
  const textosQuery = useTextosItem(itemId);
  const { user } = useAuth();
  const { pode, carregando: carregandoPermissoes } = usePermissoes(user?.id);
  const podeEditar = pode("foto_express.trabalhos.editar");
  const [edicao, setEdicao] = useState<EdicaoFoto>(EDICAO_INICIAL);
  const [orientacao, setOrientacao] = useState<Orientacao>("AUTOMATICA");
  const [formatoId, setFormatoId] = useState("");
  const [estadoSalvar, setEstadoSalvar] = useState<EstadoSalvar>("LIMPO");
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const [tentativasImagem, setTentativasImagem] = useState(0);
  const [carregadoId, setCarregadoId] = useState<string | null>(null);
  const revisaoRef = useRef(0);
  const [textos, setTextos] = useState<TextoFoto[]>([]);
  const [textoSelecionadoId, setTextoSelecionadoId] = useState<string | null>(null);
  const [estadoTexto, setEstadoTexto] = useState<EstadoSalvar>("LIMPO");
  const textosCarregadosRef = useRef<string | null>(null);
  const timersTextoRef = useRef<Record<string, number>>({});
  const textosRef = useRef<TextoFoto[]>([]);
  const salvamentosTextoRef = useRef<Record<string, Promise<TextoFoto | null>>>({});

  const item = itemQuery.data;
  useEffect(() => {
    if (!item || carregadoId === item.id) return;
    setEdicao({
      zoom: Number(item.configuracao.zoom), posicaoX: Number(item.configuracao.posicao_x), posicaoY: Number(item.configuracao.posicao_y),
      rotacao: Number(item.configuracao.rotacao), espelharHorizontal: item.configuracao.espelhar_horizontal,
      espelharVertical: item.configuracao.espelhar_vertical, modoAjuste: item.configuracao.modo_ajuste === "AJUSTAR" ? "AJUSTAR" : "PREENCHER",
    });
    setOrientacao(item.orientacao as Orientacao); setFormatoId(item.formato_id ?? ""); setCarregadoId(item.id); setEstadoSalvar("LIMPO"); setImagemFalhou(false);
  }, [item, carregadoId]);

  useEffect(() => {
    setTentativasImagem(0);
    setImagemFalhou(false);
  }, [itemId]);

  useEffect(() => {
    if (!imagemFalhou || tentativasImagem >= 2) return;
    const timer = window.setTimeout(async () => {
      const resultado = await itemQuery.refetch();
      if (resultado.data) {
        setTentativasImagem((atual) => atual + 1);
        setImagemFalhou(false);
      }
    }, 750 * 2 ** tentativasImagem);
    return () => window.clearTimeout(timer);
  }, [imagemFalhou, tentativasImagem, itemQuery]);

  useEffect(() => {
    if (!textosQuery.data || textosCarregadosRef.current === itemId) return;
    setTextos(textosQuery.data);
    textosRef.current = textosQuery.data;
    setTextoSelecionadoId(null);
    setEstadoTexto("LIMPO");
    textosCarregadosRef.current = itemId;
  }, [textosQuery.data, itemId]);

  const formatoSelecionado = useMemo(() => formatosQuery.data?.find((formato) => formato.id === formatoId) ?? (item?.formato?.id === formatoId ? item.formato : null), [formatosQuery.data, formatoId, item]);
  const formatoCm = useMemo(() => item && formatoSelecionado ? dimensoesMoldura(Number(formatoSelecionado.largura_cm), Number(formatoSelecionado.altura_cm), orientacao, { largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, edicao.rotacao) : null, [item, formatoSelecionado, orientacao, edicao.rotacao]);
  const areaFoto = useMemo(() => formatoSelecionado ? { x: Number(formatoSelecionado.area_foto_x), y: Number(formatoSelecionado.area_foto_y), largura: Number(formatoSelecionado.area_foto_largura), altura: Number(formatoSelecionado.area_foto_altura) } : { x: 0, y: 0, largura: 1, altura: 1 }, [formatoSelecionado]);
  const molduraCalculo = useMemo(() => formatoCm ? { largura: formatoCm.largura * areaFoto.largura * 100, altura: formatoCm.altura * areaFoto.altura * 100 } : null, [formatoCm, areaFoto]);

  const mutation = useMutation({
    mutationFn: async ({ revisao, dados }: { revisao: number; dados: { edicao: EdicaoFoto; formatoId: string; orientacao: Orientacao } }) => {
      if (!item || !molduraCalculo) throw new Error("Formato de impressão não definido.");
      const geometria = calcularGeometria({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, molduraCalculo, dados.edicao);
      const posicao = limitarPosicao(geometria, dados.edicao.posicaoX, dados.edicao.posicaoY);
      const edicaoLimitada = { ...dados.edicao, posicaoX: posicao.x, posicaoY: posicao.y };
      const crop = derivarCrop({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, molduraCalculo, edicaoLimitada);
      await salvar({ data: { trabalhoId, itemId, formatoId: dados.formatoId, zoom: edicaoLimitada.zoom, posicaoX: edicaoLimitada.posicaoX, posicaoY: edicaoLimitada.posicaoY, rotacao: edicaoLimitada.rotacao as 0 | 90 | 180 | 270, cropX: crop.x, cropY: crop.y, cropLargura: crop.largura, cropAltura: crop.altura, espelharHorizontal: edicaoLimitada.espelharHorizontal, espelharVertical: edicaoLimitada.espelharVertical, modoAjuste: edicaoLimitada.modoAjuste, orientacao: dados.orientacao } });
      return revisao;
    },
    onMutate: () => setEstadoSalvar("SALVANDO"),
    onSuccess: (revisao) => { if (revisao === revisaoRef.current) setEstadoSalvar("SALVO"); queryClient.invalidateQueries({ queryKey: ["foto-express", "itens", trabalhoId] }); },
    onError: () => setEstadoSalvar("ERRO"),
  });

  const marcarAlterado = useCallback(() => { revisaoRef.current += 1; setEstadoSalvar("PENDENTE"); }, []);
  const alterarEdicao = useCallback((valor: EdicaoFoto) => { setEdicao(valor); marcarAlterado(); }, [marcarAlterado]);
  const alterarFormato = useCallback((valor: string) => { setFormatoId(valor); setEdicao((atual) => ({ ...atual, posicaoX: 0, posicaoY: 0 })); marcarAlterado(); }, [marcarAlterado]);
  const alterarOrientacao = useCallback((valor: Orientacao) => { setOrientacao(valor); setEdicao((atual) => ({ ...atual, posicaoX: 0, posicaoY: 0 })); marcarAlterado(); }, [marcarAlterado]);
  const executarSalvar = useCallback(() => {
    if (!podeEditar || estadoSalvar === "LIMPO" || estadoSalvar === "SALVO" || mutation.isPending) return;
    mutation.mutate({ revisao: revisaoRef.current, dados: { edicao, formatoId, orientacao } });
  }, [podeEditar, estadoSalvar, mutation, edicao, formatoId, orientacao]);
  useEffect(() => {
    if (estadoSalvar !== "PENDENTE") return;
    const timer = window.setTimeout(executarSalvar, 700);
    return () => window.clearTimeout(timer);
  }, [estadoSalvar, executarSalvar]);

  const pedirSalvar = () => window.setTimeout(executarSalvar, 0);
  const redefinir = () => { setEdicao(EDICAO_INICIAL); setOrientacao("AUTOMATICA"); marcarAlterado(); window.setTimeout(executarSalvar, 0); };
  const navegarPara = async (destino: string | undefined) => {
    if (!destino) return;
    if ((estadoSalvar === "PENDENTE" || estadoSalvar === "ERRO") && podeEditar) {
      try {
        await mutation.mutateAsync({ revisao: revisaoRef.current, dados: { edicao, formatoId, orientacao } });
      } catch {
        return;
      }
    }
    await navigate({ to: "/foto-express/$trabalhoId/fotos/$itemId/editar", params: { trabalhoId, itemId: destino } });
  };

  const substituirTexto = useCallback((texto: TextoFoto) => {
    setTextos((atuais) => {
      const proximos = atuais.map((atual) => atual.id === texto.id ? texto : atual);
      textosRef.current = proximos;
      return proximos;
    });
    setEstadoTexto("PENDENTE");
  }, []);
  const persistirTexto = useCallback(async (texto: TextoFoto) => {
    if (!podeEditar) return null;
    const timer = timersTextoRef.current[texto.id];
    if (timer) window.clearTimeout(timer);
    delete timersTextoRef.current[texto.id];
    const anterior = salvamentosTextoRef.current[texto.id] ?? Promise.resolve(null);
    const tarefa = anterior.catch(() => null).then(async () => {
      const atual = textosRef.current.find((itemTexto) => itemTexto.id === texto.id) ?? texto;
      setEstadoTexto("SALVANDO");
      try {
        const salvo = await salvarTexto({ data: {
          trabalhoId, itemId, textoId: atual.id, conteudo: atual.conteudo,
          posicaoX: Number(atual.posicao_x), posicaoY: Number(atual.posicao_y),
          larguraNormalizada: Number(atual.largura_normalizada), tamanhoNormalizado: Number(atual.tamanho_normalizado),
          fonteId: atual.fonte_id as "SANS" | "SERIF" | "MONO" | "DECORATIVA", cor: atual.cor,
          alinhamento: atual.alinhamento as "ESQUERDA" | "CENTRO" | "DIREITA", negrito: atual.negrito,
          italico: atual.italico, rotacao: Number(atual.rotacao) as 0 | 90 | 180 | 270, versao: atual.versao,
        } });
        let resultado = salvo;
        setTextos((atuais) => {
          const proximos = atuais.map((itemTexto) => {
            if (itemTexto.id !== atual.id) return itemTexto;
            resultado = itemTexto === atual ? salvo : { ...itemTexto, versao: salvo.versao };
            return resultado;
          });
          textosRef.current = proximos;
          return proximos;
        });
        setEstadoTexto("SALVO");
        return resultado;
      } catch (erro) {
        setEstadoTexto("ERRO");
        if (erro instanceof Error && erro.message.includes("TEXTO_DESATUALIZADO")) {
          const resultado = await textosQuery.refetch();
          if (resultado.data) {
            setTextos(resultado.data);
            textosRef.current = resultado.data;
          }
        }
        return null;
      }
    });
    salvamentosTextoRef.current[texto.id] = tarefa;
    return tarefa;
  }, [podeEditar, salvarTexto, trabalhoId, itemId, textosQuery]);
  const agendarTexto = useCallback((texto: TextoFoto) => {
    const timer = timersTextoRef.current[texto.id];
    if (timer) window.clearTimeout(timer);
    timersTextoRef.current[texto.id] = window.setTimeout(() => persistirTexto(texto), 700);
  }, [persistirTexto]);
  const adicionarTexto = async () => {
    setEstadoTexto("SALVANDO");
    try { const novo = await criarTexto({ data: { trabalhoId, itemId } }); setTextos((atuais) => [...atuais, novo]); setTextoSelecionadoId(novo.id); setEstadoTexto("SALVO"); }
    catch { setEstadoTexto("ERRO"); }
  };
  const duplicarCamada = async (texto: TextoFoto) => {
    setEstadoTexto("SALVANDO");
    try { const novo = await duplicarTexto({ data: { trabalhoId, itemId, textoId: texto.id } }); setTextos((atuais) => [...atuais, novo]); setTextoSelecionadoId(novo.id); setEstadoTexto("SALVO"); }
    catch { setEstadoTexto("ERRO"); }
  };
  const excluirCamada = async (texto: TextoFoto) => {
    if (!window.confirm("Excluir somente este texto?")) return;
    setEstadoTexto("SALVANDO");
    try { await excluirTexto({ data: { trabalhoId, itemId, textoId: texto.id } }); setTextos((atuais) => atuais.filter((atual) => atual.id !== texto.id)); setTextoSelecionadoId(null); setEstadoTexto("SALVO"); }
    catch { setEstadoTexto("ERRO"); }
  };
  const moverCamada = async (texto: TextoFoto, direcao: -1 | 1) => {
    setEstadoTexto("SALVANDO");
    try { await moverTexto({ data: { trabalhoId, itemId, textoId: texto.id, direcao } }); const resultado = await textosQuery.refetch(); if (resultado.data) setTextos(resultado.data); setEstadoTexto("SALVO"); }
    catch { setEstadoTexto("ERRO"); }
  };
  const aplicarCamadaEmTodas = async (texto: TextoFoto) => {
    const quantidade = Math.max(0, (itensQuery.data?.length ?? 1) - 1);
    if (quantidade === 0 || !window.confirm(`Atualizar este texto em ${quantidade} outra(s) foto(s)?`)) return;
    setEstadoTexto("SALVANDO");
    try {
      const textoSalvo = await persistirTexto(texto);
      if (!textoSalvo) return;
      const resultado = await aplicarTextoTodas({ data: { trabalhoId, itemId, textoId: textoSalvo.id } });
      await queryClient.invalidateQueries({ queryKey: ["foto-express", "textos-trabalho"] });
      setEstadoTexto("SALVO");
      toast.success(`Texto atualizado em ${resultado.total} foto(s).`);
    } catch (erro) {
      setEstadoTexto("ERRO");
      toast.error(erro instanceof Error ? erro.message : "Não foi possível aplicar o texto nas fotos.");
    }
  };
  const removerCamadaDeTodas = async (texto: TextoFoto) => {
    if (!window.confirm("Remover este texto de todas as fotos do álbum? Esta ação não pode ser desfeita.")) return;
    setEstadoTexto("SALVANDO");
    try {
      const timer = timersTextoRef.current[texto.id];
      if (timer) window.clearTimeout(timer);
      delete timersTextoRef.current[texto.id];
      await (salvamentosTextoRef.current[texto.id] ?? Promise.resolve(null));
      const resultado = await removerTextoTodas({ data: { trabalhoId, itemId, textoId: texto.id } });
      setTextos((atuais) => {
        const proximos = atuais.filter((atual) => atual.id !== texto.id);
        textosRef.current = proximos;
        return proximos;
      });
      setTextoSelecionadoId(null);
      await queryClient.invalidateQueries({ queryKey: ["foto-express", "textos-trabalho"] });
      setEstadoTexto("SALVO");
      toast.success(`Texto removido de ${resultado.total} foto(s).`);
    } catch (erro) {
      setEstadoTexto("ERRO");
      toast.error(erro instanceof Error ? erro.message : "Não foi possível remover o texto das fotos.");
    }
  };

   if (itemQuery.isLoading || formatosQuery.isLoading || carregandoPermissoes) return <div className="space-y-4 p-4 sm:p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-[520px] w-full" /></div>;
  if (itemQuery.isError || !item) return <div className="p-4 sm:p-6"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Não foi possível abrir a foto</AlertTitle><AlertDescription className="space-y-3"><p>Confira sua conexão e tente novamente.</p><Button variant="outline" onClick={() => itemQuery.refetch()}>Tentar novamente</Button></AlertDescription></Alert></div>;
  if (!item.formato || !formatoSelecionado || !formatoCm || !molduraCalculo) return <div className="p-4 sm:p-6"><Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Escolha um formato</AlertTitle><AlertDescription className="space-y-3"><p>Defina o formato desta foto na Galeria antes de editar.</p><Button asChild variant="outline"><Link to="/foto-express/$id/fotos" params={{ id: trabalhoId }}>Voltar para Galeria</Link></Button></AlertDescription></Alert></div>;

  const lista = itensQuery.data ?? [];
  const indice = lista.findIndex((foto) => foto.id === itemId);
  const anterior = indice > 0 ? lista[indice - 1]?.id : undefined;
  const proximo = indice >= 0 && indice < lista.length - 1 ? lista[indice + 1]?.id : undefined;
  const crop = derivarCrop({ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }, molduraCalculo, edicao);
  const qualidade = calcularQualidadeFoto({ larguraPx: item.arquivo.largura_px, alturaPx: item.arquivo.altura_px, larguraCm: formatoCm.largura, alturaCm: formatoCm.altura, orientacao: "RETRATO", rotacao: edicao.rotacao, crop: { largura: crop.largura, altura: crop.altura } });
  const estado = estadoSalvar === "SALVANDO" ? "Salvando" : estadoSalvar === "ERRO" ? "Erro ao salvar" : estadoSalvar === "PENDENTE" ? "Alterações pendentes" : "Salvo";

  return <div className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader titulo="Editar foto" subtitulo={item.arquivo.nome_original} /><Button variant="outline" asChild><Link to="/foto-express/$id/fotos" params={{ id: trabalhoId }}><ArrowLeft className="mr-2 h-4 w-4" />Galeria</Link></Button></div>
    {!podeEditar && <Alert><CloudOff className="h-4 w-4" /><AlertTitle>Somente leitura</AlertTitle><AlertDescription>Você pode visualizar esta edição, mas não alterá-la.</AlertDescription></Alert>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4"><AreaEdicao url={imagemFalhou ? "" : item.originalUrl ?? ""} nome={item.arquivo.nome_original} original={{ largura: item.arquivo.largura_px, altura: item.arquivo.altura_px }} proporcao={formatoCm.largura / formatoCm.altura} areaFoto={areaFoto} corFundo={formatoSelecionado.cor_fundo} edicao={edicao} textos={textos} textoSelecionadoId={textoSelecionadoId} somenteLeitura={!podeEditar} onChange={alterarEdicao} onCommit={pedirSalvar} onImageError={() => setImagemFalhou(true)} onSelecionarTexto={setTextoSelecionadoId} onChangeTexto={substituirTexto} onCommitTexto={persistirTexto} />
        {imagemFalhou && tentativasImagem >= 2 && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Imagem indisponível</AlertTitle><AlertDescription><Button variant="outline" className="mt-2" onClick={async () => { setTentativasImagem(0); setImagemFalhou(false); await itemQuery.refetch(); }}>Tentar novamente</Button></AlertDescription></Alert>}
        <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={!anterior} onClick={() => navegarPara(anterior)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><span className="text-sm text-muted-foreground">{indice >= 0 ? `${indice + 1} de ${lista.length}` : ""}</span><Button variant="outline" disabled={!proximo} onClick={() => navegarPara(proximo)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
      </div>
      <Card className="xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto"><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Ajustes</CardTitle><Badge variant={estadoSalvar === "ERRO" || estadoTexto === "ERRO" ? "destructive" : "outline"}>{(mutation.isPending || estadoTexto === "SALVANDO") && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{estadoTexto === "ERRO" ? "Erro ao salvar texto" : estadoTexto === "SALVANDO" ? "Salvando texto" : estado}</Badge></CardHeader><CardContent><Tabs defaultValue="foto"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="foto">Foto</TabsTrigger><TabsTrigger value="textos">Textos</TabsTrigger></TabsList><TabsContent value="foto" className="space-y-6 pt-4"><ControlesEditor edicao={edicao} formatoId={formatoId} formatos={formatosQuery.data ?? []} orientacao={orientacao} somenteLeitura={!podeEditar} onChange={alterarEdicao} onFormato={alterarFormato} onOrientacao={alterarOrientacao} onCommit={pedirSalvar} onReset={redefinir} /><IndicadorQualidade resultado={qualidade} />{estadoSalvar === "ERRO" && <Button className="w-full" variant="destructive" onClick={executarSalvar}>Tentar salvar novamente</Button>}</TabsContent><TabsContent value="textos" className="pt-4"><ControlesTexto textos={textos} selecionado={textos.find((texto) => texto.id === textoSelecionadoId) ?? null} somenteLeitura={!podeEditar} salvando={estadoTexto === "SALVANDO"} quantidadeOutrasFotos={Math.max(0, lista.length - 1)} onAdicionar={adicionarTexto} onSelecionar={setTextoSelecionadoId} onChange={(texto) => { substituirTexto(texto); agendarTexto(texto); }} onCommit={persistirTexto} onDuplicar={duplicarCamada} onAplicarTodas={aplicarCamadaEmTodas} onRemoverTodas={removerCamadaDeTodas} onExcluir={excluirCamada} onMover={moverCamada} /></TabsContent></Tabs></CardContent></Card>
    </div>
  </div>;
}