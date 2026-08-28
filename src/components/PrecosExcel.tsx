/** Botões de exportar/importar Excel das configurações de preço. */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Acabamento, Material } from "@/lib/calc";
import {
  exportarAcabamentos,
  exportarMateriais,
  lerAcabamentos,
  lerMateriais,
} from "@/lib/precos-excel";

interface Props {
  tipo: "materiais" | "acabamentos";
  dados: Material[] | Acabamento[] | undefined;
  aoImportar: () => void;
}

export function PrecosExcel({ tipo, dados, aoImportar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<{
    registros: Record<string, unknown>[];
    novos: number;
    atualizados: number;
    erros: string[];
  } | null>(null);
  const [gravando, setGravando] = useState(false);

  function exportar() {
    if (!dados?.length) {
      toast.error("Nada para exportar.");
      return;
    }
    if (tipo === "materiais") exportarMateriais(dados as Material[]);
    else exportarAcabamentos(dados as Acabamento[]);
  }

  async function selecionar(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const resultado =
        tipo === "materiais" ? await lerMateriais(arquivo) : await lerAcabamentos(arquivo);
      setPrevia({
        registros: resultado.linhas.map((l) => l.registro as Record<string, unknown>),
        novos: resultado.linhas.filter((l) => l.novo).length,
        atualizados: resultado.linhas.filter((l) => !l.novo).length,
        erros: resultado.erros,
      });
    } catch {
      toast.error("Não foi possível ler a planilha.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmar() {
    if (!previa) return;
    setGravando(true);
    const { error } = await supabase.from(tipo).upsert(previa.registros as never[]);
    setGravando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Planilha importada.");
    setPrevia(null);
    aoImportar();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => selecionar(e.target.files?.[0])}
      />
      <Button variant="outline" onClick={exportar}>
        <Download className="h-4 w-4" /> Exportar Excel
      </Button>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" /> Importar Excel
      </Button>

      <Dialog open={!!previa} onOpenChange={(a) => !a && setPrevia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importação</DialogTitle>
            <DialogDescription>Nada é excluído: linhas sem id viram novos registros.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-bold">{previa?.novos ?? 0}</span> registro(s) serão criados.
            </p>
            <p>
              <span className="font-bold">{previa?.atualizados ?? 0}</span> registro(s) serão atualizados.
            </p>
            {!!previa?.erros.length && (
              <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-2 text-xs text-destructive">
                <p className="font-bold">{previa.erros.length} linha(s) com erro (serão ignoradas):</p>
                <ul>
                  {previa.erros.slice(0, 8).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevia(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={gravando || !previa?.registros.length}>
              {gravando ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
