import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, CheckCircle2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { dataBR, dataHoraBR } from "@/lib/format";
import {
  acaoRetirada,
  codigoRetiradaValido,
  extrairTokenQr,
  justificativaValida,
  rotuloSituacao,
  situacaoEfetiva,
  type SituacaoPremiacao,
} from "@/modules/numero-sorte/lib/retirada";

type Detalhe = {
  premiacao_id: string; campanha: string; campanha_numero: number; cliente: string; cpf: string; telefone: string;
  numero: string; premio: string; descricao: string | null; imagem_path: string | null; condicoes: string | null;
  local: string | null; reservado_em: string; prazo_em: string; situacao: SituacaoPremiacao;
  comprovante_ativo: boolean;
  entrega: { em: string; por: string; excecao: boolean; justificativa: string | null } | null;
};

const ERROS: Record<string, string> = {
  SEM_PERMISSAO: "Você não tem permissão para esta ação.",
  SEM_PERMISSAO_EXCECAO: "Somente usuários autorizados podem liberar prêmios vencidos.",
  LIMITE: "Muitas tentativas inválidas. Aguarde alguns minutos.",
  VENCIDO: "O prazo de retirada terminou.",
  CANCELADO: "Esta premiação foi cancelada.",
  JUSTIFICATIVA: "Escreva uma justificativa com pelo menos 10 caracteres.",
  SEM_COMPROVANTE: "Esta premiação não tem comprovante ativo.",
  JA_ENTREGUE: "Este prêmio já foi entregue.",
};
function erro(e: unknown) {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const k = Object.keys(ERROS).find((c) => m.includes(c));
  return k ? ERROS[k]! : "Não foi possível concluir. Tente novamente.";
}

const corSit: Record<SituacaoPremiacao, "default" | "secondary" | "destructive" | "outline"> = {
  reservado: "default", entregue: "secondary", vencido: "destructive", cancelado: "outline",
};

function LeitorQr({ aoLer }: { aoLer: (texto: string) => void }) {
  const [ativo, setAtivo] = useState(false);
  const leitor = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const parar = async () => {
    try { await leitor.current?.stop(); leitor.current?.clear(); } catch { /* já parado */ }
    leitor.current = null; setAtivo(false);
  };
  useEffect(() => () => { void parar(); }, []);
  async function iniciar() {
    setAtivo(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const q = new Html5Qrcode("ns-leitor-qr");
      leitor.current = q;
      await q.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (t) => { void parar(); aoLer(t); }, () => {});
    } catch {
      toast.error("Não foi possível abrir a câmera. Digite o código.");
      await parar();
    }
  }
  return (
    <div className="space-y-2">
      <div id="ns-leitor-qr" className={ativo ? "mx-auto max-w-sm overflow-hidden rounded-lg" : "hidden"} />
      <Button variant="outline" className="w-full" onClick={() => void (ativo ? parar() : iniciar())}>
        {ativo ? <><CameraOff className="h-4 w-4" /> Parar câmera</> : <><Camera className="h-4 w-4" /> Ler QR Code</>}
      </Button>
    </div>
  );
}

function ImagemPremio({ path }: { path: string | null }) {
  const { data } = useQuery({
    queryKey: ["ns-img", path], enabled: !!path,
    queryFn: async () => (await supabase.storage.from("numero-sorte-divulgacao").createSignedUrl(path!, 600)).data?.signedUrl ?? null,
  });
  return data ? <img src={data} alt="" className="max-h-40 rounded-lg object-contain" /> : null;
}

