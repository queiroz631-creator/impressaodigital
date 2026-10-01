import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { normalizarNomePessoa } from "@/lib/nome-pessoa";

export function NovoTrabalhoPagina() {
  const navigate = useNavigate(); const qc = useQueryClient();
  const [clienteId, setClienteId] = useState("NOVO"); const [nome, setNome] = useState(""); const [telefone, setTelefone] = useState(""); const [observacoes, setObservacoes] = useState("");
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes", "foto-express"], queryFn: async () => { const { data, error } = await supabase.from("clientes").select("id,nome,telefone").order("nome"); if (error) throw error; return data; } });
  const selecionado = useMemo(() => clientes.find((c) => c.id === clienteId), [clienteId, clientes]);
  const criar = useMutation({ mutationFn: async () => { const nomeTrabalho = normalizarNomePessoa(selecionado?.nome ?? nome); const telefoneTrabalho = selecionado?.telefone ?? telefone.trim(); const { data, error } = await supabase.from("foto_express_trabalhos").insert({ cliente_id: selecionado?.id ?? null, cliente_nome: nomeTrabalho, cliente_telefone: telefoneTrabalho ?? "", observacoes: observacoes.trim() }).select("id").single(); if (error) throw error; return data; }, onSuccess: ({ id }) => { void qc.invalidateQueries({ queryKey: ["foto-express"] }); toast.success("Trabalho criado como rascunho."); navigate({ to: "/foto-express/$id/fotos", params: { id } }); }, onError: (e: Error) => toast.error(e.message) });
  return <><PageHeader titulo="Novo trabalho" subtitulo="Comece pelos dados do atendimento" /><Card className="mx-auto max-w-3xl"><CardHeader><CardTitle>Dados do trabalho</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Cliente cadastrado (opcional)</Label><Select value={clienteId} onValueChange={setClienteId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NOVO">Não vincular a um cadastro</SelectItem>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} {c.telefone ? `· ${c.telefone}` : ""}</SelectItem>)}</SelectContent></Select></div>{!selecionado && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Nome do cliente</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Opcional" /></div><div className="space-y-2"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Opcional" /></div></div>}<div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Detalhes do atendimento, prazo ou preferências" rows={4} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate({ to: "/foto-express" })}>Cancelar</Button><Button onClick={() => criar.mutate()} disabled={criar.isPending}>{criar.isPending ? "Criando..." : "Criar e enviar fotos"}</Button></div></CardContent></Card></>;
}
