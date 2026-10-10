import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, RefreshCw, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useConfiguracao } from "@/hooks/useDados";
import { listarImpressoras, imprimirComprovante80mm } from "@/lib/impressora";
import { imprimirComprovanteNavegador } from "@/lib/whatsapp-comprovante-navegador";
import { htmlComprovante, pagamentoComprovante, saldoComprovante, valorComprovante, type PagamentoComprovante } from "@/lib/whatsapp-comprovante";
import { prepararClienteImpressao, salvarNomeClienteImpressao } from "@/lib/whatsapp-cliente-impressao.functions";
import { normalizarNomePessoa } from "@/lib/nome-pessoa";
import { formatarTelefone } from "@/lib/whatsapp-comum";

export function ImprimirClienteDialog({ conversaId }: { conversaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [pagamento, setPagamento] = useState<PagamentoComprovante | "">("");
  const [valor, setValor] = useState("");
  const [valorServico, setValorServico] = useState("");
  const [valorPago, setValorPago] = useState("");
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
    setNome(""); setValor(""); setValorServico(""); setValorPago(""); setDescricao(""); setPagamento("");
    setData(new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    let padrao = "";
    try { padrao = localStorage.getItem(`whatsapp:termica80:${user?.id ?? ""}`) ?? ""; } catch { /* optional preference */ }
    setImpressora(padrao || config?.impressora_padrao_nome || "");
    void conectar();
  }

  const servicoNumerico = valorComprovante(valorServico);
  const pagoNumerico = valorComprovante(valorPago);
  const dados = { nome, telefone: formatarTelefone(cadastro.data?.telefone ?? ""), data, pagamento: pagamento || "nao_pago" as PagamentoComprovante, valor: pagamento === "parcial" ? saldoComprovante(servicoNumerico, pagoNumerico) : valorComprovante(valor), valorServico: pagamento === "parcial" ? servicoNumerico : undefined, valorPago: pagamento === "parcial" ? pagoNumerico : undefined, descricao, usuario: cadastro.data?.usuario ?? "" };
  const destaque = pagamentoComprovante({ ...dados, valor: Number.isFinite(dados.valor) && dados.valor >= 0 ? dados.valor : 0, valorServico: Number.isFinite(dados.valorServico) ? dados.valorServico : undefined, valorPago: Number.isFinite(dados.valorPago) ? dados.valorPago : undefined });
  const mudouNome = normalizarNomePessoa(nome) !== normalizarNomePessoa(cadastro.data?.nome);

  async function executar(imprimir: boolean, metodo: "qz" | "navegador" = "qz") {
    if (ocupado) return;
    if (imprimir && !pagamento) { toast.error("Selecione uma opção de pagamento antes de imprimir."); return; }
    if (!normalizarNomePessoa(nome)) { toast.error("Informe o nome do cliente."); return; }
    if (imprimir && pagamento === "parcial") {
      if (!Number.isFinite(servicoNumerico) || servicoNumerico <= 0) { toast.error("Informe um valor válido para o serviço."); return; }
      if (!Number.isFinite(pagoNumerico) || pagoNumerico <= 0) { toast.error("Informe o valor pago. Se não houve pagamento, selecione Não pago."); return; }
      if (pagoNumerico >= servicoNumerico) { toast.error("No pagamento parcial, o valor pago deve ser menor que o valor do serviço."); return; }
    }
    if (imprimir && (!Number.isFinite(dados.valor) || dados.valor < 0)) { toast.error("Informe um valor válido, por exemplo 18,50."); return; }
    if (imprimir && pagamento !== "total" && dados.valor <= 0) { toast.error("Informe o valor que falta pagar."); return; }
    if (imprimir && metodo === "qz" && !impressora) { toast.error("Selecione a impressora térmica."); return; }
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
        const html = htmlComprovante({ ...dados, nome: nomeFinal });
        if (metodo === "navegador") {
          await imprimirComprovanteNavegador(html);
        } else {
          await imprimirComprovante80mm(html, impressora);
          toast.success("Impressão enviada.");
        }
        setAberto(false);
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
          <p className="break-words text-sm text-muted-foreground">{dados.usuario}</p>
          <div className="grid gap-1.5"><Label htmlFor="ticket-nome">Nome</Label><div className="flex gap-2"><Input id="ticket-nome" value={nome} maxLength={200} disabled={ocupado} onChange={e => setNome(e.target.value)} /><Button size="icon" variant="outline" aria-label="Salvar nome no cadastro" title="Salvar nome no cadastro" disabled={ocupado || !mudouNome} onClick={() => void executar(false)}><Save className="h-4 w-4" /></Button></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Telefone</Label><p className="break-words text-sm">{dados.telefone}</p></div><div><Label>Data atual</Label><p className="text-sm">{data}</p></div></div>
          <div className="grid gap-2"><Label id="ticket-pagamento">Pagamento</Label><RadioGroup aria-labelledby="ticket-pagamento" value={pagamento} disabled={ocupado} onValueChange={v => { if (v === "total" || v === "parcial" || v === "nao_pago") setPagamento(v); }} className="grid-cols-3" orientation="horizontal">{([{ value: "total", label: "Total" }, { value: "parcial", label: "Parcial" }, { value: "nao_pago", label: "Não pago" }] as const).map(opcao => <div key={opcao.value} className="flex items-center gap-2"><RadioGroupItem id={`ticket-${opcao.value}`} value={opcao.value} /><Label htmlFor={`ticket-${opcao.value}`} className="cursor-pointer">{opcao.label}</Label></div>)}</RadioGroup></div>
          {pagamento && (pagamento === "parcial" ? <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="ticket-servico">Valor do serviço (R$)</Label><Input id="ticket-servico" inputMode="decimal" value={valorServico} disabled={ocupado} onChange={e => setValorServico(e.target.value)} placeholder="0,00" /></div>
            <div className="grid gap-1.5"><Label htmlFor="ticket-pago">Valor pago (R$)</Label><Input id="ticket-pago" inputMode="decimal" value={valorPago} disabled={ocupado} onChange={e => setValorPago(e.target.value)} placeholder="0,00" /></div>
          </div> : <div className="grid gap-1.5"><Label htmlFor="ticket-valor">{pagamento === "total" ? "Valor pago (R$)" : "Valor que falta pagar (R$)"}</Label><Input id="ticket-valor" inputMode="decimal" value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} placeholder="0,00" /></div>)}
          {pagamento && <div className="border-l-4 border-primary bg-muted p-3 font-bold" aria-live="polite"><p>{destaque.titulo}</p>{destaque.detalhes.map(linha => <p key={linha} className="text-sm font-normal">{linha}</p>)}<p>{destaque.valor}</p></div>}
          <div className="grid gap-1.5"><Label htmlFor="ticket-descricao">Descrição</Label><Textarea id="ticket-descricao" value={descricao} maxLength={4000} disabled={ocupado} onChange={e => setDescricao(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Impressora térmica — 80 mm</Label><div className="flex gap-2"><Select value={impressora} disabled={ocupado} onValueChange={setImpressora}><SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Selecionar impressora" /></SelectTrigger><SelectContent>{opcoes.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="shrink-0 px-2" title="Definir como padrão neste computador" disabled={!impressora || ocupado} onClick={() => { try { localStorage.setItem(`whatsapp:termica80:${user?.id ?? ""}`, impressora); toast.success("Impressora padrão salva neste computador."); } catch { toast.error("Não foi possível salvar a impressora padrão."); } }}><Star className="h-4 w-4" />Padrão</Button><Button size="icon" variant="outline" className="shrink-0" aria-label="Conectar QZ Tray" title="Conectar QZ Tray" onClick={() => void conectar()} disabled={conectando || ocupado}><RefreshCw className={conectando ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div></div>
          <div className="mx-auto grid w-full max-w-xs grid-cols-2 gap-3">
            <Button className="aspect-square h-auto min-w-0 flex-col whitespace-normal rounded-none p-3 text-center" disabled={ocupado || !dados.usuario} onClick={() => void executar(true)}><Printer className="h-6 w-6" />{ocupado ? "Aguarde…" : "Imprimir"}</Button>
            <Button className="aspect-square h-auto min-w-0 flex-col whitespace-normal rounded-none p-3 text-center" variant="outline" disabled={ocupado || !dados.usuario} onClick={() => void executar(true, "navegador")}><Printer className="h-6 w-6" />Imprimir pelo navegador</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}