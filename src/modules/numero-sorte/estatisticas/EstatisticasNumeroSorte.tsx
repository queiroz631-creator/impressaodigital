import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { IndicadorCard } from "@/modules/sorteios/components/IndicadorCard";
import { exportarRelatorioNumeroSorte } from "@/lib/numero-sorte-relatorios.functions";
import {
  ROTULO_PREMIACAO, ROTULO_RESULTADO, gerarCsv, intervaloPeriodo, taxaPremiacao, taxaRetirada,
  type TipoRelatorio,
} from "../lib/indicadores";
import { ROTULO_SITUACAO } from "../lib/codigo";

type Campanha = Database["public"]["Tables"]["numero_sorte_campanhas"]["Row"];
type Mapa = Record<string, number>;
const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const TODAS = "__todas";
const SEM_DADOS = "Esta campanha ainda não possui participações.";

function dataBr(iso?: string | null, hora = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", ...(hora ? { timeStyle: "short" } : {}),
  });
}
function baixar(nome: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}
function erroTexto(e: unknown) {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "");
  return m.includes("SEM_PERMISSAO") ? "Você não tem permissão para ver estes dados." : m || "Não foi possível carregar.";
}

type Filtros = { campanha: string; situacao: string; de: string; ate: string };

function BarraFiltros({ f, set, campanhas, comSituacao = true }: {
  f: Filtros; set: (f: Filtros) => void; campanhas: Campanha[]; comSituacao?: boolean;
}) {
  return (
    <Card className="mb-4">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>Campanha</Label>
          <Select value={f.campanha || TODAS} onValueChange={(v) => set({ ...f, campanha: v === TODAS ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as campanhas</SelectItem>
              {campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero} · {c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {comSituacao && (
          <div>
            <Label>Situação da campanha</Label>
            <Select value={f.situacao || TODAS} onValueChange={(v) => set({ ...f, situacao: v === TODAS ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {Object.entries(ROTULO_SITUACAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div><Label>Data inicial</Label><Input type="date" value={f.de} onChange={(e) => set({ ...f, de: e.target.value })} /></div>
        <div><Label>Data final</Label><Input type="date" value={f.ate} onChange={(e) => set({ ...f, ate: e.target.value })} /></div>
      </CardContent>
    </Card>
  );
}

function Grafico({ titulo, vazio, children }: { titulo: string; vazio: boolean; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="h-64">
        {vazio ? <p className="py-20 text-center text-sm text-muted-foreground">{SEM_DADOS}</p> : (
          <ResponsiveContainer width="100%" height="100%">{children as never}</ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function pizza(m: Mapa, rotulos: Record<string, string>) {
  return Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => ({ nome: rotulos[k] ?? k, valor: v }));
}
const ROT_NUM: Record<string, string> = { disponivel: "Disponíveis", reservado: "Reservados", entregue: "Entregues", vencido: "Vencidos", cancelado: "Cancelados" };

type Dash = {
  cards: Mapa;
  por_dia: { dia: string; consultas: number; clientes: number }[];
  por_hora: { hora: number; consultas: number }[];
  resultados: Mapa; situacao_premios: Mapa;
  retiradas_dia: { dia: string; encontradas: number; entregues: number }[];
  comparacao: { id: string; numero: number; nome: string; inicio_em: string | null; fim_em: string | null; participantes: number; consultas: number; premiados: number; entregues: number; validas: number }[];
};

export function DashboardNumeroSorte({ campanhas }: { campanhas: Campanha[] }) {
  const [f, setF] = useState<Filtros>({ campanha: "", situacao: "", de: "", ate: "" });
  const p = intervaloPeriodo(f.de, f.ate);
  const { data, isLoading, error } = useQuery({
    queryKey: ["numero-sorte", "dashboard", f],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("numero_sorte_dashboard", {
        _campanha: f.campanha || undefined, _situacao: f.situacao || undefined,
        _de: p.de ?? undefined, _ate: p.ate ?? undefined,
      });
      if (error) throw error;
      return data as unknown as Dash;
    },
  });
  const c = data?.cards ?? {};
  const n = (k: string) => Number(c[k] ?? 0);
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: `${h}h`, consultas: data?.por_hora.find((x) => x.hora === h)?.consultas ?? 0 }));
  return (
    <>
      <BarraFiltros f={f} set={setF} campanhas={campanhas} />
      {error && <p className="mb-3 text-sm text-destructive">{erroTexto(error)}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando indicadores...</p>}
      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <IndicadorCard titulo="Campanhas" valor={n("campanhas")} />
            <IndicadorCard titulo="Ativas" valor={n("campanhas_ativas")} />
            <IndicadorCard titulo="Clientes cadastrados" valor={n("clientes_cadastrados")} />
            <IndicadorCard titulo="Participantes únicos" valor={n("clientes_participantes")} />
            <IndicadorCard titulo="Consultas" valor={n("consultas")} />
            <IndicadorCard titulo="Números distintos" valor={n("numeros_distintos")} />
            <IndicadorCard titulo="Não premiados" valor={n("nao_premiados")} />
            <IndicadorCard titulo="Premiados encontrados" valor={n("premiados")} />
            <IndicadorCard titulo="Prêmios cadastrados" valor={n("premios_cadastrados")} />
            <IndicadorCard titulo="Unidades disponíveis" valor={n("unidades_disponiveis")} />
            <IndicadorCard titulo="Aguardando retirada" valor={n("aguardando")} />
            <IndicadorCard titulo="Entregues" valor={n("entregues")} />
            <IndicadorCard titulo="Vencidos" valor={n("vencidos")} />
            <IndicadorCard titulo="Cancelados" valor={n("cancelados")} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Grafico titulo="Participações por dia" vazio={data.por_dia.length === 0}>
              <LineChart data={data.por_dia}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend />
                <Line dataKey="clientes" name="Clientes únicos" stroke="var(--chart-1)" />
                <Line dataKey="consultas" name="Consultas" stroke="var(--chart-2)" />
              </LineChart>
            </Grafico>
            <Grafico titulo="Consultas por horário (Brasília)" vazio={data.por_hora.length === 0}>
              <BarChart data={horas}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hora" fontSize={10} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                <Bar dataKey="consultas" name="Consultas" fill="var(--chart-1)" />
              </BarChart>
            </Grafico>
            <Grafico titulo="Resultado das consultas" vazio={Object.keys(data.resultados).length === 0}>
              <PieChart>
                <Pie data={pizza(data.resultados, ROTULO_RESULTADO)} dataKey="valor" nameKey="nome" outerRadius={80} label>
                  {pizza(data.resultados, ROTULO_RESULTADO).map((_, i) => <Cell key={i} fill={CORES[i % 5]} />)}
                </Pie><Tooltip /><Legend />
              </PieChart>
            </Grafico>
            <Grafico titulo="Situação dos prêmios" vazio={Object.keys(data.situacao_premios).length === 0}>
              <PieChart>
                <Pie data={pizza(data.situacao_premios, ROT_NUM)} dataKey="valor" nameKey="nome" outerRadius={80} label>
                  {pizza(data.situacao_premios, ROT_NUM).map((_, i) => <Cell key={i} fill={CORES[i % 5]} />)}
                </Pie><Tooltip /><Legend />
              </PieChart>
            </Grafico>
            <Grafico titulo="Premiações encontradas e entregas por dia" vazio={data.retiradas_dia.length === 0}>
              <LineChart data={data.retiradas_dia}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend />
                <Line dataKey="encontradas" name="Encontradas" stroke="var(--chart-3)" />
                <Line dataKey="entregues" name="Entregues" stroke="var(--chart-1)" />
              </LineChart>
            </Grafico>
          </div>
          <Card className="mt-4">
            <CardHeader className="pb-2"><CardTitle className="text-base">Comparação entre campanhas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {data.comparacao.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr>
                    <th className="p-2">Campanha</th><th className="p-2">Período</th><th className="p-2 text-right">Participantes</th>
                    <th className="p-2 text-right">Consultas</th><th className="p-2 text-right">Premiados</th>
                    <th className="p-2 text-right">Entregues</th><th className="p-2 text-right">Retirada</th>
                  </tr></thead>
                  <tbody>{data.comparacao.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-2">{x.numero} · {x.nome}</td>
                      <td className="p-2 text-xs">{dataBr(x.inicio_em, false)} a {dataBr(x.fim_em, false)}</td>
                      <td className="p-2 text-right">{x.participantes}</td><td className="p-2 text-right">{x.consultas}</td>
                      <td className="p-2 text-right">{x.premiados}</td><td className="p-2 text-right">{x.entregues}</td>
                      <td className="p-2 text-right">{x.validas ? `${Math.round((x.entregues / x.validas) * 1000) / 10}%` : "—"}</td>
                    </tr>))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

type Est = {
  campanha: { id: string; numero: number; nome: string; inicio_em: string | null; fim_em: string | null; situacao: string };
  cadastrados: number; novos: number; participantes: number; consultas: number; distintos: number;
  resultados: Mapa; premiacoes: Mapa; clientes_premiados: number;
  premios: { id: string; nome: string; imagem_path: string | null; quantidade: number; gerados: number; disponiveis: number; reservados: number; entregues: number; vencidos: number; cancelados: number }[];
};

function ImagemPremio({ caminho }: { caminho: string | null }) {
  const { data } = useQuery({
    queryKey: ["numero-sorte", "img", caminho],
    enabled: !!caminho, staleTime: 50 * 60_000,
    queryFn: async () => (await supabase.storage.from("numero-sorte-divulgacao").createSignedUrl(caminho!, 3600)).data?.signedUrl ?? null,
  });
  return data ? <img src={data} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />;
}

export function EstatisticasCampanha({ campanhas, campanhaId, setCampanhaId }: {
  campanhas: Campanha[]; campanhaId: string; setCampanhaId: (id: string) => void;
}) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const id = campanhaId || campanhas[0]?.id || "";
  const { data, isLoading, error } = useQuery({
    queryKey: ["numero-sorte", "estatisticas", id],
    enabled: !!id, staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("numero_sorte_estatisticas_campanha", { _campanha: id });
      if (error) throw error;
      return data as unknown as Est;
    },
  });
  const r = data?.resultados ?? {};
  const pm = data?.premiacoes ?? {};
  const encontrados = (pm.reservado ?? 0) + (pm.entregue ?? 0) + (pm.vencido ?? 0);
  function exportar() {
    if (!data) return;
    const resumo = gerarCsv(
      [{ chave: "k", titulo: "Indicador" }, { chave: "v", titulo: "Valor" }],
      [
        ["Campanha", `${data.campanha.numero} - ${data.campanha.nome}`], ["Clientes cadastrados", data.cadastrados],
        ["Novos clientes", data.novos], ["Clientes participantes", data.participantes], ["Consultas", data.consultas],
        ["Números distintos", data.distintos], ["Clientes premiados", data.clientes_premiados],
        ["Prêmios entregues", pm.entregue ?? 0], ["Aguardando retirada", pm.reservado ?? 0], ["Vencidos", pm.vencido ?? 0],
        ["Taxa de premiação (%)", taxaPremiacao(data.clientes_premiados, data.participantes)],
        ["Taxa de retirada (%)", taxaRetirada(pm)],
      ].map(([k, v]) => ({ k, v })),
    );
    baixar(`campanha-${data.campanha.numero}-resumo.csv`, resumo);
    baixar(`campanha-${data.campanha.numero}-premios.csv`, gerarCsv(
      [{ chave: "nome", titulo: "Prêmio" }, { chave: "quantidade", titulo: "Quantidade" }, { chave: "gerados", titulo: "Números gerados" },
       { chave: "disponiveis", titulo: "Disponíveis" }, { chave: "reservados", titulo: "Reservados" }, { chave: "entregues", titulo: "Entregues" },
       { chave: "vencidos", titulo: "Vencidos" }, { chave: "cancelados", titulo: "Cancelados" }],
      data.premios,
    ));
  }
  if (campanhas.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <Label>Campanha</Label>
          <Select value={id} onValueChange={setCampanhaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero} · {c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {pode("numero_sorte.exportar") && data && (
          <Button variant="outline" onClick={exportar}><Download className="mr-2 h-4 w-4" /> Exportar resumo e prêmios</Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{erroTexto(error)}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {data && (
        <>
          <p className="mb-3 text-sm">
            <b>Nº {data.campanha.numero} · {data.campanha.nome}</b> — {dataBr(data.campanha.inicio_em, false)} a {dataBr(data.campanha.fim_em, false)}{" "}
            <Badge variant="secondary">{ROTULO_SITUACAO[data.campanha.situacao as keyof typeof ROTULO_SITUACAO] ?? data.campanha.situacao}</Badge>
          </p>
          {data.consultas === 0 && data.cadastrados === 0 && <p className="mb-3 text-sm text-muted-foreground">{SEM_DADOS}</p>}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <IndicadorCard titulo="Clientes cadastrados" valor={data.cadastrados} descricao={`${data.novos} novos · ${data.cadastrados - data.novos} já existentes`} />
            <IndicadorCard titulo="Participantes" valor={data.participantes} />
            <IndicadorCard titulo="Consultas" valor={data.consultas} />
            <IndicadorCard titulo="Números distintos" valor={data.distintos} />
            <IndicadorCard titulo="Repetidas" valor={r.repetida ?? 0} />
            <IndicadorCard titulo="Bloqueadas" valor={(r.bloqueada ?? 0) + (r.limite ?? 0)} />
            <IndicadorCard titulo="Não premiadas" valor={r.nao_premiado ?? 0} />
            <IndicadorCard titulo="Premiados encontrados" valor={encontrados} />
            <IndicadorCard titulo="Clientes premiados" valor={data.clientes_premiados} />
            <IndicadorCard titulo="Entregues" valor={pm.entregue ?? 0} />
            <IndicadorCard titulo="Aguardando retirada" valor={pm.reservado ?? 0} />
            <IndicadorCard titulo="Vencidos" valor={pm.vencido ?? 0} />
            <IndicadorCard titulo="Taxa de premiação" valor={`${taxaPremiacao(data.clientes_premiados, data.participantes)}%`} descricao="premiados / participantes" />
            <IndicadorCard titulo="Taxa de retirada" valor={`${taxaRetirada(pm)}%`} descricao="entregues / (entregues + aguardando + vencidos)" />
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Desempenho dos prêmios</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {data.premios.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr>
                    <th className="p-2">Prêmio</th>{["Total", "Gerados", "Disponíveis", "Reservados", "Entregues", "Vencidos", "Cancelados"].map((t) => <th key={t} className="p-2 text-right">{t}</th>)}
                  </tr></thead>
                  <tbody>{data.premios.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="flex items-center gap-2 p-2"><ImagemPremio caminho={x.imagem_path} />{x.nome}</td>
                      {[x.quantidade, x.gerados, x.disponiveis, x.reservados, x.entregues, x.vencidos, x.cancelados].map((v, i) => <td key={i} className="p-2 text-right">{v}</td>)}
                    </tr>))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

const SITUACOES: Record<TipoRelatorio, Record<string, string>> = {
  participantes: { premiado: "Premiado", participando: "Participando", cadastrado: "Só cadastro" },
  consultas: ROTULO_RESULTADO,
  premiacoes: ROTULO_PREMIACAO,
  retiradas: ROTULO_PREMIACAO,
};

type Linha = Record<string, string | number | boolean | null>;

export function RelatoriosNumeroSorte({ campanhas }: { campanhas: Campanha[] }) {
  const [tipo, setTipo] = useState<TipoRelatorio>("participantes");
  return (
    <Tabs value={tipo} onValueChange={(v) => setTipo(v as TipoRelatorio)}>
      <TabsList className="mb-3 flex h-auto flex-wrap">
        <TabsTrigger value="participantes">Participantes</TabsTrigger>
        <TabsTrigger value="consultas">Consultas</TabsTrigger>
        <TabsTrigger value="premiacoes">Premiações</TabsTrigger>
        <TabsTrigger value="retiradas">Retiradas</TabsTrigger>
      </TabsList>
      {(["participantes", "consultas", "premiacoes", "retiradas"] as const).map((t) => (
        <TabsContent key={t} value={t}><Relatorio tipo={t} campanhas={campanhas} /></TabsContent>
      ))}
    </Tabs>
  );
}

function Relatorio({ tipo, campanhas }: { tipo: TipoRelatorio; campanhas: Campanha[] }) {
  const { user } = useAuth();
  const { pode } = usePermissoes(user?.id);
  const exportarFn = useServerFn(exportarRelatorioNumeroSorte);
  const [f, setF] = useState<Filtros>({ campanha: "", situacao: "", de: "", ate: "" });
  const [busca, setBusca] = useState("");
  const [premio, setPremio] = useState("");
  const [pagina, setPagina] = useState(0);
  const [detalhe, setDetalhe] = useState<{ campanha: string; cliente: string } | null>(null);
  const [exportando, setExportando] = useState(false);
  const p = intervaloPeriodo(f.de, f.ate);
  const args = {
    _tipo: tipo, _campanha: f.campanha || undefined, _de: p.de ?? undefined, _ate: p.ate ?? undefined,
    _situacao: f.situacao || undefined, _busca: busca.trim() || undefined, _premio: premio || undefined,
  };
  const { data: premios = [] } = useQuery({
    queryKey: ["numero-sorte", "premios-filtro", f.campanha],
    enabled: !!f.campanha && tipo !== "consultas" && tipo !== "participantes",
    queryFn: async () => (await supabase.from("numero_sorte_premios").select("id, nome").eq("campanha_id", f.campanha)).data ?? [],
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["numero-sorte", "relatorio", args, pagina],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("numero_sorte_relatorio", { ...args, _limite: 50, _offset: pagina * 50 });
      if (error) throw error;
      return data as unknown as { total: number; linhas: Linha[] };
    },
  });
  function mudar(n: Filtros) { setF(n); setPagina(0); }
  async function exportar() {
    setExportando(true);
    try {
      const r = await exportarFn({ data: {
        tipo, campanha: f.campanha || null, de: p.de, ate: p.ate, situacao: f.situacao || null,
        busca: busca.trim() || null, premio: premio || null,
      } });
      baixar(`numero-sorte-${tipo}.csv`, r.csv);
      toast.success(`${r.total} linha(s) exportada(s).`);
    } catch (e) { toast.error(erroTexto(e)); } finally { setExportando(false); }
  }
  const total = data?.total ?? 0;
  const linhas = data?.linhas ?? [];
  return (
    <>
      <BarraFiltros f={{ ...f, situacao: "" }} set={(n) => mudar({ ...n, situacao: f.situacao })} campanhas={campanhas} comSituacao={false} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-48"><Label>Cliente</Label><Input value={busca} placeholder="Nome do cliente" onChange={(e) => { setBusca(e.target.value); setPagina(0); }} /></div>
        <div className="min-w-48">
          <Label>{tipo === "consultas" ? "Resultado" : "Situação"}</Label>
          <Select value={f.situacao || TODAS} onValueChange={(v) => mudar({ ...f, situacao: v === TODAS ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {Object.entries(SITUACOES[tipo]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(tipo === "premiacoes" || tipo === "retiradas") && f.campanha && (
          <div className="min-w-48">
            <Label>Prêmio</Label>
            <Select value={premio || TODAS} onValueChange={(v) => { setPremio(v === TODAS ? "" : v); setPagina(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todos</SelectItem>
                {premios.map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {pode("numero_sorte.exportar") && (
          <Button variant="outline" disabled={exportando || total === 0} onClick={exportar}>
            <Download className="mr-2 h-4 w-4" /> {exportando ? "Gerando..." : "Exportar CSV"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{erroTexto(error)}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && !error && total === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>}
      {total > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <tbody>{linhas.map((l, i) => <LinhaRelatorio key={i} tipo={tipo} l={l} abrir={() => setDetalhe({ campanha: String(l.campanha_id), cliente: String(l.cliente_id) })} />)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {total > 50 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{pagina * 50 + 1}–{Math.min(total, pagina * 50 + 50)} de {total}</span>
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={(pagina + 1) * 50 >= total} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
        </div>
      )}
      {detalhe && <DetalheParticipante {...detalhe} fechar={() => setDetalhe(null)} />}
    </>
  );
}

function LinhaRelatorio({ tipo, l, abrir }: { tipo: TipoRelatorio; l: Linha; abrir: () => void }) {
  const camp = `Nº ${l.campanha_numero}`;
  if (tipo === "participantes") return (
    <tr className="border-t align-top">
      <td className="p-2"><p className="font-medium">{l.nome}</p><p className="text-xs text-muted-foreground">{l.telefone} · {l.cpf ?? "sem CPF"}</p></td>
      <td className="p-2 text-xs">{camp}<br />{l.consultas} consulta(s) · {l.distintos} número(s)</td>
      <td className="p-2 text-xs">1º {dataBr(l.primeiro_acesso as string)}<br />últ. {dataBr(l.ultima as string)}</td>
      <td className="p-2">{l.premiado ? <Badge>Premiado</Badge> : <Badge variant="outline">{SITUACOES.participantes[String(l.situacao)]}</Badge>}</td>
      <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={abrir}><Eye className="h-4 w-4" /></Button></td>
    </tr>
  );
  if (tipo === "consultas") return (
    <tr className="border-t">
      <td className="p-2 text-xs">{camp}</td><td className="p-2">{l.cliente ?? "—"}</td>
      <td className="p-2 font-mono">{l.numero}</td><td className="p-2 text-xs">{dataBr(l.criado_em as string)}</td>
      <td className="p-2"><Badge variant={l.resultado === "premiado" ? "default" : "outline"}>{ROTULO_RESULTADO[String(l.resultado)] ?? l.resultado}</Badge></td>
    </tr>
  );
  return (
    <tr className="border-t align-top">
      <td className="p-2 text-xs">{camp}</td>
      <td className="p-2"><p className="font-medium">{l.cliente}</p><p className="text-xs text-muted-foreground">{l.premio} · <span className="font-mono">{l.numero}</span></p></td>
      <td className="p-2 text-xs">Premiado {dataBr(l.reservado_em as string)}<br />Prazo {dataBr(l.prazo_em as string)}</td>
      <td className="p-2 text-xs">{l.entregue_em ? <>Entregue {dataBr(l.entregue_em as string)}<br />por {l.entregue_por ?? "—"}{l.excecao_prazo ? " (exceção)" : ""}</> : "—"}</td>
      <td className="p-2"><Badge variant="outline">{ROTULO_PREMIACAO[String(l.situacao)] ?? l.situacao}</Badge></td>
    </tr>
  );
}

type Detalhe = {
  cliente: { nome: string; telefone: string | null; cpf: string | null } | null;
  campanha: { numero: number; nome: string } | null;
  consultas: { numero: string; criado_em: string; resultado: string }[];
  premiacao: { premio: string; numero: string; situacao: string; reservado_em: string; prazo_em: string | null; entregue_em: string | null } | null;
};

function DetalheParticipante({ campanha, cliente, fechar }: { campanha: string; cliente: string; fechar: () => void }) {
  const { data, error } = useQuery({
    queryKey: ["numero-sorte", "detalhe", campanha, cliente],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("numero_sorte_detalhe_participante", { _campanha: campanha, _cliente: cliente });
      if (error) throw error;
      return data as unknown as Detalhe;
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{data?.cliente?.nome ?? "Participante"}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{erroTexto(error)}</p>}
        {data && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{data.cliente?.telefone} · {data.cliente?.cpf ?? "sem CPF"} · Campanha Nº {data.campanha?.numero} {data.campanha?.nome}</p>
            {data.premiacao && (
              <Card><CardContent className="p-3">
                <p className="font-semibold">{data.premiacao.premio} <span className="font-mono">({data.premiacao.numero})</span></p>
                <p className="text-xs">{ROTULO_PREMIACAO[data.premiacao.situacao]} · premiado {dataBr(data.premiacao.reservado_em)} · prazo {dataBr(data.premiacao.prazo_em)}{data.premiacao.entregue_em ? ` · entregue ${dataBr(data.premiacao.entregue_em)}` : ""}</p>
              </CardContent></Card>
            )}
            {data.consultas.length === 0 ? <p className="text-muted-foreground">Nenhuma consulta feita.</p> : (
              <ul className="divide-y">{data.consultas.map((c, i) => (
                <li key={i} className="flex justify-between gap-2 py-1.5">
                  <span className="font-mono">{c.numero}</span><span className="text-xs text-muted-foreground">{dataBr(c.criado_em)}</span>
                  <span className="text-xs">{ROTULO_RESULTADO[c.resultado] ?? c.resultado}</span>
                </li>))}</ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
