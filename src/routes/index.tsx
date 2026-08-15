import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calculator,
  Files,
  FileStack,
  RefreshCw,
  FileText,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Layers,
  Info,
  Printer,
  Paperclip,
  Scissors,
} from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcabamentos, useMateriais } from "@/hooks/useDados";
import {
  TAMANHOS,
  calcularAcabamentos,
  calcularLinhas,
  resumoLinhas,
  rotuloCobranca,
  totalAcabamentos,
  type SelecaoAcabamento,
} from "@/lib/calc";
import { contarPaginas } from "@/lib/contagem";
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
        content: "Informe arquivos, páginas e tipo de impressão e veja o valor por página e o total de cada tipo de papel.",
      },
    ],
  }),
});

function CalculadoraPage() {
  return (
    <AppLayout>
      <Calculadora />
    </AppLayout>
  );
}

function Calculadora() {
  const { data: materiais, isLoading } = useMateriais(true);
  const { data: acabamentos } = useAcabamentos(true);
  const queryClient = useQueryClient();
  const [arquivos, setArquivos] = useState(0);
  const [paginas, setPaginas] = useState(0);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [selecao, setSelecao] = useState<Record<string, SelecaoAcabamento>>({});
  const [frenteVerso, setFrenteVerso] = useState(false);
  const [tamanho, setTamanho] = useState<string>("A4");
  const [tamanhoOutro, setTamanhoOutro] = useState("");
  const [lendoArquivos, setLendoArquivos] = useState(false);
  const inputArquivos = useRef<HTMLInputElement>(null);

  const entrada = {
    tipo: "pb" as const,
    paginasTotal: paginas,
    paginasPb: paginas,
    paginasColor: 0,
    arquivos,
  };
  const totalPaginas = paginas;

  const linhas = useMemo(
    () => calcularLinhas(materiais ?? [], entrada),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materiais, paginas, arquivos],
  );

  const linhasAcabamento = useMemo(
    () => calcularAcabamentos(acabamentos ?? [], selecao, { paginas }),
    [acabamentos, selecao, paginas],
  );
  const valorAcabamento = totalAcabamentos(linhasAcabamento);
  const tamanhoFinal = tamanho === "Outro" ? tamanhoOutro.trim() || "Outro" : tamanho;

  const linhasFinais = useMemo(
    () => linhas.map((l) => ({ ...l, total: l.total + valorAcabamento })),
    [linhas, valorAcabamento],
  );
  const resumo = resumoLinhas(linhasFinais);
  const semPaginas = totalPaginas <= 0;

  const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, "")) || 0);

  async function anexar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLendoArquivos(true);
    try {
      const r = await contarPaginas(Array.from(files));
      setArquivos(r.arquivos);
      setPaginas(r.paginas);
      if (r.ignorados.length > 0) {
        toast.warning(`Arquivos ignorados: ${r.ignorados.join(", ")}`);
      }
      if (r.arquivos > 0) {
        toast.success(`${r.arquivos} arquivo(s) e ${r.paginas} página(s) contabilizados.`);
      }
    } catch {
      toast.error("Não foi possível ler os arquivos.");
    } finally {
      setLendoArquivos(false);
      if (inputArquivos.current) inputArquivos.current.value = "";
    }
  }

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
            <div className="space-y-4">
              <div>
                <input
                  ref={inputArquivos}
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => anexar(e.target.files)}
                />
                <Button
                  variant="outline"
                  disabled={lendoArquivos}
                  onClick={() => inputArquivos.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                  {lendoArquivos ? "Lendo arquivos..." : "Anexar PDFs / Imagens"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  As páginas dos PDFs são contadas automaticamente; cada imagem conta como 1 página.
                </p>
              </div>
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
              </div>
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
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <dt className="text-muted-foreground">Acabamento</dt>
                  <dd className="text-lg font-extrabold text-primary">{brl(valorAcabamento)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-wide">
            <span className="rounded-lg bg-accent p-2 text-primary">
              <Scissors className="h-4 w-4" />
            </span>
            ACABAMENTO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(acabamentos ?? []).map((a) => {
              const sel = selecao[a.id] ?? { ativo: false, quantidade: 1 };
              const linha = linhasAcabamento.find((l) => l.acabamento.id === a.id);
              return (
                <div key={a.id} className="rounded-xl border border-border p-4">
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={sel.ativo}
                      onCheckedChange={(v) =>
                        setSelecao((s) => ({ ...s, [a.id]: { ...sel, ativo: v === true } }))
                      }
                    />
                    <span className="font-semibold">{a.nome}</span>
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rotuloCobranca[a.cobranca]} · {brl(Number(a.valor) || 0)}
                    {a.cobranca === "bloco" ? ` a cada ${a.paginas_bloco} páginas` : ""}
                  </p>
                  {sel.ativo && a.cobranca === "quantidade" && (
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">Quantidade</Label>
                      <Input
                        inputMode="numeric"
                        value={sel.quantidade}
                        onChange={(e) =>
                          setSelecao((s) => ({
                            ...s,
                            [a.id]: { ...sel, quantidade: num(e.target.value) },
                          }))
                        }
                        className="mt-1 font-bold"
                      />
                    </div>
                  )}
                  {sel.ativo && (
                    <p className="mt-2 text-sm font-bold text-success">{brl(linha?.total ?? 0)}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-semibold">Frente e verso</p>
                <p className="text-xs text-muted-foreground">Informado no orçamento</p>
              </div>
              <Switch checked={frenteVerso} onCheckedChange={setFrenteVerso} />
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <Label className="text-xs font-semibold text-muted-foreground">Tamanho</Label>
              <Select value={tamanho} onValueChange={setTamanho}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAMANHOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tamanho === "Outro" && (
                <Input
                  placeholder="Informe o tamanho"
                  value={tamanhoOutro}
                  onChange={(e) => setTamanhoOutro(e.target.value)}
                />
              )}
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
            <Button disabled={semPaginas || linhasFinais.length === 0} onClick={() => setDialogAberto(true)}>
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
                    <th className="px-4 py-3 text-right">PREÇO UNI</th>
                    <th className="rounded-r-lg px-4 py-3 text-right">
                      TOTAL ({numeroBR(totalPaginas)} PÁGINAS)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFinais.map((l) => (
                    <tr key={l.material.id} className="bg-card shadow-xs">
                      <td className="rounded-l-lg border-y border-l border-border px-4 py-3 font-semibold">
                        {l.material.nome}
                      </td>
                      <td className="border-y border-border px-4 py-3 text-muted-foreground">
                        {l.material.descricao}
                      </td>
                      <td className="border-y border-border px-4 py-3 text-right font-semibold">
                        {brl(l.valorUnitarioPb)}
                      </td>
                      <td className="rounded-r-lg border-y border-r border-border px-4 py-3 text-right font-extrabold text-success">
                        {brl(l.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        linhas={linhasFinais}
        arquivos={arquivos}
        tipo="pb"
        paginasPb={paginas}
        paginasColor={0}
        tamanho={tamanhoFinal}
        frenteVerso={frenteVerso}
        valorAcabamento={valorAcabamento}
        acabamentos={linhasAcabamento.map((l) => `${l.acabamento.nome} (${l.quantidade}x)`)}
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
