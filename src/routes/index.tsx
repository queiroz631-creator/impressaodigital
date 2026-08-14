import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calculator,
  Files,
  FileStack,
  Palette,
  RefreshCw,
  FileText,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Layers,
  Info,
  Printer,
} from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMateriais } from "@/hooks/useDados";
import { calcularLinhas, resumoLinhas, paginasEfetivas, type TipoImpressao } from "@/lib/calc";
import { brl, numeroBR } from "@/lib/format";
import { OrcamentoDialog } from "@/components/OrcamentoDialog";

export const Route = createFileRoute("/")({
  component: CalculadoraPage,
  head: () => ({
    meta: [
      { title: "Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Informe arquivos, páginas e tipo de impressão e veja o valor por página e o total de cada tipo de papel.",
      },
      { property: "og:title", content: "Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Valores de impressão por tipo de papel, com orçamento em PDF.",
      },
    ],
  }),
});

const TIPOS: { value: TipoImpressao; label: string }[] = [
  { value: "pb", label: "PB (Preto e Branco)" },
  { value: "color", label: "Colorida" },
  { value: "ambas", label: "Ambas (PB e Color)" },
];

function CalculadoraPage() {
  return (
    <AppLayout>
      <Calculadora />
    </AppLayout>
  );
}

function Calculadora() {
  const { data: materiais, isLoading } = useMateriais(true);
  const queryClient = useQueryClient();
  const [arquivos, setArquivos] = useState(10);
  const [paginas, setPaginas] = useState(250);
  const [paginasPb, setPaginasPb] = useState(150);
  const [paginasColor, setPaginasColor] = useState(100);
  const [tipo, setTipo] = useState<TipoImpressao>("ambas");
  const [dialogAberto, setDialogAberto] = useState(false);

  const entrada = { tipo, paginasTotal: paginas, paginasPb, paginasColor };
  const totalPaginas = tipo === "ambas" ? paginasPb + paginasColor : paginas;

  const linhas = useMemo(
    () => calcularLinhas(materiais ?? [], entrada),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materiais, tipo, paginas, paginasPb, paginasColor],
  );
  const resumo = resumoLinhas(linhas);
  const efetivas = paginasEfetivas(entrada);
  const semPaginas = totalPaginas <= 0;

  const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, "")) || 0);

  return (
    <>
      <PageHeader
        titulo="CALCULADORA DE IMPRESSÃO DIGITAL"
        subtitulo="Informe os dados do seu trabalho e veja os valores por tipo de papel."
      />

      <Card className="mb-6 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
            <span className="rounded-lg bg-accent p-2 text-primary">
              <Calculator className="h-4 w-4" />
            </span>
            DADOS DO TRABALHO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Campo
                icon={<Files className="h-4 w-4 text-cyan-ink" />}
                label="Quantidade de arquivos"
                sufixo="arquivos"
              >
                <Input
                  inputMode="numeric"
                  value={arquivos}
                  onChange={(e) => setArquivos(num(e.target.value))}
                  className="text-xl font-bold"
                />
              </Campo>

              {tipo === "ambas" ? (
                <>
                  <Campo
                    icon={<FileStack className="h-4 w-4 text-navy" />}
                    label="Páginas PB"
                    sufixo="páginas"
                  >
                    <Input
                      inputMode="numeric"
                      value={paginasPb}
                      onChange={(e) => setPaginasPb(num(e.target.value))}
                      className="text-xl font-bold"
                    />
                  </Campo>
                  <Campo
                    icon={<Palette className="h-4 w-4 text-magenta-ink" />}
                    label="Páginas coloridas"
                    sufixo="páginas"
                  >
                    <Input
                      inputMode="numeric"
                      value={paginasColor}
                      onChange={(e) => setPaginasColor(num(e.target.value))}
                      className="text-xl font-bold"
                    />
                  </Campo>
                </>
              ) : (
                <Campo
                  icon={<FileStack className="h-4 w-4 text-navy" />}
                  label="Quantidade total de páginas"
                  sufixo="páginas"
                >
                  <Input
                    inputMode="numeric"
                    value={paginas}
                    onChange={(e) => setPaginas(num(e.target.value))}
                    className="text-xl font-bold"
                  />
                </Campo>
              )}

              <Campo icon={<Palette className="h-4 w-4 text-yellow-ink" />} label="Tipo de impressão">
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoImpressao)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            </div>

            <div className="rounded-xl border border-border bg-accent/60 p-5">
              <p className="text-center text-sm font-bold tracking-widest text-primary">RESUMO</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Total de arquivos</dt>
                  <dd className="text-2xl font-extrabold text-primary">{numeroBR(arquivos)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <dt className="text-muted-foreground">Total de páginas</dt>
                  <dd className="text-2xl font-extrabold text-primary">{numeroBR(totalPaginas)}</dd>
                </div>
                {tipo === "ambas" && (
                  <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>PB {numeroBR(efetivas.pb)}</span>
                    <span>Color {numeroBR(efetivas.color)}</span>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-card">
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
            <span className="rounded-lg bg-accent p-2 text-primary">
              <Printer className="h-4 w-4" />
            </span>
            VALORES DE IMPRESSÃO
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["materiais"] });
                toast.success("Cálculo atualizado com sucesso.");
              }}
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button disabled={semPaginas || linhas.length === 0} onClick={() => setDialogAberto(true)}>
              <FileText className="h-4 w-4" /> Gerar Orçamento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : semPaginas ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Printer className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Nenhum cálculo realizado ainda</p>
              <p className="text-sm text-muted-foreground">
                Informe a quantidade de páginas para calcular.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-sm">
                <thead>
                  <tr className="bg-navy text-left text-xs font-bold tracking-wider text-navy-foreground">
                    <th className="rounded-l-lg px-4 py-3">MATERIAL</th>
                    <th className="px-4 py-3">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-right">VALOR POR PÁGINA</th>
                    <th className="rounded-r-lg px-4 py-3 text-right">
                      TOTAL ({numeroBR(totalPaginas)} PÁGINAS)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.material.id} className="bg-card shadow-xs">
                      <td className="rounded-l-lg border-y border-l border-border px-4 py-3 font-semibold">
                        {l.material.nome}
                      </td>
                      <td className="border-y border-border px-4 py-3 text-muted-foreground">
                        {l.material.descricao}
                      </td>
                      <td className="border-y border-border px-4 py-3 text-right font-semibold">
                        {tipo === "ambas"
                          ? `${brl(l.valorUnitarioPb)} / ${brl(l.valorUnitarioColor)}`
                          : brl(l.valorUnitario)}
                      </td>
                      <td className="rounded-r-lg border-y border-r border-border px-4 py-3 text-right font-extrabold text-success">
                        {brl(l.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tipo === "ambas" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Valor por página exibido como PB / Colorido. O total soma {numeroBR(efetivas.pb)}{" "}
                  páginas PB e {numeroBR(efetivas.color)} coloridas.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {resumo && !semPaginas && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardResumo
            icon={<TrendingDown className="h-5 w-5 text-success" />}
            titulo={`MENOR VALOR (${numeroBR(totalPaginas)} pág.)`}
            valor={brl(resumo.menor.total)}
            detalhe={resumo.menor.material.nome}
          />
          <CardResumo
            icon={<TrendingUp className="h-5 w-5 text-cyan-ink" />}
            titulo={`MAIOR VALOR (${numeroBR(totalPaginas)} pág.)`}
            valor={brl(resumo.maior.total)}
            detalhe={resumo.maior.material.nome}
          />
          <CardResumo
            icon={<BarChart3 className="h-5 w-5 text-primary" />}
            titulo="MÉDIA DE VALORES"
            valor={brl(resumo.media)}
            detalhe="Entre todos os materiais"
          />
          <CardResumo
            icon={<Layers className="h-5 w-5 text-magenta-ink" />}
            titulo="TOTAL DE PÁGINAS"
            valor={numeroBR(totalPaginas)}
            detalhe="páginas"
          />
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border bg-accent/60 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Os valores podem ser alterados a qualquer momento na tela de configuração de preços.
      </div>

      <OrcamentoDialog
        aberto={dialogAberto}
        onOpenChange={setDialogAberto}
        linhas={linhas}
        arquivos={arquivos}
        tipo={tipo}
        paginasPb={efetivas.pb}
        paginasColor={efetivas.color}
      />
    </>
  );
}

function Campo({
  icon,
  label,
  sufixo,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  sufixo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
      {sufixo && <p className="text-xs text-muted-foreground">{sufixo}</p>}
    </div>
  );
}

function CardResumo({
  icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-4 py-5">
        <span className="rounded-full bg-accent p-3">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground">
            {titulo}
          </p>
          <p className="text-2xl font-extrabold text-primary">{valor}</p>
          <p className="truncate text-xs text-muted-foreground">{detalhe}</p>
        </div>
      </CardContent>
    </Card>
  );
}
