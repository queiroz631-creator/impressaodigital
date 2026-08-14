import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useConfiguracao } from "@/hooks/useDados";
import type { LinhaCalculo, TipoImpressao } from "@/lib/calc";
import { brl } from "@/lib/format";
import { gerarOrcamentoPdf } from "@/lib/pdf";

const rotuloTipo: Record<TipoImpressao, string> = {
  pb: "PB (Preto e Branco)",
  color: "Colorida",
  ambas: "Ambas (PB e Color)",
};

interface Props {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  linhas: LinhaCalculo[];
  arquivos: number;
  tipo: TipoImpressao;
  paginasPb: number;
  paginasColor: number;
}

export function OrcamentoDialog({
  aberto,
  onOpenChange,
  linhas,
  arquivos,
  tipo,
  paginasPb,
  paginasColor,
}: Props) {
  const { data: config } = useConfiguracao();
  const queryClient = useQueryClient();
  const [materialId, setMaterialId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [validade, setValidade] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    if (linhas[0]) setMaterialId((atual) => atual || linhas[0]!.material.id);
    const dias = config?.validade_padrao_dias ?? 7;
    const d = new Date();
    d.setDate(d.getDate() + dias);
    setValidade(d.toISOString().slice(0, 10));
  }, [aberto, linhas, config]);

  const linha = linhas.find((l) => l.material.id === materialId) ?? linhas[0];
  const totalPaginas = paginasPb + paginasColor;

  async function gerar() {
    if (!linha) return;
    if (!nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSalvando(true);
    try {
      const { data: calculo, error: calcError } = await supabase
        .from("calculos")
        .insert({
          cliente_nome: nome,
          cliente_telefone: telefone,
          quantidade_arquivos: arquivos,
          paginas_total: totalPaginas,
          paginas_pb: paginasPb,
          paginas_color: paginasColor,
          tipo_impressao: tipo,
          material_nome: linha.material.nome,
          valor_total: linha.total,
          observacao,
        })
        .select()
        .single();
      if (calcError) throw calcError;

      const { error: itensError } = await supabase.from("calculo_itens").insert(
        linhas.map((l) => ({
          calculo_id: calculo.id,
          material_id: l.material.id,
          material_nome: l.material.nome,
          valor_unitario_pb: l.valorUnitarioPb,
          valor_unitario_color: l.valorUnitarioColor,
          quantidade_pb: l.paginasPb,
          quantidade_color: l.paginasColor,
          total_pb: l.totalPb,
          total_color: l.totalColor,
          total: l.total,
        })),
      );
      if (itensError) throw itensError;

      const { data: orcamento, error: orcError } = await supabase
        .from("orcamentos")
        .insert({
          calculo_id: calculo.id,
          cliente_nome: nome,
          cliente_telefone: telefone,
          material_nome: linha.material.nome,
          observacao,
          validade: validade || null,
          valor_total: linha.total,
          status: "rascunho",
        })
        .select()
        .single();
      if (orcError) throw orcError;

      gerarOrcamentoPdf({
        numero: orcamento.numero,
        data: orcamento.created_at,
        empresaNome: config?.empresa_nome ?? "Impressão Digital",
        empresaTelefone: config?.telefone,
        empresaEmail: config?.email,
        empresaEndereco: config?.endereco,
        rodape:
          config?.rodape_orcamento ??
          "Orçamento gerado pelo sistema de Calculadora de Impressão Digital.",
        clienteNome: nome,
        clienteTelefone: telefone,
        quantidadeArquivos: arquivos,
        paginasTotal: totalPaginas,
        paginasPb,
        paginasColor,
        tipoImpressao: rotuloTipo[tipo],
        material: linha.material.nome,
        valorUnitario: linha.valorUnitario,
        valorTotal: linha.total,
        validade,
        observacao,
      });

      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["calculos"] });
      toast.success("Orçamento gerado com sucesso.");
      onOpenChange(false);
      setNome("");
      setTelefone("");
      setObservacao("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o orçamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Gerar Orçamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente e escolha o material do orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Material</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {linhas.map((l) => (
                  <SelectItem key={l.material.id} value={l.material.id}>
                    {l.material.nome} — {brl(l.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente">Nome do cliente</Label>
              <Input id="cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="validade">Validade do orçamento</Label>
            <Input
              id="validade"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs">Observação</Label>
            <Textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          {linha && (
            <div className="rounded-xl border border-border bg-accent/60 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arquivos</span>
                <span className="font-semibold">{arquivos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Páginas</span>
                <span className="font-semibold">{totalPaginas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo de impressão</span>
                <span className="font-semibold">{rotuloTipo[tipo]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor por página</span>
                <span className="font-semibold">{brl(linha.valorUnitario)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-extrabold text-success">{brl(linha.total)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={salvando}>
            {salvando ? "Gerando..." : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}