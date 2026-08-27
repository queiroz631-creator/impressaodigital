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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { brl, dataHoraBR } from "@/lib/format";
import { resumoDoPedido } from "@/lib/etiqueta";
import { normalizarStatus, rotuloStatus } from "@/lib/status";
import { useConfiguracao } from "@/hooks/useDados";
import { useAuth } from "@/hooks/useAuth";
import { escolherImpressora, imprimirEtiqueta, listarImpressoras, statusQz } from "@/lib/impressora";

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
  const [qzAtivo, setQzAtivo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { user } = useAuth();
  const { data: config } = useConfiguracao();

  /*
   * Impressoras configuradas no sistema.
   */
  const configuradas = useMemo(() => {
    const lista = Array.isArray(config?.impressoras_padrao)
      ? (config.impressoras_padrao as unknown[]).map((n) => String(n)).filter(Boolean)
      : [];

    const padrao = config?.impressora_padrao_nome?.trim();

    if (padrao && !lista.includes(padrao)) {
      lista.unshift(padrao);
    }

    return lista;
  }, [config]);

  const opcoes = useMemo(() => Array.from(new Set([...configuradas, ...disponiveis])), [configuradas, disponiveis]);

  const statusFinal = normalizarStatus(status);

  const resumo = useMemo(() => resumoDoPedido(itens), [itens]);

  /*
   * Valor pago digitado pelo usuário.
   *
   * Aceita:
   * 10
   * 10,50
   * 10.50
   */
  const valorPagoNumero = Math.max(0, Number(String(pago).replace(",", ".")) || 0);

  const excedeu = valorPagoNumero > total;

  const restante = Math.max(0, total - valorPagoNumero);

  /*
   * Situação do pagamento.
   */
  const situacaoPagamento = valorPagoNumero <= 0 ? "NÃO PAGO" : valorPagoNumero >= total ? "PAGO" : "PARCIAL";

  /*
   * Inicializa os dados quando o diálogo abre.
   */
  useEffect(() => {
    if (!aberto) return;

    setPago(String(valorPago ?? 0));

    setImpressora(configuradas[0] ?? "");

    const nome =
      (user?.user_metadata?.["nome"] as string | undefined) ??
      (user?.user_metadata?.["full_name"] as string | undefined) ??
      (user?.email ? user.email.split("@")[0] : "");

    setAtendente((atual) => atual || nome || "");

    statusQz()
      .then((status) => {
        setQzAtivo(status === "conectado");
        if (status !== "conectado") return [];
        return listarImpressoras();
      })
      .then((lista) => setDisponiveis(lista ?? []))
      .catch(() => setDisponiveis([]));
  }, [aberto, valorPago, configuradas, user]);

  /*
   * Executa a impressão.
   */
  async function executarImpressao(escolher: boolean) {
    if (excedeu) {
      toast.error("O valor pago não pode ser maior que o valor total.");
      return;
    }

    /*
     * Salva o pagamento antes da impressão.
     */
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

    /*
     * Escolher impressora.
     */
    if (escolher) {
      escolherImpressora();
      return;
    }

    /*
     * Imprimir na impressora padrão, respeitando o método configurado.
     */
    const metodoConfig = config?.impressora_padrao_tipo === "qz" ? "qz" : "navegador";

    if (metodoConfig === "qz" && !impressora) {
      toast.error(
        "Nenhuma impressora configurada para a impressão direta. Ajuste em Configurações → Impressão.",
      );
      return;
    }

    const resultado = await imprimirEtiqueta(
      "",
      metodoConfig === "qz" ? impressora : null,
    );

    if (resultado.mensagem) {
      toast.info(resultado.mensagem);
    }
  }


  return (
    <>
      {/*
       * CSS específico da impressão térmica.
       *
       * O objetivo é impedir que estilos da interface,
       * como texto cinza, opacity, sombras e cores claras,
       * sejam enviados para a impressora.
       */}
      <style>
        {`
          /*
           * PREVIEW DA ETIQUETA
           */
          .etiqueta-80mm {
            width: 80mm;
            max-width: 80mm;
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
            font-family: "Courier New", Courier, monospace;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.35;
            letter-spacing: 0;
            opacity: 1;
            text-shadow: none;
          }

          .etiqueta-80mm * {
            color: #000000;
            opacity: 1;
            text-shadow: none;
            box-shadow: none;
          }

          .etiqueta-tarja {
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 4px 5px;
            margin: 4px 0;
            background: #000000;
            color: #ffffff !important;
            font-weight: 900;
            text-align: left;
          }

          /* As regras de impressão ficam em src/styles.css (@media print). */
        `}
      </style>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger asChild>{children}</DialogTrigger>

        <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-md flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Imprimir etiqueta — pedido {numero}</DialogTitle>

            <DialogDescription>Informe o pagamento e imprima na térmica de 80mm.</DialogDescription>
          </DialogHeader>

          {/*
           * DADOS DO PAGAMENTO
           */}
          <div className="grid gap-2 rounded-lg border border-border p-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Cliente</span>

              <span className="max-w-[200px] break-words text-right font-medium">{clienteNome || "-"}</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Valor total</span>

              <span className="text-right font-semibold">{brl(total)}</span>
            </div>

            {/*
             * VALOR PAGO
             */}
            <div className="grid gap-1">
              <Label htmlFor="valor-pago" className="text-xs">
                Valor pago
              </Label>

              <Input
                id="valor-pago"
                inputMode="decimal"
                className="h-8 w-28 text-sm"
                value={pago}
                onChange={(e) => setPago(e.target.value.replace(/[^\d.,]/g, ""))}
              />

              {excedeu && <p className="text-xs font-semibold text-destructive">Valor pago maior que o total.</p>}
            </div>

            {/*
             * STATUS DO PAGAMENTO
             */}
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Status</span>

              <span className="text-right font-semibold">
                {situacaoPagamento === "PARCIAL" ? "PAGAMENTO PARCIAL" : situacaoPagamento}
              </span>
            </div>

            {/*
             * RESTANTE
             */}
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Restante</span>

              <span className="text-right font-semibold">{brl(restante)}</span>
            </div>

            {/*
             * ATENDENTE
             */}
            <div className="grid gap-1">
              <Label htmlFor="atendente" className="text-xs">
                Atendente
              </Label>

              <Input
                id="atendente"
                className="h-8 w-40 text-sm"
                value={atendente}
                onChange={(e) => setAtendente(e.target.value)}
                placeholder="Nome do atendente"
              />
            </div>

            {/*
             * IMPRESSORA
             */}
            <div className="grid gap-1">
              <Label className="text-xs">Impressora</Label>

              {opcoes.length > 0 ? (
                <Select value={impressora} onValueChange={setImpressora}>
                  <SelectTrigger className="h-8">
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

              <p className="text-xs text-muted-foreground">
                {qzAtivo
                  ? "Impressão direta ativa (QZ Tray): a etiqueta sai direto na impressora."
                  : "Impressão pela janela do navegador (QZ Tray não detectado)."}
              </p>
            </div>
          </div>

          {/*
           * ==========================================
           * PRÉVIA DA ETIQUETA
           * ==========================================
           */}
          <div
            id="etiqueta-print"
            className="etiqueta-80mm mx-auto w-full max-w-[300px] overflow-hidden rounded-lg border border-border bg-white p-2 text-black"
          >
            {linhaDupla}
            {"\n"}PEDIDO {numero}
            {"\n"}
            {linhaDupla}
            {"\n"}STATUS: {rotuloStatus[statusFinal] ?? statusFinal}
            {"\n\n"}CLIENTE:
            {"\n"}
            {clienteNome || "-"}
            {"\n\n"}DATA:
            {"\n"}
            {dataHoraBR(data)}
            {"\n\n"}TELEFONE:
            {"\n"}
            {clienteTelefone || "-"}
            {"\n"}
            {linha}
            {"\n"}DESCRIÇÃO:
            {"\n"}
            {resumo.linhas.map((l) => `- ${l}\n`).join("")}
            {`${resumo.arquivos} arquivo(s)\n`}
            {`${resumo.paginasAdicionais} página(s) adicionais\n`}
            {`${resumo.copiasAdicionais} cópia(s) adicionais\n`}
            {`Total de páginas = ${resumo.paginasTotal}\n`}
            {resumo.acabamentos.length > 0 ? `Acabamentos: ${resumo.acabamentos.join(", ")}\n` : ""}
            {linha}
            {"\n\n"}VALOR TOTAL:
            {"\n"}
            {brl(total)}
            {"\n\n"}PAGAMENTO:
            {"\n"}
            {situacaoPagamento}
            {"\n\n"}VALOR PAGO:
            {"\n"}
            {brl(valorPagoNumero)}
            {"\n\n"}
            <span className="etiqueta-tarja">RESTANTE: {brl(restante)}</span>
            {"\n"}
            {linha}
            {"\n\n"}ATENDENTE:
            {"\n"}
            {atendente || "____________________________"}
            {"\n\n"}
            {linhaDupla}
            {"\n"}
            {"          OBRIGADO!"}
            {"\n"}
            {linhaDupla}
          </div>

          {/*
           * BOTÕES
           */}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setAberto(false)}>
              Fechar
            </Button>

            <Button variant="secondary" onClick={() => executarImpressao(true)} disabled={excedeu || salvando}>
              <Printer className="h-4 w-4" />
              Escolher impressora
            </Button>

            <Button onClick={() => executarImpressao(false)} disabled={salvando || excedeu}>
              <PrinterCheck className="h-4 w-4" />

              {salvando ? "Salvando..." : "Imprimir na padrão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
