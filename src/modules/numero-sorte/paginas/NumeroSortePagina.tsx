import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { IndicadorCard } from "@/modules/sorteios/components/IndicadorCard";
import {
  CAPACIDADE_CAMPANHA,
  ROTULO_SITUACAO,
  proximasSituacoes,
  type SituacaoCampanha,
} from "../lib/codigo";

type Campanha = Database["public"]["Tables"]["numero_sorte_campanhas"]["Row"];
type Premio = Database["public"]["Tables"]["numero_sorte_premios"]["Row"];

const CHAVE = "numero-sorte";

function erroMsg(e: unknown) {
  return e instanceof Error ? e.message : "Não foi possível concluir.";
}

function paraLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function deLocal(v: string) {
  return v ? new Date(v).toISOString() : null;
}
function dataHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function useCampanhas() {
  return useQuery({
    queryKey: [CHAVE, "campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("numero_sorte_campanhas")
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function NumeroSortePagina() {
  const [aba, setAba] = useState("dashboard");
  const [campanhaSel, setCampanhaSel] = useState<string>("");
  return (
    <>
      <PageHeader titulo="Nº da Sorte" subtitulo="Campanhas com números premiados" />
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="premios">Prêmios</TabsTrigger>
          <TabsTrigger value="participacoes">Participações</TabsTrigger>
          <TabsTrigger value="retirada">Retirada de Prêmios</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><Dashboard /></TabsContent>
        <TabsContent value="campanhas">
          <Campanhas
            abrirPremios={(id) => {
              setCampanhaSel(id);
              setAba("premios");
            }}
          />
        </TabsContent>
        <TabsContent value="premios">
          <Premios campanhaId={campanhaSel} setCampanhaId={setCampanhaSel} />
        </TabsContent>
        {["participacoes", "retirada", "estatisticas", "configuracoes"].map((v) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Esta área chega nas próximas etapas (página pública, comprovante e retirada).
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function Dashboard() {
  const { data: campanhas = [] } = useCampanhas();
  const { data: premios = [] } = useQuery({
    queryKey: [CHAVE, "premios-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("numero_sorte_premios").select("quantidade");
      if (error) throw error;
      return data;
    },
  });
  const conta = (s: SituacaoCampanha) => campanhas.filter((c) => c.situacao === s).length;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <IndicadorCard titulo="Campanhas" valor={campanhas.length} icone={<Ticket />} />
      <IndicadorCard titulo="Ativas" valor={conta("ativa")} />
      <IndicadorCard titulo="Encerradas" valor={conta("encerrada")} />
      <IndicadorCard
        titulo="Unidades premiadas"
        valor={premios.reduce((s, p) => s + p.quantidade, 0)}
      />
    </div>
  );
}

const corSituacao: Record<SituacaoCampanha, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "outline",
  programada: "secondary",
  ativa: "default",
  suspensa: "destructive",
  encerrada: "secondary",
};

function Campanhas({ abrirPremios }: { abrirPremios: (id: string) => void }) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const podeGerir = pode("numero_sorte.campanhas.gerenciar");
  const qc = useQueryClient();
  const { data: campanhas = [], isLoading } = useCampanhas();
  const [editando, setEditando] = useState<Partial<Campanha> | null>(null);

  const mudarSituacao = useMutation({
    mutationFn: async ({ c, s }: { c: Campanha; s: SituacaoCampanha }) => {
      const { error } = await supabase.from("numero_sorte_campanhas").update({ situacao: s }).eq("id", c.id);
      if (error) throw error;
      await supabase.from("numero_sorte_auditoria").insert({
        campanha_id: c.id,
        evento: "situacao_alterada",
        usuario_id: user!.id,
        detalhe: { de: c.situacao, para: s },
      });
    },
    onSuccess: () => {
      toast.success("Situação atualizada.");
      qc.invalidateQueries({ queryKey: [CHAVE] });
    },
    onError: (e) => toast.error(erroMsg(e)),
  });

  return (
    <div className="space-y-3">
      {podeGerir && (
        <div className="flex justify-end">
          <Button onClick={() => setEditando({ situacao: "rascunho" })}>
            <Plus className="mr-2 h-4 w-4" /> Nova campanha
          </Button>
        </div>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && campanhas.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma campanha cadastrada.</CardContent></Card>
      )}
      {campanhas.map((c) => {
        const s = c.situacao as SituacaoCampanha;
        return (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  #{c.numero} · {c.nome}{" "}
                  <Badge variant={corSituacao[s]}>{ROTULO_SITUACAO[s]}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {dataHora(c.inicio_em)} até {dataHora(c.fim_em)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => abrirPremios(c.id)}>Prêmios</Button>
              {podeGerir && s !== "encerrada" && (
                <Button variant="outline" size="sm" onClick={() => setEditando(c)}>Editar</Button>
              )}
              {podeGerir && proximasSituacoes(s).length > 0 && (
                <Select
                  value=""
                  onValueChange={(v) => {
                    const novo = v as SituacaoCampanha;
                    if (novo === "encerrada" && !confirm("Encerrar é definitivo. Confirmar?")) return;
                    mudarSituacao.mutate({ c, s: novo });
                  }}
                >
                  <SelectTrigger className="w-40"><SelectValue placeholder="Alterar situação" /></SelectTrigger>
                  <SelectContent>
                    {proximasSituacoes(s).map((p) => (
                      <SelectItem key={p} value={p}>{ROTULO_SITUACAO[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        );
      })}
      {editando && <FormCampanha inicial={editando} fechar={() => setEditando(null)} />}
    </div>
  );
}

function FormCampanha({ inicial, fechar }: { inicial: Partial<Campanha>; fechar: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({
    nome: inicial.nome ?? "",
    descricao: inicial.descricao ?? "",
    inicio: paraLocal(inicial.inicio_em ?? null),
    fim: paraLocal(inicial.fim_em ?? null),
    regulamento: inicial.regulamento ?? "",
    condicoes: inicial.condicoes ?? "",
    limiteConsultas: inicial.limite_consultas_cliente?.toString() ?? "",
    maxParticipacoes: inicial.max_participacoes_cliente?.toString() ?? "",
  });
  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.nome.trim()) throw new Error("Informe o nome da campanha.");
      const dados = {
        nome: f.nome.trim(),
        descricao: f.descricao,
        inicio_em: deLocal(f.inicio),
        fim_em: deLocal(f.fim),
        regulamento: f.regulamento,
        condicoes: f.condicoes,
        limite_consultas_cliente: f.limiteConsultas ? Number(f.limiteConsultas) : null,
        max_participacoes_cliente: f.maxParticipacoes ? Number(f.maxParticipacoes) : null,
      };
      if (dados.inicio_em && dados.fim_em && dados.fim_em <= dados.inicio_em)
        throw new Error("O encerramento deve ser depois do início.");
      const { data, error } = inicial.id
        ? await supabase.from("numero_sorte_campanhas").update(dados).eq("id", inicial.id).select("id").single()
        : await supabase.from("numero_sorte_campanhas").insert(dados).select("id").single();
      if (error) throw error;
      await supabase.from("numero_sorte_auditoria").insert({
        campanha_id: data.id,
        evento: inicial.id ? "campanha_editada" : "campanha_criada",
        usuario_id: user!.id,
      });
    },
    onSuccess: () => {
      toast.success("Campanha salva.");
      qc.invalidateQueries({ queryKey: [CHAVE] });
      fechar();
    },
    onError: (e) => toast.error(erroMsg(e)),
  });
  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{inicial.id ? `Editar campanha #${inicial.numero}` : "Nova campanha"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input {...campo("nome")} /></div>
          <div><Label>Descrição</Label><Textarea {...campo("descricao")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Início</Label><Input type="datetime-local" {...campo("inicio")} /></div>
            <div><Label>Encerramento</Label><Input type="datetime-local" {...campo("fim")} /></div>
          </div>
          <div><Label>Regulamento</Label><Textarea rows={4} {...campo("regulamento")} /></div>
          <div><Label>Condições gerais</Label><Textarea {...campo("condicoes")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Limite de consultas por cliente</Label><Input type="number" min={1} placeholder="Sem limite" {...campo("limiteConsultas")} /></div>
            <div><Label>Máx. participações por cliente</Label><Input type="number" min={1} placeholder="Sem limite" {...campo("maxParticipacoes")} /></div>
          </div>
          {!inicial.id && (
            <p className="text-xs text-muted-foreground">O número da campanha é gerado automaticamente e nunca é reaproveitado.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Premios({ campanhaId, setCampanhaId }: { campanhaId: string; setCampanhaId: (v: string) => void }) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const podeGerir = pode("numero_sorte.premios.gerenciar");
  const { data: campanhas = [] } = useCampanhas();
  const campanha = campanhas.find((c) => c.id === campanhaId);
  const [novo, setNovo] = useState(false);
  const [vendoNumeros, setVendoNumeros] = useState<Premio | null>(null);
  const [adicionando, setAdicionando] = useState<Premio | null>(null);

  const { data: premios = [] } = useQuery({
    queryKey: [CHAVE, "premios", campanhaId],
    enabled: !!campanhaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("numero_sorte_premios").select("*").eq("campanha_id", campanhaId).order("criado_em");
      if (error) throw error;
      return data;
    },
  });
  const { data: resumo = [] } = useQuery({
    queryKey: [CHAVE, "resumo", campanhaId],
    enabled: !!campanhaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("numero_sorte_resumo_premios", { _campanha_id: campanhaId });
      if (error) throw error;
      return data;
    },
  });
  const usados = premios.reduce((s, p) => s + p.quantidade, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={campanhaId} onValueChange={setCampanhaId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Escolha a campanha" /></SelectTrigger>
          <SelectContent>
            {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>#{c.numero} · {c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        {campanha && (
          <span className="text-xs text-muted-foreground">
            {usados.toLocaleString("pt-BR")} de {CAPACIDADE_CAMPANHA.toLocaleString("pt-BR")} números usados
          </span>
        )}
        <div className="flex-1" />
        {campanha && podeGerir && campanha.situacao !== "encerrada" && (
          <Button onClick={() => setNovo(true)}><Plus className="mr-2 h-4 w-4" /> Novo prêmio</Button>
        )}
      </div>
      {!campanhaId && <p className="text-sm text-muted-foreground">Escolha uma campanha para ver os prêmios.</p>}
      {campanhaId && premios.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum prêmio nesta campanha.</CardContent></Card>
      )}
      {premios.map((p) => {
        const r = resumo.find((x) => x.premio_id === p.id);
        return (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.nome} <Badge variant="outline">{p.quantidade} un.</Badge></p>
                <p className="text-xs text-muted-foreground">
                  Disponíveis {r?.disponivel ?? 0} · Reservados {r?.reservado ?? 0} · Entregues {r?.entregue ?? 0} · Vencidos {r?.vencido ?? 0} · Prazo {p.prazo_retirada_dias} dias
                </p>
              </div>
              {podeGerir && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setVendoNumeros(p)}><Eye className="mr-1 h-4 w-4" /> Números</Button>
                  {campanha?.situacao !== "encerrada" && (
                    <Button variant="outline" size="sm" onClick={() => setAdicionando(p)}>Adicionar unidades</Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
      {novo && campanha && <FormPremio campanha={campanha} fechar={() => setNovo(false)} />}
      {vendoNumeros && <NumerosDialog premio={vendoNumeros} fechar={() => setVendoNumeros(null)} />}
      {adicionando && <AdicionarUnidades premio={adicionando} fechar={() => setAdicionando(null)} />}
    </div>
  );
}

function FormPremio({ campanha, fechar }: { campanha: Campanha; fechar: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    nome: "", descricao: "", quantidade: "1", condicoes_retirada: "", prazo_retirada_dias: "30",
    observacoes: "", valor_estimado: "", instrucoes: "", local_retirada: "", limite_por_cpf: "",
  });
  const [exigeDoc, setExigeDoc] = useState(false);
  const salvar = useMutation({
    mutationFn: async () => {
      const qtd = Number(f.quantidade);
      if (!f.nome.trim()) throw new Error("Informe o nome do prêmio.");
      if (!f.descricao.trim() || !f.condicoes_retirada.trim()) throw new Error("Descrição e condições de retirada são obrigatórias.");
      if (!Number.isInteger(qtd) || qtd < 1) throw new Error("Quantidade inválida.");
      const { error } = await supabase.rpc("numero_sorte_criar_premio", {
        _campanha_id: campanha.id,
        _quantidade: qtd,
        _dados: {
          ...f,
          prazo_retirada_dias: Number(f.prazo_retirada_dias) || 30,
          valor_estimado: f.valor_estimado ? Number(f.valor_estimado.replace(",", ".")) : null,
          limite_por_cpf: f.limite_por_cpf ? Number(f.limite_por_cpf) : null,
          exige_documento: exigeDoc,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prêmio cadastrado e números gerados.");
      qc.invalidateQueries({ queryKey: [CHAVE] });
      fechar();
    },
    onError: (e) => toast.error(erroMsg(e)),
  });
  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo prêmio · campanha #{campanha.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input {...campo("nome")} /></div>
          <div><Label>Descrição</Label><Textarea {...campo("descricao")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Quantidade de unidades</Label><Input type="number" min={1} {...campo("quantidade")} /></div>
            <div><Label>Prazo de retirada (dias)</Label><Input type="number" min={1} {...campo("prazo_retirada_dias")} /></div>
          </div>
          <div><Label>Condições para retirada</Label><Textarea {...campo("condicoes_retirada")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Local de retirada</Label><Input {...campo("local_retirada")} /></div>
            <div><Label>Valor estimado (R$)</Label><Input {...campo("valor_estimado")} /></div>
            <div><Label>Limite por CPF</Label><Input type="number" min={1} placeholder="Sem limite" {...campo("limite_por_cpf")} /></div>
            <div className="flex items-center gap-2 pt-6"><Switch checked={exigeDoc} onCheckedChange={setExigeDoc} /><Label>Exige documento</Label></div>
          </div>
          <div><Label>Instruções adicionais</Label><Textarea {...campo("instrucoes")} /></div>
          <div><Label>Observações internas</Label><Textarea {...campo("observacoes")} /></div>
          <p className="text-xs text-muted-foreground">Um número da sorte exclusivo é gerado no servidor para cada unidade.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar e gerar números</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdicionarUnidades({ premio, fechar }: { premio: Premio; fechar: () => void }) {
  const qc = useQueryClient();
  const [qtd, setQtd] = useState("1");
  const gerar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("numero_sorte_gerar_numeros", { _premio_id: premio.id, _quantidade: Number(qtd) });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unidades adicionadas.");
      qc.invalidateQueries({ queryKey: [CHAVE] });
      fechar();
    },
    onError: (e) => toast.error(erroMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar unidades · {premio.nome}</DialogTitle></DialogHeader>
        <Label>Quantidade</Label>
        <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>Gerar números</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROTULO_UNIDADE: Record<string, string> = {
  disponivel: "Disponível", reservado: "Reservado", entregue: "Entregue", vencido: "Vencido", cancelado: "Cancelado",
};

function NumerosDialog({ premio, fechar }: { premio: Premio; fechar: () => void }) {
  const [busca, setBusca] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: [CHAVE, "numeros", premio.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("numero_sorte_numeros").select("id, codigo, situacao").eq("premio_id", premio.id).order("codigo");
      if (error) throw error;
      return data;
    },
  });
  const lista = useMemo(() => data.filter((n) => n.codigo.includes(busca.trim())), [data, busca]);
  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Números · {premio.nome}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Confidencial: não compartilhe esta lista fora da equipe.</p>
        <Input placeholder="Pesquisar número" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {isLoading && <p className="text-sm">Carregando…</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {lista.map((n) => (
            <div key={n.id} className="rounded-md border p-2 text-center">
              <p className="font-mono font-semibold">{n.codigo}</p>
              <p className="text-xs text-muted-foreground">{ROTULO_UNIDADE[n.situacao] ?? n.situacao}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
