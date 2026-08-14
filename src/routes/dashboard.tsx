import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calculator, FileText, DollarSign, Printer } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalculos, useOrcamentos } from "@/hooks/useDados";
import { brl, dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Dashboard | Calculadora de Impressão Digital" },
      {
        name: "description",
        content: "Acompanhe cálculos do dia, orçamentos gerados e materiais mais utilizados.",
      },
      { property: "og:title", content: "Dashboard | Calculadora de Impressão Digital" },
      { property: "og:description", content: "Indicadores de cálculos e orçamentos de impressão." },
    ],
  }),
});

function Dashboard() {
  const { data: calculos, isLoading } = useCalculos();
  const { data: orcamentos } = useOrcamentos();

  const stats = useMemo(() => {
    const lista = calculos ?? [];
    const hoje = new Date().toDateString();
    const doDia = lista.filter((c) => new Date(c.created_at).toDateString() === hoje);
    const total = lista.reduce((acc, c) => acc + Number(c.valor_total ?? 0), 0);
    const ranking = new Map<string, number>();
    for (const c of lista) {
      if (!c.material_nome) continue;
      ranking.set(c.material_nome, (ranking.get(c.material_nome) ?? 0) + 1);
    }
    const materiais = [...ranking.entries()]
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);
    return { doDia: doDia.length, total, materiais, ultimos: lista.slice(0, 6) };
  }, [calculos]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      <PageHeader titulo="DASHBOARD" subtitulo="Visão geral dos cálculos e orçamentos." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icon={<Calculator className="h-5 w-5 text-primary" />} titulo="Cálculos hoje" valor={String(stats.doDia)} />
        <Indicador
          icon={<FileText className="h-5 w-5 text-cyan-ink" />}
          titulo="Orçamentos gerados"
          valor={String(orcamentos?.length ?? 0)}
        />
        <Indicador
          icon={<DollarSign className="h-5 w-5 text-success" />}
          titulo="Valor total calculado"
          valor={brl(stats.total)}
        />
        <Indicador
          icon={<Printer className="h-5 w-5 text-magenta-ink" />}
          titulo="Cálculos registrados"
          valor={String(calculos?.length ?? 0)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Materiais mais utilizados</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {stats.materiais.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum cálculo registrado ainda.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.materiais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" hide />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Últimos cálculos</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.ultimos.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum cálculo realizado ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {stats.ultimos.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.cliente_nome || "Sem cliente"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.material_nome} • {dataHoraBR(c.created_at)}
                      </p>
                    </div>
                    <span className="font-bold text-success">{brl(Number(c.valor_total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Indicador({
  icon,
  titulo,
  valor,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-4 py-5">
        <span className="rounded-full bg-accent p-3">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{titulo}</p>
          <p className="text-2xl font-extrabold text-primary">{valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}