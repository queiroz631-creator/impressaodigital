import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Printer, PrinterCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, dataHoraBR } from "@/lib/format";
import { resumoDoPedido } from "@/lib/etiqueta";
import { normalizarStatus, rotuloStatus } from "@/lib/status";
import { useConfiguracao } from "@/hooks/useDados";
import { useAuth } from "@/hooks/useAuth";
import { escolherImpressora, imprimirEtiqueta, listarImpressoras } from "@/lib/impressora";

interface Props {
  children: ReactNode;
  numero: string;
  clienteNome: string;
  clienteTelefone?: string | null;
  data: string;
  status: string;
  total: number;
  valorPago?: number;
  itens: Record<string, unknown>[];
  onSalvarPagamento?: (valorPago: number) => Promise<void> | void;
}

const linha = "--------------------------------";
const linhaDupla = "================================";

export function ImprimirEtiqueta({
  children,
  numero,
  clienteNome,
  clienteTelefone,
  data,
  status,
  total,
  valorPago = 0,
  itens,
  onSalvarPagamento,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [pago, setPago] = useState(String(valorPago ?? 0));
  const [atendente, setAtendente] = useState("");
  const [impressora, setImpressora] = useState<string>("");
  const [disponiveis, setDisponiveis] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { user } = useAuth();
  const { data: config } = useConfiguracao();

  const configuradas = useMemo(() => {
    const lista = Array.isArray(config?.impressoras_padrao)
      ? (config?.impressoras_padrao as unknown[]).map((n) => String(n)).filter(Boolean)
      : [];
    const padrao = config?.impressora_padrao_nome?.trim();
    if (padrao && !lista.includes(padrao)) lista.unshift(padrao);
    return lista;
  }, [config]);

  const opcoes = useMemo(
    () => Array.from(new Set([...configuradas, ...disponiveis])),
    [configuradas, disponiveis],
  );

  const statusFinal = normalizarStatus(status);
  const resumo = useMemo(() => resumoDoPedido(itens), [itens]);

  const valorPagoNumero = Math.max(0, Number(String(pago).replace(",", ".")) || 0);
  const excedeu = valorPagoNumero > total;
  const restante = Math.max(0, total - valorPagoNumero);

  const situacaoPagamento =
    valorPagoNumero <= 0 ? "NÃO PAGO" : valorPagoNumero >= total ? "PAGO" : "PARCIAL";

  useEffect(() => {
    if (!aberto) return;
    setPago(String(valorPago ?? 0));
    setImpressora(configuradas[0] ?? "");
    const nome =
      (user?.user_metadata?.["nome"] as string | undefined) ??
      (user?.user_metadata?.["full_name"] as string | undefined) ??
      (user?.email ? user.email.split("@")[0]! : "");
    setAtendente((atual) => atual || nome || "");
    listarImpressoras().then(setDisponiveis).catch(() => setDisponiveis([]));
  }, [aberto, valorPago, configuradas, user]);

  async function executarImpressao(escolher: boolean) {
    if (excedeu) {
      toast.error("O valor pago não pode ser maior que o valor total.");
      return;
    }
    if (onSalvarPagamento) {
      setSalvando(true);
      try {
        await onSalvarPagamento(valorPagoNumero);
      } catch {
        toast.error("Não foi possível salvar o valor pago.");
      } finally {
        setSalvando(false);
      }
    }

    if (escolher) {
      escolherImpressora();
      return;
    }
    const resultado = await imprimirEtiqueta("", impressora || null);
    if (resultado.mensagem) toast.info(resultado.mensagem);
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imprimir etiqueta — pedido {numero}</DialogTitle>
          <DialogDescription>
            Informe o pagamento e imprima na térmica de 80mm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border border-border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">{clienteNome || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor total</span>
            <span className="font-semibold">{brl(total)}</span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="valor-pago" className="text-xs">Valor pago</Label>
            <Input
              id="valor-pago"
              inputMode="decimal"
              className="h-8 w-40 text-sm"
              value={pago}
              onChange={(e) => setPago(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            {excedeu && (
              <p className="text-xs font-semibold text-destructive">
                Valor pago maior que o total.
              </p>
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-semibold">
              {situacaoPagamento === "PARCIAL" ? "PAGAMENTO PARCIAL" : situacaoPagamento}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Restante</span>
            <span className="font-semibold">{brl(restante)}</span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="atendente">Atendente</Label>
            <Input
              id="atendente"
              value={atendente}
              onChange={(e) => setAtendente(e.target.value)}
              placeholder="Nome do atendente"
            />
          </div>

          <div className="grid gap-2">
            <Label>Impressora</Label>
            {opcoes.length > 0 ? (
              <Select value={impressora} onValueChange={setImpressora}>
                <SelectTrigger>
                  <SelectValue placeholder="Impressora padrão" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma impressora configurada. Será usada a impressora escolhida na janela do
                navegador.
              </p>
            )}
          </div>
        </div>

        {/* ETIQUETA */}
        <div
          id="etiqueta-print"
          className="etiqueta-80mm mx-auto rounded-lg border border-border bg-card p-3 text-foreground"
        >
          {linhaDupla}
          {"\n"}PEDIDO {numero}
          {"\n"}
          {linhaDupla}
          {"\n"}STATUS: {rotuloStatus[statusFinal] ?? statusFinal}
          {"\n\n"}CLIENTE:{"\n"}
          {clienteNome || "-"}
          {"\n\n"}DATA:{"\n"}
          {dataHoraBR(data)}
          {"\n\n"}TELEFONE:{"\n"}
          {clienteTelefone || "-"}
          {"\n"}
          {linha}
          {"\n"}DESCRIÇÃO:{"\n"}
          {resumo.linhas.map((l) => `- ${l}\n`).join("")}
          {`${resumo.arquivos} arquivo(s)\n`}
          {`${resumo.paginasAdicionais} página(s) adicionais\n`}
          {`${resumo.copiasAdicionais} cópia(s) adicionais\n`}
          {`Total de páginas = ${resumo.paginasTotal}\n`}
          {resumo.acabamentos.length > 0 ? `Acabamentos: ${resumo.acabamentos.join(", ")}\n` : ""}
          {linha}
          {"\n\n"}VALOR TOTAL:{"\n"}
          {brl(total)}
          {"\n\n"}PAGAMENTO:{"\n"}
          {situacaoPagamento}
          {"\n\n"}VALOR PAGO:{"\n"}
          {brl(valorPagoNumero)}
          {"\n\n"}
          <span className="etiqueta-tarja">RESTANTE: {brl(restante)}</span>
          {"\n"}
          {linha}
          {"\n\n"}ATENDENTE:{"\n"}
          {atendente || "____________________________"}
          {"\n\n"}
          {linhaDupla}
          {"\n"}
          {"          OBRIGADO!"}
          {"\n"}
          {linhaDupla}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setAberto(false)}>
            Fechar
          </Button>
          <Button variant="secondary" onClick={() => executarImpressao(true)} disabled={excedeu}>
            <Printer className="h-4 w-4" /> Escolher impressora
          </Button>
          <Button onClick={() => executarImpressao(false)} disabled={salvando || excedeu}>
            <PrinterCheck className="h-4 w-4" /> Imprimir na padrão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