function Resultado({ d, aoMudar }: { d: Detalhe; aoMudar: (d: Detalhe) => void }) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const podeConfirmar = pode("numero_sorte.retiradas.confirmar");
  const podeExcecao = pode("numero_sorte.retiradas.excecao");
  const sit = situacaoEfetiva(d.situacao, d.prazo_em);
  const acao = acaoRetirada(d.situacao, d.prazo_em, podeExcecao);
  const [abrir, setAbrir] = useState(false);
  const [revogar, setRevogar] = useState(false);
  const [conferiu, setConferiu] = useState(false);
  const [just, setJust] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  async function confirmar() {
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("numero_sorte_confirmar_entrega", {
        _premiacao_id: d.premiacao_id, _excecao: acao === "excecao", _justificativa: just,
      });
      if (error) throw error;
      const r = data as { resultado: string; dados: Detalhe };
      if (r.resultado === "ja_entregue") toast.warning("Este prêmio já foi entregue.");
      else setSucesso(true);
      aoMudar(r.dados);
      setAbrir(false);
    } catch (e) { toast.error(erro(e)); } finally { setEnviando(false); }
  }
  async function executarRevogacao() {
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("numero_sorte_revogar_comprovante", { _premiacao_id: d.premiacao_id, _motivo: just });
      if (error) throw error;
      toast.success("Comprovante revogado. O cliente receberá um novo ao abrir a página da campanha.");
      setRevogar(false); setJust("");
    } catch (e) { toast.error(erro(e)); } finally { setEnviando(false); }
  }

  return (
    <Card><CardContent className="space-y-3 pt-6">
      {sucesso && d.entrega && (
        <div className="rounded-lg border border-primary bg-primary/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" /> Prêmio entregue com sucesso!</p>
          <p>{dataHoraBR(d.entrega.em)} · {d.entrega.por} · {d.premio} · {d.cliente}</p>
        </div>
      )}
      {!sucesso && sit === "entregue" && (
        <p className="rounded-lg bg-muted p-3 font-semibold">Este prêmio já foi entregue.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold">{d.premio}</p>
        <Badge variant={corSit[sit]}>{rotuloSituacao[sit]}</Badge>
      </div>
      <ImagemPremio path={d.imagem_path} />
      <div className="grid gap-1 text-sm sm:grid-cols-2">
        <p><b>Campanha:</b> {d.campanha_numero} · {d.campanha}</p>
        <p><b>Cliente:</b> {d.cliente}</p>
        <p><b>CPF:</b> {d.cpf}</p>
        <p><b>Telefone:</b> {d.telefone}</p>
        <p><b>Número da sorte:</b> {d.numero}</p>
        <p><b>Premiado em:</b> {dataHoraBR(d.reservado_em)}</p>
        <p><b>Retirar até:</b> {dataHoraBR(d.prazo_em)}</p>
        {d.local && <p><b>Local:</b> {d.local}</p>}
      </div>
      {d.descricao && <p className="whitespace-pre-line text-sm text-muted-foreground">{d.descricao}</p>}
      {d.condicoes && <p className="whitespace-pre-line text-sm"><b>Condições:</b> {d.condicoes}</p>}
      {d.entrega && (
        <p className="text-sm text-muted-foreground">
          Entregue em {dataHoraBR(d.entrega.em)} por {d.entrega.por}
          {d.entrega.excecao && ` · exceção de prazo: ${d.entrega.justificativa}`}
        </p>
      )}
      {sit === "vencido" && acao === "nenhuma" && (
        <p className="text-sm text-destructive">Prazo encerrado em {dataHoraBR(d.prazo_em)}. A retirada não é mais permitida.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {podeConfirmar && acao !== "nenhuma" && (
          <Button className="h-12 flex-1" onClick={() => { setConferiu(false); setJust(""); setAbrir(true); }}>
            {acao === "excecao" ? "LIBERAR COM EXCEÇÃO DE PRAZO" : "CONFIRMAR ENTREGA DO PRÊMIO"}
          </Button>
        )}
        {podeExcecao && sit !== "entregue" && sit !== "cancelado" && (
          <Button variant="outline" onClick={() => { setJust(""); setRevogar(true); }}>Revogar comprovante</Button>
        )}
      </div>

      <Dialog open={abrir} onOpenChange={setAbrir}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar entrega</DialogTitle></DialogHeader>
          <div className="space-y-1 text-sm">
            <p><b>Cliente:</b> {d.cliente}</p>
            <p><b>Campanha:</b> {d.campanha}</p>
            <p><b>Prêmio:</b> {d.premio}</p>
            <p><b>Número:</b> {d.numero}</p>
            {d.condicoes && <p><b>Condições:</b> {d.condicoes}</p>}
          </div>
          {acao === "excecao" && (
            <div className="space-y-1">
              <Label>Justificativa da exceção de prazo</Label>
              <Textarea value={just} onChange={(e) => setJust(e.target.value)} />
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={conferiu} onCheckedChange={(v) => setConferiu(v === true)} />
            Verifiquei as condições exigidas para a retirada.
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbrir(false)}>Cancelar</Button>
            <Button disabled={!conferiu || enviando || (acao === "excecao" && !justificativaValida(just))} onClick={() => void confirmar()}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revogar} onOpenChange={setRevogar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revogar comprovante</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O QR Code e o código atuais deixam de valer. Um novo comprovante fica disponível para o cliente.</p>
          <Label>Justificativa</Label>
          <Textarea value={just} onChange={(e) => setJust(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevogar(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={enviando || !justificativaValida(just)} onClick={() => void executarRevogacao()}>Revogar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

function Historico({ campanhas, abrir }: { campanhas: { id: string; numero: number; nome: string }[]; abrir: (d: Detalhe) => void }) {
  const [campanha, setCampanha] = useState("todas");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["ns-retiradas", campanha],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("numero_sorte_historico_retiradas", {
        _campanha_id: campanha === "todas" ? (null as unknown as string) : campanha,
      });
      if (error) throw error;
      return data as unknown as Detalhe[];
    },
  });
  const lista = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return data.filter((d) => {
      if (situacao !== "todas" && situacaoEfetiva(d.situacao, d.prazo_em) !== situacao) return false;
      if (b && !`${d.cliente} ${d.numero} ${d.premio}`.toUpperCase().includes(b)) return false;
      const dia = d.reservado_em.slice(0, 10);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      return true;
    });
  }, [data, busca, situacao, de, ate]);

  return (
    <Card><CardContent className="space-y-3 pt-6">
      <p className="font-semibold">Histórico de retiradas</p>
      <div className="grid gap-2 sm:grid-cols-5">
        <Select value={campanha} onValueChange={setCampanha}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as campanhas</SelectItem>
            {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero} · {c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Cliente, número ou prêmio" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            {(Object.keys(rotuloSituacao) as SituacaoPremiacao[]).map((s) => <SelectItem key={s} value={s}>{rotuloSituacao[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : error ? (
        <p className="text-sm text-muted-foreground">{erro(error)}</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma premiação encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr>
              <th className="p-2">Campanha</th><th className="p-2">Cliente</th><th className="p-2">Prêmio</th><th className="p-2">Número</th>
              <th className="p-2">Premiado</th><th className="p-2">Prazo</th><th className="p-2">Situação</th><th className="p-2">Entrega</th>
            </tr></thead>
            <tbody>
              {lista.map((d) => {
                const s = situacaoEfetiva(d.situacao, d.prazo_em);
                return (
                  <tr key={d.premiacao_id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => abrir(d)}>
                    <td className="p-2">{d.campanha_numero}</td><td className="p-2">{d.cliente}</td><td className="p-2">{d.premio}</td>
                    <td className="p-2 font-mono">{d.numero}</td><td className="p-2">{dataBR(d.reservado_em)}</td><td className="p-2">{dataBR(d.prazo_em)}</td>
                    <td className="p-2"><Badge variant={corSit[s]}>{rotuloSituacao[s]}</Badge></td>
                    <td className="p-2">{d.entrega ? `${dataHoraBR(d.entrega.em)} · ${d.entrega.por}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CardContent></Card>
  );
}

export function RetiradaPainel({ campanhas, tokenInicial }: { campanhas: { id: string; numero: number; nome: string }[]; tokenInicial?: string }) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [atual, setAtual] = useState<Detalhe | null>(null);
  const podeValidar = pode("numero_sorte.retiradas.validar");
  const podeHistorico = podeValidar || pode("numero_sorte.retiradas.visualizar");

  async function validar(token: string | null, cod: string | null) {
    setMsg(null); setAtual(null); setBuscando(true);
    try {
      const { data, error } = await supabase.rpc("numero_sorte_validar_retirada", { _token: token ?? "", _codigo: cod ?? "" });
      if (error) throw error;
      const r = data as { resultado: string; dados?: Detalhe };
      if (r.resultado === "ok" && r.dados) setAtual(r.dados);
      else if (r.resultado === "revogado") setMsg("Este comprovante foi revogado e não vale mais.");
      else setMsg("Comprovante não encontrado.");
    } catch (e) { setMsg(erro(e)); } finally { setBuscando(false); }
  }
  useEffect(() => { if (tokenInicial && podeValidar) void validar(tokenInicial, null); }, [tokenInicial, podeValidar]);

  function lido(texto: string) {
    const t = extrairTokenQr(texto);
    if (t) void validar(t, null);
    else if (codigoRetiradaValido(texto)) void validar(null, texto);
    else setMsg("Este QR Code não é um comprovante do Nº da Sorte.");
  }
  function consultarCodigo() {
    if (!codigoRetiradaValido(codigo)) return setMsg("Código inválido. Ele tem 8 letras e números, ex.: K7M9-P2Q4.");
    void validar(null, codigo);
  }

  return (
    <div className="space-y-4">
      {podeValidar ? (
        <Card><CardContent className="space-y-3 pt-6">
          <p className="font-semibold">Validar comprovante</p>
          <LeitorQr aoLer={lido} />
          <div className="flex gap-2">
            <Input placeholder="Código de retirada (ex.: K7M9-P2Q4)" className="font-mono uppercase" value={codigo} maxLength={12}
              onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && consultarCodigo()} />
            <Button disabled={buscando} onClick={consultarCodigo}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
            </Button>
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Você não tem permissão para validar retiradas.</CardContent></Card>
      )}
      {atual && <Resultado key={atual.premiacao_id} d={atual} aoMudar={(d) => { setAtual(d); void qc.invalidateQueries({ queryKey: ["ns-retiradas"] }); }} />}
      {podeHistorico && <Historico campanhas={campanhas} abrir={setAtual} />}
    </div>
  );
}
