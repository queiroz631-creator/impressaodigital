import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { consultarCurriculosConversa } from "@/lib/whatsapp-curriculo.functions";
import { enviarTextoWhatsapp, enviarArquivoWhatsapp } from "@/lib/whatsapp.functions";
import { mensagemLinkCurriculo } from "@/lib/curriculo";
import { urlPublica } from "@/lib/link-publico";
import { formatarTelefone } from "@/lib/whatsapp-comum";
import { dataHoraBR } from "@/lib/format";

type Acao = "novo" | "editar" | "pdf";

export function CurriculoClienteDialog({ conversaId, autor }: { conversaId: string; autor: string }) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const queryClient = useQueryClient();
  const consultar = useServerFn(consultarCurriculosConversa);
  const enviarTexto = useServerFn(enviarTextoWhatsapp);
  const enviarArquivo = useServerFn(enviarArquivoWhatsapp);
  const [aberto, setAberto] = useState(false);
  const [acao, setAcao] = useState<Acao>("novo");
  const [curriculoId, setCurriculoId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [expira, setExpira] = useState("");
  const [linkPronto, setLinkPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const consulta = useQuery({ queryKey: ["whatsapp-curriculos", conversaId], enabled: aberto, staleTime: 0, retry: false, queryFn: () => consultar({ data: { conversaId, carregarPdf: false } }) });
  const dados = consulta.data;
  const selecionado = curriculoId || (dados?.curriculos.length === 1 ? dados.curriculos[0]?.id ?? "" : "");
  const podeExistente = !!dados && !dados.ambiguo && dados.curriculos.length > 0;

  function limparLink() { setMensagem(""); setExpira(""); setLinkPronto(false); }

  async function executar(enviar: boolean) {
    if (trava.current || !dados) return;
    trava.current = true;
    setOcupado(true);
    try {
      const atual = await consultar({ data: { conversaId, curriculoId: acao === "novo" ? undefined : selecionado || undefined, carregarPdf: enviar && acao === "pdf", prepararLink: !enviar && acao !== "pdf" ? acao : undefined } });
      if (acao !== "novo" && (!selecionado || atual.ambiguo)) throw new Error("Selecione um currículo deste cliente.");
      if (!enviar) {
        if (!atual.link) throw new Error("Não foi possível preparar o link.");
        if (acao === "novo") {
          const r = atual.link;
          setMensagem(mensagemLinkCurriculo(r.mensagem, urlPublica(r.url)));
          setExpira(r.expiraEm);
        } else {
          const r = atual.link;
          setMensagem(`Você pode revisar e editar seu currículo por este link:\n${urlPublica(r.url)}\n\nO link vale por 24 horas.`);
          setExpira(r.expiraEm);
        }
        setLinkPronto(true);
        return;
      }
      if (acao === "pdf") {
        if (!atual.dadosPdf) throw new Error("Não foi possível carregar o currículo.");
        const { curriculoPdfBase64, nomeArquivoCurriculo } = await import("@/lib/curriculo-pdf");
        const r = await enviarArquivo({ data: { conversaId, telefone: atual.telefone, base64: curriculoPdfBase64(atual.dadosPdf), nomeArquivo: nomeArquivoCurriculo(atual.dadosPdf.curriculo.nome_completo), tipo: "pdf", mimeType: "application/pdf", autor } });
        if (!r.ok) throw new Error(r.erro ?? "Não foi possível enviar o PDF.");
      } else {
        if (!linkPronto || !mensagem.trim()) throw new Error("Prepare a mensagem antes de enviar.");
        if (new Date(expira).getTime() <= Date.now()) { limparLink(); throw new Error("O link expirou. Prepare uma nova mensagem."); }
        const r = await enviarTexto({ data: { conversaId, telefone: atual.telefone, mensagem: mensagem.trim(), autor } });
        if (!r.ok) throw new Error(r.erro ?? "Não foi possível enviar o link.");
      }
      toast.success(acao === "pdf" ? "Currículo enviado em PDF." : "Link enviado ao cliente.");
      setAberto(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", conversaId] }), queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] })]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.");
    } finally { trava.current = false; setOcupado(false); }
  }

  if (!pode("whatsapp.visualizar") || !pode("curriculos.visualizar")) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => { setAcao("novo"); setCurriculoId(""); limparLink(); setAberto(true); }}><FileText className="mr-1 h-4 w-4" />Currículo</Button>
    <Dialog open={aberto} onOpenChange={(v) => { if (!ocupado) setAberto(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Enviar currículo</DialogTitle></DialogHeader>
        {consulta.isFetching ? <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Consultando currículos…</p> : consulta.isError ? <div className="space-y-3"><p className="text-sm text-destructive">{consulta.error.message}</p><Button variant="outline" onClick={() => void consulta.refetch()}>Tentar novamente</Button></div> : dados && <div className="space-y-4">
          <div><p className="font-medium">{dados.nome}</p><p className="text-sm text-muted-foreground">{formatarTelefone(dados.telefone)}</p></div>
          {dados.ambiguo ? <p className="text-sm text-destructive">Há mais de um cadastro com este telefone. Confira o vínculo do cliente antes de enviar um currículo existente.</p> : dados.curriculos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum currículo vinculado a este cliente.</p>}
          <div className="space-y-2"><Label>Enviar</Label><Select value={acao} disabled={ocupado} onValueChange={(v: Acao) => { setAcao(v); limparLink(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="novo">Link de novo currículo</SelectItem><SelectItem value="editar" disabled={!podeExistente}>Link para edição</SelectItem><SelectItem value="pdf" disabled={!podeExistente}>PDF do currículo</SelectItem></SelectContent></Select></div>
          {acao !== "novo" && <div className="space-y-2"><Label>Currículo</Label><Select value={selecionado} disabled={ocupado} onValueChange={(v) => { setCurriculoId(v); limparLink(); }}><SelectTrigger className="h-auto min-h-9 whitespace-normal [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:break-words [&>span]:text-left"><SelectValue placeholder="Selecione o currículo" /></SelectTrigger><SelectContent>{dados.curriculos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_completo || "Currículo"} · {c.status === "completo" ? "Completo" : "Rascunho"} · {dataHoraBR(c.updated_at)}</SelectItem>)}</SelectContent></Select></div>}
          {acao !== "pdf" && !linkPronto && <Button variant="outline" disabled={ocupado || (acao === "editar" && !selecionado)} onClick={() => void executar(false)}>{ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preparar mensagem</Button>}
          {acao !== "pdf" && linkPronto && <div className="space-y-2"><Label htmlFor="curriculo-whatsapp-mensagem">Mensagem</Label><Textarea id="curriculo-whatsapp-mensagem" rows={6} value={mensagem} maxLength={4000} disabled={ocupado} onChange={(e) => setMensagem(e.target.value)} /><p className="text-xs text-muted-foreground">Válido até {dataHoraBR(expira)}</p></div>}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button><Button disabled={ocupado || (acao === "pdf" ? !selecionado || !podeExistente : !linkPronto || !mensagem.trim())} onClick={() => void executar(true)}>{ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{ocupado ? (acao === "pdf" ? "Preparando e enviando…" : "Enviando…") : acao === "pdf" ? "Enviar PDF" : "Enviar link"}</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}