import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, Circle, ImageUp, Link2, LockOpen, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { limparLogoPortalFotos, logoPortalFotosAtual, salvarLogoPortalFotos } from "@/lib/foto-express-logo.functions";
import { excluirAlbumFotoExpress, reabrirEdicaoPortalFotoExpress } from "@/lib/foto-express.functions";
import { brl } from "@/lib/format";
import { useTrabalhos } from "../hooks/useFotoExpress";
import { NovoTrabalhoPagina } from "./NovoTrabalhoPagina";
import { urlPublicaFotoExpress } from "../services/url-publica";

const TIPOS_LOGO_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

const STATUS: Record<string, { nome: string; cor: string; ponto: string }> = {
  RASCUNHO: { nome: "Rascunho", cor: "border-muted-foreground/30 bg-muted text-muted-foreground", ponto: "fill-muted-foreground text-muted-foreground" },
  PORTAL: { nome: "Portal", cor: "border-chart-3/35 bg-chart-3/15 text-foreground", ponto: "fill-chart-3 text-chart-3" },
  EM_EDICAO: { nome: "Em edição", cor: "border-chart-1/30 bg-chart-1/10 text-chart-1", ponto: "fill-chart-1 text-chart-1" },
  RECEBIDO: { nome: "Recebido", cor: "border-primary/35 bg-primary/10 text-primary", ponto: "fill-primary text-primary" },
  PRONTO_IMPRESSAO: { nome: "Pronto para impressão", cor: "border-chart-4/35 bg-chart-4/15 text-foreground", ponto: "fill-chart-4 text-chart-4" },
  IMPRESSO: { nome: "Impresso", cor: "border-chart-2/35 bg-chart-2/15 text-foreground", ponto: "fill-chart-2 text-chart-2" },
  FINALIZADO: { nome: "Finalizado", cor: "border-success/35 bg-success/15 text-success", ponto: "fill-success text-success" },
};
const ORDEM_STATUS = ["RASCUNHO", "PORTAL", "EM_EDICAO", "RECEBIDO", "PRONTO_IMPRESSAO", "IMPRESSO", "FINALIZADO"] as const;
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));

