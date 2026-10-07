import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useConfiguracao } from "@/hooks/useDados";
import { supabase } from "@/integrations/supabase/client";
import { listarImpressoras, imprimirComprovante80mm } from "@/lib/impressora";
import { htmlComprovante, pagamentoComprovante, valorComprovante, type PagamentoComprovante } from "@/lib/whatsapp-comprovante";
import { prepararClienteImpressao, salvarNomeClienteImpressao } from "@/lib/whatsapp-cliente-impressao.functions";
import { normalizarNomePessoa } from "@/lib/nome-pessoa";
import { formatarTelefone } from "@/lib/whatsapp-comum";

export function ImprimirClienteDialog({ conversaId }: { conversaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [pagamento, setPagamento] = useState<PagamentoComprovante>("nao_pago");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [impressora, setImpressora] = useState("");
  const [impressoras, setImpressoras] = useState<string[]>([]);
  const [conectando, setConectando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { user } = useAuth();
  const { data: config } = useConfiguracao();
  const queryClient = useQueryClient();
  const preparar = useServerFn(prepararClienteImpressao);
  const salvarNome = useServerFn(salvarNomeClienteImpressao);
  const cadastro = useQuery({
    queryKey: ["whatsapp-cliente-impressao", conversaId], enabled: aberto,
    queryFn: () => preparar({ data: { conversaId } }),
  });
  useEffect(() => {
    if (cadastro.data && aberto) setNome(cadastro.data.nome);
  }, [cadastro.data, aberto]);

  async function conectar() {
    setConectando(true);
    try {
      const lista = await listarImpressoras();
      setImpressoras(lista);
      if (!lista.length) toast.error("Nenhuma impressora encontrada. Inicie o QZ Tray no computador.");
    } catch { toast.error("Não foi possível conectar ao QZ Tray."); }
    finally { setConectando(false); }
  }

  function abrir(estado: boolean) {
    if (ocupado) return;
    setAberto(estado);
    if (!estado) return;
    setNome(""); setValor(""); setDescricao(""); setPagamento("nao_pago");
    setData(new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    let padrao = "";
    try { padrao = localStorage.getItem(`whatsapp:termica80:${user?.id ?? ""}`) ?? ""; } catch { /* optional preference */ }
    setImpressora(padrao || config?.impressora_padrao_nome || "");
    void conectar();
  }

  const dados = { nome, telefone: formatarTelefone(cadastro.data?.telefone ?? ""), data, pagamento, valor: valorComprovante(valor), descricao, usuario: cadastro.data?.usuario ?? "" };
  const destaque = pagamentoComprovante({ ...dados, valor: Number.isFinite(dados.valor) ? dados.valor : 0 });
  const mudouNome = normalizarNomePessoa(nome) !== normalizarNomePessoa(cadastro.data?.nome);

  async function executar(imprimir: boolean) {
    if (!normalizarNomePessoa(nome)) return toast.error("Informe o nome do cliente.");
    if (imprimir && (!Number.isFinite(dados.valor) || dados.valor < 0)) return toast.error("Informe um valor válido, por exemplo 18,50.");
    if (imprimir && pagamento !== "total" && dados.valor <= 0) return toast.error("Informe o valor que falta pagar.");
    if (imprimir && !impressora) return toast.error("Selecione a impressora térmica.");
    setOcupado(true);
    try {
      let nomeFinal = cadastro.data?.nome ?? nome;
      if (mudouNome) {
        const resultado = await salvarNome({ data: { conversaId, nome } });
        nomeFinal = resultado.nome;
        setNome(nomeFinal);
        await Promise.all([queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] }), queryClient.invalidateQueries({ queryKey: ["clientes"] }), queryClient.invalidateQueries({ queryKey: ["whatsapp-cliente-impressao", conversaId] })]);
        toast.success("Nome salvo no cadastro do cliente.");
      }
      if (imprimir) {
        await imprimirComprovante80mm(htmlComprovante({ ...dados, nome: nomeFinal }), impressora);
        toast.success("Impressão enviada.");
      }
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : "Não foi possível concluir."); }
    finally { setOcupado(false); }
  }

  const opcoes = Array.from(new Set([impressora, ...impressoras].filter(Boolean)));
  return <>
    <Button variant="outline" size="sm" onClick={() => abrir(true)} title="Imprimir dados do cliente"><Printer className="h-4 w-4" /><span>Imprimir cliente</span></Button>
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Imprimir dados do cliente</DialogTitle></DialogHeader>
        {cadastro.isPending ? <p className="text-muted-foreground">Carregando cliente…</p> : cadastro.error ? <p role="alert" className="text-destructive">{cadastro.error.message}</p> : <div className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="ticket-nome">Nome</Label><div className="flex gap-2"><Input id="ticket-nome" value={nome} maxLength={200} disabled={ocupado} onChange={e => setNome(e.target.value)} /><Button size="icon" variant="outline" aria-label="Salvar nome no cadastro" title="Salvar nome no cadastro" disabled={ocupado || !mudouNome} onClick={() => void executar(false)}><Save className="h-4 w-4" /></Button></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Telefone</Label><p className="break-words text-sm">{dados.telefone}</p></div><div><Label>Data atual</Label><p className="text-sm">{data}</p></div></div>
          <div className="grid gap-1.5"><Label>Pagamento</Label><Select value={pagamento} disabled={ocupado} onValueChange={v => setPagamento(v as PagamentoComprovante)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="total">Total</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="nao_pago">Não pago</SelectItem></SelectContent></Select></div>
          <div className="grid gap-1.5"><Label htmlFor="ticket-valor">{pagamento === "total" ? "Valor pago (R$)" : "Valor que falta pagar (R$)"}</Label><Input id="ticket-valor" inputMode="decimal" value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} placeholder="0,00" /></div>
          <div className="border-l-4 border-primary bg-muted p-3 font-bold" aria-live="polite"><p>{destaque.titulo}</p><p>{destaque.valor}</p></div>
          <div className="grid gap-1.5"><Label htmlFor="ticket-descricao">Descrição</Label><Textarea id="ticket-descricao" value={descricao} maxLength={4000} disabled={ocupado} onChange={e => setDescricao(e.target.value)} /></div>
          <div><Label>Usuário</Label><p className="text-sm">{dados.usuario}</p></div>
          <div className="grid gap-1.5"><Label>Impressora térmica — 80 mm</Label><div className="flex gap-2"><Select value={impressora} disabled={ocupado} onValueChange={setImpressora}><SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Selecionar impressora" /></SelectTrigger><SelectContent>{opcoes.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="outline" aria-label="Conectar QZ Tray" title="Conectar QZ Tray" onClick={() => void conectar()} disabled={conectando || ocupado}><RefreshCw className={conectando ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
          <Button variant="outline" size="sm" disabled={!impressora || ocupado} onClick={() => { try { localStorage.setItem(`whatsapp:termica80:${user?.id ?? ""}`, impressora); toast.success("Impressora padrão salva neste computador."); } catch { toast.error("Não foi possível salvar a impressora padrão."); } }}>Definir como padrão neste computador</Button></div>
          <Button disabled={ocupado || !dados.usuario} onClick={() => void executar(true)}><Printer className="h-4 w-4" />{ocupado ? "Aguarde…" : mudouNome ? "Salvar nome e imprimir" : "Imprimir"}</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}