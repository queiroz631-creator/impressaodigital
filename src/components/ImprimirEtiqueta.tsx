import { useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
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
import { brl, dataHoraBR } from "@/lib/format";
import { resumoDoPedido } from "@/lib/etiqueta";
import { normalizarStatus, rotuloStatus } from "@/lib/status";

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
  const [salvando, setSalvando] = useState(false);

  const statusFinal = normalizarStatus(status);
  const resumo = useMemo(() => resumoDoPedido(itens), [itens]);

  const valorPagoNumero = Math.max(0, Number(String(pago).replace(",", ".")) || 0);
  const excedeu = valorPagoNumero > total;
  const restante = Math.max(0, total - valorPagoNumero);

  const situacaoPagamento =
    statusFinal === "pendente_pagamento"
      ? "NÃO PAGO"
      : statusFinal === "finalizado"
        ? valorPagoNumero <= 0
          ? "NÃO PAGO"
          : valorPagoNumero >= total
            ? "TOTAL"
            : "PARCIAL"
        : "-";

  async function imprimir() {
    if (excedeu) {
      toast.error("O valor pago não pode ser maior que o valor total.");
      return;
    }
    if (onSalvarPagamento && statusFinal === "finalizado") {
      setSalvando(true);
      try {
        await onSalvarPagamento(valorPagoNumero);
      } catch {
        toast.error("Não foi possível salvar o valor pago.");
      } finally {
        setSalvando(false);
      }
    }
    window.print();
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setPago(String(valorPago ?? 0));
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Etiqueta do pedido {numero}</DialogTitle>
          <DialogDescription>Impressão otimizada para impressora térmica de 80mm.</DialogDescription>
        </DialogHeader>

        {statusFinal === "finalizado" && (
          <div className="grid gap-2">
            <Label htmlFor="valor-pago">Valor pago (total ou parcial)</Label>
            <Input
              id="valor-pago"
              inputMode="decimal"
              value={pago}
              onChange={(e) => setPago(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            {excedeu && <p className="text-xs font-semibold text-destructive">Valor pago maior que o total.</p>}
          </div>
        )}

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
          {statusFinal === "finalizado" ? `\n\nVALOR PAGO:\n${brl(valorPagoNumero)}\n\nRESTANTE:\n${brl(restante)}` : ""}
          {"\n"}
          {linha}
          {"\n\n"}ATENDENTE:{"\n"}
          {"____________________________"}
          {"\n\n"}
          {linhaDupla}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Fechar
          </Button>
          <Button onClick={imprimir} disabled={salvando || excedeu}>
            <Printer className="h-4 w-4" /> Imprimir etiqueta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}