export function TrabalhosPagina() {
  const { data = [], isLoading, error } = useTrabalhos();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<(typeof ORDEM_STATUS)[number]>("RASCUNHO");
  const [novoAlbumAberto, setNovoAlbumAberto] = useState(false);
  const reabrirEdicao = useServerFn(reabrirEdicaoPortalFotoExpress);
  const excluirAlbum = useServerFn(excluirAlbumFotoExpress);
  const reabrir = useMutation({
    mutationFn: (trabalhoId: string) => reabrirEdicao({ data: { trabalhoId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["foto-express", "trabalhos"] });
      toast.success("Edição reaberta para o cliente.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
  const finalizar = useMutation({
    mutationFn: async (id: string) => {
      const { data: atualizado, error: erro } = await supabase.from("foto_express_trabalhos").update({ status: "FINALIZADO" }).eq("id", id).eq("status", "IMPRESSO").select("id").maybeSingle();
      if (erro) throw erro;
      if (!atualizado) throw new Error("Este álbum não está mais disponível para finalização.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["foto-express", "trabalhos"] });
      toast.success("Álbum finalizado.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
  const excluir = useMutation({
    mutationFn: (trabalhoId: string) => excluirAlbum({ data: { trabalhoId } }),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ["foto-express"] });
      if (resultado.limpezasPendentes > 0) toast.warning("Álbum excluído. Alguns arquivos aguardam limpeza automática.");
      else toast.success("Álbum e fotos excluídos.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    return data.filter((trabalho) => trabalho.status === status && (!termo || String(trabalho.numero).includes(termo) || trabalho.cliente_nome.includes(termo) || trabalho.cliente_telefone.includes(termo)));
  }, [busca, data, status]);
  const quantidades = useMemo(() => Object.fromEntries(ORDEM_STATUS.map((chave) => [chave, data.filter((trabalho) => trabalho.status === chave).length])), [data]);

  return <>
    <PageHeader titulo="FOTO EXPRESS" subtitulo="Álbuns de fotos para impressão" />
    <Card className="mb-4"><CardContent className="flex flex-col gap-4 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold">Link público do portal</p><p className="truncate text-xs text-muted-foreground">{urlPublicaFotoExpress()}</p></div><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(urlPublicaFotoExpress()).then(() => toast.success("Link do portal copiado."))}><Link2 className="mr-2 h-4 w-4" />Copiar link</Button></div><LogoDoPortal /></CardContent></Card>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 sm:max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por número, nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      <Button type="button" onClick={() => setNovoAlbumAberto(true)}><Plus className="mr-2 h-4 w-4" />Novo álbum</Button>
    </div>
    <Tabs value={status} onValueChange={(valor) => setStatus(valor as (typeof ORDEM_STATUS)[number])} className="mb-4 min-w-0"><div className="overflow-x-auto pb-1"><TabsList className="h-auto w-max min-w-full justify-start">{ORDEM_STATUS.map((chave) => <TabsTrigger key={chave} value={chave} className="gap-2 py-2"><Circle className={`h-2.5 w-2.5 ${STATUS[chave]?.ponto ?? ""}`} aria-hidden="true" />{STATUS[chave]?.nome ?? chave}<Badge variant="secondary" className="min-w-6 justify-center px-1.5">{quantidades[chave] ?? 0}</Badge></TabsTrigger>)}</TabsList></div></Tabs>
    {isLoading && <p className="text-sm text-muted-foreground">Carregando álbuns...</p>}
    {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
    {!isLoading && filtrados.length === 0 && <Card><CardContent className="flex flex-col items-center gap-3 p-12 text-center"><Camera className="h-10 w-10 text-muted-foreground" /><p className="font-semibold">Nenhum álbum encontrado</p><p className="text-sm text-muted-foreground">Crie um novo álbum para enviar e preparar as fotos.</p></CardContent></Card>}
    <div className="grid gap-3">{filtrados.map((trabalho) => { const statusVisual = STATUS[trabalho.status]; const podeReabrir = trabalho.origem_portal && trabalho.portal_enviado_em && (trabalho.status === "RECEBIDO" || trabalho.status === "PRONTO_IMPRESSAO"); return <Card key={trabalho.id}><CardContent className="grid gap-4 p-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-muted">{trabalho.capaUrl ? <img src={trabalho.capaUrl} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" />}</div><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">#{String(trabalho.numero).padStart(6, "0")}</span><Badge variant="outline" className={statusVisual?.cor}>{statusVisual?.nome ?? trabalho.status}</Badge></div><p className="truncate font-medium">{trabalho.cliente_nome || "CLIENTE NÃO INFORMADO"}</p><p className="text-xs text-muted-foreground">{trabalho.cliente_telefone || "Sem telefone"} · {trabalho.foto_express_itens[0]?.count ?? 0} foto(s)</p><p className="text-xs text-muted-foreground">Criado em {dataHora(trabalho.criado_em)} · alterado em {dataHora(trabalho.atualizado_em)}</p>{trabalho.valor_estimado !== null && <p className="pt-1 text-sm font-semibold text-foreground">Valor calculado: {brl(Number(trabalho.valor_estimado))}</p>}</div><div className="flex shrink-0 flex-col gap-2 sm:flex-row">{podeReabrir && <ConfirmarAcao titulo="Reabrir edição para o cliente?" descricao="O cliente poderá alterar novamente as fotos deste álbum. Se houver uma montagem preparada, ela precisará ser revisada novamente." rotuloConfirmar="Reabrir edição" onConfirmar={async () => { await reabrir.mutateAsync(trabalho.id); }}><Button type="button" variant="outline" disabled={reabrir.isPending}><LockOpen className="mr-2 h-4 w-4" />Reabrir edição</Button></ConfirmarAcao>}{trabalho.status === "IMPRESSO" && <Button type="button" variant="outline" disabled={finalizar.isPending} onClick={() => finalizar.mutate(trabalho.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Finalizar</Button>}<Button asChild variant="outline"><Link to="/foto-express/$id/fotos" params={{ id: trabalho.id }}>Abrir álbum</Link></Button><ConfirmarExclusao titulo={`Excluir o álbum #${String(trabalho.numero).padStart(6, "0")}?`} descricao="Todas as fotos, edições, montagens e arquivos de impressão deste álbum serão excluídos. Esta ação não poderá ser desfeita." rotuloConfirmar="Excluir álbum" onConfirmar={async () => { await excluir.mutateAsync(trabalho.id); }}><Button type="button" variant="destructive" size="icon" disabled={excluir.isPending} aria-label={`Excluir álbum ${trabalho.numero}`} title="Excluir álbum"><Trash2 className="h-4 w-4" /></Button></ConfirmarExclusao></div></CardContent></Card>; })}</div>
    <Dialog open={novoAlbumAberto} onOpenChange={setNovoAlbumAberto}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Novo álbum</DialogTitle><DialogDescription>Comece pelos dados do atendimento.</DialogDescription></DialogHeader><NovoTrabalhoPagina emModal onCancelar={() => setNovoAlbumAberto(false)} /></DialogContent></Dialog>
  </>;
}

function LogoDoPortal() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const buscar = useServerFn(logoPortalFotosAtual);
  const salvar = useServerFn(salvarLogoPortalFotos);
  const limpar = useServerFn(limparLogoPortalFotos);
  const logo = useQuery({ queryKey: ["foto-express", "logo-portal-admin"], queryFn: () => buscar() });
  function invalidar() { void queryClient.invalidateQueries({ queryKey: ["foto-express", "logo-portal-admin"] }); void queryClient.invalidateQueries({ queryKey: ["foto-express", "logo-portal"] }); }
  const enviar = useMutation({ mutationFn: async (arquivo: File) => { if (!TIPOS_LOGO_ACEITOS.includes(arquivo.type)) throw new Error("Escolha uma imagem PNG, JPG ou WEBP."); if (arquivo.size > 2 * 1024 * 1024) throw new Error("A imagem precisa ter até 2 MB."); const bytes = new Uint8Array(await arquivo.arrayBuffer()); let bruto = ""; for (const byte of bytes) bruto += String.fromCharCode(byte); return salvar({ data: { base64: btoa(bruto), tipo: arquivo.type } }); }, onSuccess: () => { toast.success("Logo do portal atualizada."); invalidar(); }, onError: (erro: Error) => toast.error(erro.message) });
  const restaurar = useMutation({ mutationFn: () => limpar(), onSuccess: () => { toast.success("Logo padrão restaurada."); invalidar(); }, onError: (erro: Error) => toast.error(erro.message) });
  const ocupado = enviar.isPending || restaurar.isPending;
  return <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3">{logo.data?.url ? <img src={logo.data.url} alt="Logo do Portal de Fotos" className="h-12 w-12 shrink-0 rounded-full border border-border bg-background object-contain" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Camera className="h-6 w-6" /></span>}<div className="min-w-0"><p className="text-sm font-semibold">Logo do portal</p><p className="text-xs text-muted-foreground">{logo.isLoading ? "Carregando..." : logo.data?.personalizada ? "Imagem enviada pela loja." : "Usando a logo padrão do FOTO EXPRESS."}</p></div></div><div className="flex shrink-0 flex-wrap gap-2"><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(evento) => { const arquivo = evento.target.files?.[0]; evento.target.value = ""; if (arquivo) enviar.mutate(arquivo); }} /><Button variant="outline" size="sm" disabled={ocupado} onClick={() => inputRef.current?.click()}><ImageUp className="mr-2 h-4 w-4" />{logo.data?.personalizada ? "Trocar logo" : "Adicionar logo"}</Button>{logo.data?.personalizada && <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => restaurar.mutate()}><RotateCcw className="mr-2 h-4 w-4" />Voltar à logo padrão</Button>}</div></div>;
}
