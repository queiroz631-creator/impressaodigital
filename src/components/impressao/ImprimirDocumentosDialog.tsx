import { useEffect, useMemo, useState } from "react";

import { FileStack, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { imprimirDocumentos, listarImpressoras, type DocumentoImpressao } from "@/lib/impressora";
import { PERFIL_VAZIO, type PerfilImpressao } from "@/lib/perfil-impressao";

/** Documento listado no modal de impressão. */
export interface DocumentoParaImprimir {
  nome: string;
  /** Caminho no bucket orcamento-arquivos (quando o conteúdo ainda não foi baixado). */
  caminho?: string | null;
  /** Conteúdo já disponível em base64 (sem o prefixo data:). */
  base64?: string | null;
  paginas: number;
  copias: number;
  /** Perfil de impressão do material vinculado ao arquivo. */
  perfil?: PerfilImpressao;
}

type Situacao = "pendente" | "baixando" | "enviando" | "ok" | "erro";

interface Props {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  documentos: DocumentoParaImprimir[];
  /** Impressora padrão definida nas configurações. */
  impressoraPadrao?: string | null;
}

const PERFIL_PADRAO = { ...PERFIL_VAZIO, id: "padrao", nome: "Padrão" } as PerfilImpressao;

/**
 * Modal com a lista rolável dos documentos, total de páginas, escolha da
 * impressora e acompanhamento (preload) do envio para a impressora.
 */
export function ImprimirDocumentosDialog({ aberto, onOpenChange, documentos, impressoraPadrao }: Props) {
  const [impressoras, setImpressoras] = useState<string[]>([]);
  const [impressora, setImpressora] = useState("");
  const [imprimindo, setImprimindo] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [erros, setErros] = useState<Record<number, string>>({});
  const [atual, setAtual] = useState(0);

  // Ao abrir: zera o progresso e carrega as impressoras disponíveis.
  useEffect(() => {
    if (!aberto) return;
    setImprimindo(false);
    setConcluido(false);
    setErros({});
    setAtual(0);
    setSituacoes(documentos.map(() => "pendente" as Situacao));

    const padrao = (documentos[0]?.perfil?.impressora || impressoraPadrao || "").trim();
    setImpressora(padrao);

    void listarImpressoras().then((lista) => {
      setImpressoras(lista);
      if (!padrao && lista.length > 0) setImpressora(lista[0] ?? "");
    });
  }, [aberto, documentos, impressoraPadrao]);

  const totalPaginas = useMemo(
    () =>
      documentos.reduce(
        (acc, d) => acc + Math.max(0, d.paginas || 0) * Math.max(1, d.copias || 1),
        0,
      ),
    [documentos],
  );

  const opcoes = useMemo(() => {
    const lista = [...impressoras];
    if (impressora && !lista.some((n) => n.toLowerCase() === impressora.toLowerCase())) {
      lista.unshift(impressora);
    }
    return lista;
  }, [impressoras, impressora]);

  const enviados = situacoes.filter((s) => s === "ok").length;
  const falhas = situacoes.filter((s) => s === "erro").length;
  const progresso = documentos.length > 0 ? Math.round(((enviados + falhas) / documentos.length) * 100) : 0;

  function marcar(indice: number, situacao: Situacao, erro?: string) {
    setSituacoes((s) => s.map((v, i) => (i === indice ? situacao : v)));
    if (erro) setErros((e) => ({ ...e, [indice]: erro }));
  }

  /** Baixa o PDF do storage e devolve o conteúdo em base64. */
  async function conteudo(doc: DocumentoParaImprimir): Promise<string | null> {
    if (doc.base64) return doc.base64;
    if (!doc.caminho) return null;
    const { data, error } = await supabase.storage.from("orcamento-arquivos").download(doc.caminho);
    if (error || !data) return null;
    const buffer = new Uint8Array(await data.arrayBuffer());
    let binario = "";
    for (const byte of buffer) binario += String.fromCharCode(byte);
    return btoa(binario);
  }

  async function iniciar() {
    setImprimindo(true);
    setConcluido(false);

    for (let i = 0; i < documentos.length; i++) {
      const doc = documentos[i]!;
      setAtual(i);

      marcar(i, "baixando");
      const base64 = await conteudo(doc);
      if (!base64) {
        marcar(i, "erro", "Arquivo indisponível para reimpressão.");
        continue;
      }

      marcar(i, "enviando");
      const item: DocumentoImpressao = {
        nome: doc.nome,
        base64,
        copias: Math.max(1, doc.copias || 1),
      };
      const resultado = await imprimirDocumentos(doc.perfil ?? PERFIL_PADRAO, [item], impressora || null);
      if (resultado.metodo === "qz") marcar(i, "ok");
      else marcar(i, "erro", resultado.mensagem ?? "Falha ao enviar para a impressora.");
    }

    setImprimindo(false);
    setConcluido(true);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (!imprimindo ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" /> Imprimir documentos
          </DialogTitle>
          <DialogDescription>
            {imprimindo
              ? `Enviando ${Math.min(atual + 1, documentos.length)} de ${documentos.length}...`
              : "Confira os arquivos, o total de páginas e a impressora antes de iniciar."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
          {documentos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento disponível.</p>
          )}

          {documentos.map((d, i) => {
            const copias = Math.max(1, d.copias || 1);
            const paginas = Math.max(0, d.paginas || 0);
            const situacao = situacoes[i] ?? "pendente";
            return (
              <div key={`${d.nome}-${i}`} className="rounded-lg border border-border bg-accent/30 p-2.5">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm font-semibold break-all">{d.nome}</p>
                  {situacao === "ok" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                  {situacao === "erro" && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                  {(situacao === "baixando" || situacao === "enviando") && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {paginas} página(s) · {copias} cópia(s) · {paginas * copias} página(s) no total
                  {situacao === "baixando" && " · baixando arquivo"}
                  {situacao === "enviando" && " · enviando para a impressora"}
                </p>
                {erros[i] && <p className="mt-0.5 text-xs font-medium text-destructive">{erros[i]}</p>}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border p-2.5 text-sm font-semibold">
          Total de páginas a imprimir: {totalPaginas}
        </div>

        {(imprimindo || concluido) && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {enviados} enviado(s) · {falhas} falha(s) de {documentos.length}
            </p>
          </div>
        )}

        {!imprimindo && !concluido && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Impressora</Label>
            {opcoes.length > 0 ? (
              <Select value={impressora} onValueChange={setImpressora}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a impressora" />
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
                Nenhuma impressora detectada. Verifique se o agente de impressão está ativo.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {concluido ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" disabled={imprimindo} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                disabled={imprimindo || documentos.length === 0 || !impressora}
                onClick={() => void iniciar()}
              >
                {imprimindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />}
                {imprimindo ? "Imprimindo..." : "Imprimir"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
