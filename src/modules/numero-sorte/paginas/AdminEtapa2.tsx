import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Copy, Download, ImagePlus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataHoraBR } from "@/lib/format";

const BUCKET = "numero-sorte-divulgacao";
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export function linkPublicoCampanha(numero: number) {
  return `${window.location.origin}/numero-da-sorte/${numero}`;
}

/** Link público + QR Code da campanha (panfletos). */
export function LinkQrCampanha({ numero, nome, fechar }: { numero: number; nome: string; fechar: () => void }) {
  const [qr, setQr] = useState("");
  const link = linkPublicoCampanha(numero);
  useEffect(() => {
    void QRCode.toDataURL(link, { width: 640, margin: 2 }).then(setQr);
  }, [link]);
  return (
    <Dialog open onOpenChange={(v) => !v && fechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link público · {nome}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={link} />
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copiado."))}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        {qr && <img src={qr} alt="QR Code da campanha" className="mx-auto w-64" />}
        <Button disabled={!qr} onClick={() => {
          const a = document.createElement("a");
          a.href = qr;
          a.download = `qrcode-campanha-${numero}.png`;
          a.click();
        }}>
          <Download className="mr-2 h-4 w-4" /> Baixar QR Code
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function BotaoLinkCampanha({ numero, nome }: { numero: number; nome: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}><Link2 className="mr-1 h-4 w-4" /> Link e QR</Button>
      {aberto && <LinkQrCampanha numero={numero} nome={nome} fechar={() => setAberto(false)} />}
    </>
  );
}

/** Envia/troca/remove a imagem e grava o caminho na tabela indicada. */
export function GerenciarImagem({
  tabela, id, path, pasta, rotulo, aoMudar,
}: {
  tabela: "numero_sorte_campanhas" | "numero_sorte_premios";
  id: string; path: string | null; pasta: string; rotulo: string; aoMudar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campo = tabela === "numero_sorte_campanhas" ? "banner_path" : "imagem_path";

  useEffect(() => {
    if (!path) { setPrevia(null); return; }
    void supabase.storage.from(BUCKET).createSignedUrl(path, 600).then(({ data }) => setPrevia(data?.signedUrl ?? null));
  }, [path]);

  async function gravar(novo: string | null) {
    const { error } = await supabase.from(tabela).update({ [campo]: novo } as never).eq("id", id);
    if (error) throw error;
  }

  async function enviar(arq: File) {
    if (!TIPOS.includes(arq.type)) return toast.error("Use JPG, PNG ou WebP.");
    if (arq.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter até 5 MB.");
    setOcupado(true);
    try {
      const ext = arq.type === "image/png" ? "png" : arq.type === "image/webp" ? "webp" : "jpg";
      const novo = `${pasta}/${id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(novo, arq, { contentType: arq.type });
      if (error) throw error;
      await gravar(novo);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      toast.success(`${rotulo} atualizado.`);
      aoMudar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    if (!path || !confirm(`Remover ${rotulo.toLowerCase()}?`)) return;
    setOcupado(true);
    try {
      await gravar(null);
      await supabase.storage.from(BUCKET).remove([path]);
      aoMudar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{rotulo}</p>
      {previa && <img src={previa} alt={rotulo} className="max-h-40 rounded-md border object-contain" />}
      <input ref={ref} type="file" accept={TIPOS.join(",")} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => ref.current?.click()}>
          <ImagePlus className="mr-1 h-4 w-4" /> {path ? "Trocar" : "Enviar"}
        </Button>
        {path && (
          <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => void remover()}>
            <Trash2 className="mr-1 h-4 w-4" /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}

export function ImagemDialog(props: Parameters<typeof GerenciarImagem>[0] & { fechar: () => void }) {
  const qc = useQueryClient();
  const [path, setPath] = useState(props.path);
  return (
    <Dialog open onOpenChange={(v) => !v && props.fechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{props.rotulo}</DialogTitle></DialogHeader>
        <GerenciarImagem {...props} path={path} aoMudar={async () => {
          const { data } = await supabase.from(props.tabela).select("*").eq("id", props.id).maybeSingle();
          const r = data as { banner_path?: string | null; imagem_path?: string | null } | null;
          setPath(r?.banner_path ?? r?.imagem_path ?? null);
          void qc.invalidateQueries({ queryKey: ["numero-sorte"] });
          props.aoMudar();
        }} />
      </DialogContent>
    </Dialog>
  );
}

const ROTULO_RESULTADO: Record<string, string> = {
  nao_premiado: "Não premiado", premiado: "Premiado", repetida: "Repetida",
  bloqueada: "Bloqueada (já ganhou)", invalida: "Outra campanha / inválido", limite: "Limite atingido",
};

function mascararTelefone(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `****-${d.slice(-4)}` : "-";
}

export function Participacoes({ campanhas }: { campanhas: { id: string; numero: number; nome: string }[] }) {
  const [campanha, setCampanha] = useState("todas");
  const [resultado, setResultado] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["numero-sorte", "consultas", campanha, resultado, de, ate],
    queryFn: async () => {
      let q = supabase
        .from("numero_sorte_consultas")
        .select("id, codigo, resultado, criado_em, campanha_id, clientes(nome, telefone)")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (campanha !== "todas") q = q.eq("campanha_id", campanha);
      if (resultado !== "todos") q = q.eq("resultado", resultado);
      if (de) q = q.gte("criado_em", new Date(`${de}T00:00:00`).toISOString());
      if (ate) q = q.lte("criado_em", new Date(`${ate}T23:59:59`).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const nomeCampanha = (id: string) => {
    const c = campanhas.find((x) => x.id === id);
    return c ? `#${c.numero} · ${c.nome}` : "-";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={campanha} onValueChange={setCampanha}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as campanhas</SelectItem>
            {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>#{c.numero} · {c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resultado} onValueChange={setResultado}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os resultados</SelectItem>
            {Object.entries(ROTULO_RESULTADO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input type="date" className="w-40" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">Sem permissão para ver as participações.</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && !error && data.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma consulta registrada.</CardContent></Card>
      )}
      {data.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">Data</th><th className="p-2">Campanha</th><th className="p-2">Cliente</th>
              <th className="p-2">Telefone</th><th className="p-2">Número</th><th className="p-2">Resultado</th>
            </tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{dataHoraBR(r.criado_em)}</td>
                  <td className="p-2">{nomeCampanha(r.campanha_id)}</td>
                  <td className="p-2">{r.clientes?.nome ?? "-"}</td>
                  <td className="p-2 whitespace-nowrap">{mascararTelefone(r.clientes?.telefone ?? null)}</td>
                  <td className="p-2 font-mono">{r.codigo}</td>
                  <td className="p-2"><Badge variant={r.resultado === "premiado" ? "default" : "outline"}>{ROTULO_RESULTADO[r.resultado] ?? r.resultado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
