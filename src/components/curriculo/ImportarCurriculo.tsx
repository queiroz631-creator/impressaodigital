/** Importação de currículo pronto (PDF/DOC/DOCX) com revisão no formulário. */

import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ErroImportacao,
  extrairTextoCurriculo,
  mensagemErroImportacao,
  tipoImportacao,
} from "@/lib/curriculo-import";
import { resumoImportacao, type CurriculoImportado } from "@/lib/curriculo-import-tipos";
import {
  atualizarCurriculoImportado,
  consultarCpfImportacao,
  criarCurriculoImportado,
  interpretarCurriculoImportado,
} from "@/lib/curriculo-import.functions";
import { cpfValido, formatarCpf, formatarTelefone, somenteNumeros } from "@/lib/curriculo";

interface Existente {
  id: string;
  nome_completo: string;
  telefone_principal: string;
  status: string;
}

const PASSOS = [
  "Lendo o documento…",
  "Extraindo o texto…",
  "Identificando as informações…",
  "Preenchendo o currículo…",
];

export function ImportarCurriculo({
  aberto,
  onFechar,
  onImportado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onImportado: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const interpretar = useServerFn(interpretarCurriculoImportado);
  const consultarCpf = useServerFn(consultarCpfImportacao);
  const criar = useServerFn(criarCurriculoImportado);
  const atualizar = useServerFn(atualizarCurriculoImportado);

  const [passo, setPasso] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<CurriculoImportado | null>(null);
  const [existente, setExistente] = useState<Existente | null>(null);
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [gravando, setGravando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const limpar = () => {
    setPasso(null);
    setErro("");
    setDados(null);
    setExistente(null);
    setCpf("");
    setTelefone("");
    setGravando(false);
  };

  const fechar = () => {
    limpar();
    onFechar();
  };

  const processar = async (file: File) => {
    setErro("");
    setDados(null);
    setExistente(null);
    if (!tipoImportacao(file.name)) {
      setErro(mensagemErroImportacao("FORMATO_NAO_SUPORTADO"));
      return;
    }
    try {
      setPasso(0);
      const texto = await extrairTextoCurriculo(file);
      setPasso(2);
      const r = await interpretar({ data: { texto } });
      setPasso(3);
      setDados(r.dados);
      setExistente((r.existente as Existente | null) ?? null);
      setCpf(r.dados.cpf ? formatarCpf(r.dados.cpf) : "");
      setTelefone(
        r.dados.campos.telefone_principal
          ? formatarTelefone(r.dados.campos.telefone_principal)
          : "",
      );
    } catch (e) {
      if (e instanceof ErroImportacao) setErro(mensagemErroImportacao(e.message));
      else if (e instanceof Error && e.message.startsWith("IA_"))
        setErro(mensagemErroImportacao(e.message));
      else setErro("Não foi possível interpretar este currículo. Tente outro arquivo.");
    } finally {
      setPasso(null);
    }
  };

  const verificarCpfManual = async (valor: string) => {
    setCpf(formatarCpf(valor));
    const numeros = somenteNumeros(valor);
    if (numeros.length === 11 && cpfValido(numeros)) {
      const r = await consultarCpf({ data: { cpf: numeros } });
      setExistente((r.existente as Existente | null) ?? null);
    } else {
      setExistente(null);
    }
  };

  const continuar = async (substituirListas = false) => {
    if (!dados) return;
    setGravando(true);
    try {
      if (existente) {
        const r = await atualizar({
          data: { curriculoId: existente.id, dados, substituirListas },
        });
        toast.success("Cadastro atualizado com as informações importadas.");
        onImportado(r.id);
      } else {
        const numeros = somenteNumeros(cpf);
        if (!cpfValido(numeros)) {
          toast.error("Informe um CPF válido.");
          return;
        }
        if (somenteNumeros(telefone).length < 10) {
          toast.error("Informe um telefone válido.");
          return;
        }
        const r = await criar({ data: { cpf: numeros, telefone, dados } });
        toast.success("Currículo importado. Revise as informações.");
        onImportado(r.id);
      }
      limpar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar o currículo.");
    } finally {
      setGravando(false);
    }
  };

  const resumo = dados ? resumoImportacao(dados) : null;

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? undefined : fechar())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar currículo</DialogTitle>
        </DialogHeader>

        {passo !== null ? (
          <div className="space-y-3 py-6">
            {PASSOS.map((t, i) => (
              <div
                key={t}
                className={`flex items-center gap-2 text-sm ${
                  i <= passo ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {i < passo ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : i === passo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="h-4 w-4" />
                )}
                {t}
              </div>
            ))}
          </div>
        ) : !dados ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void processar(file);
              }}
              className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center ${
                arrastando ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              }`}
            >
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste o arquivo para cá — PDF, DOC ou DOCX (até 10 MB)
              </p>
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> SELECIONAR ARQUIVO
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void processar(file);
                }}
              />
            </div>
            {erro && (
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {erro}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium text-primary">
                ✓ {resumo?.encontrados.length ?? 0} informações identificadas
              </p>
              {(resumo?.verificar.length ?? 0) > 0 && (
                <p className="font-medium text-amber-600">
                  ⚠ {resumo?.verificar.length} precisam ser verificadas
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {resumo?.encontrados.slice(0, 14).map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
              {(resumo?.faltando.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Não encontrado no arquivo: {resumo?.faltando.join(", ")}.
                </p>
              )}
            </div>

            {existente ? (
              <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">Já existe um cadastro para este CPF</p>
                <p className="text-muted-foreground">
                  {existente.nome_completo} — {existente.telefone_principal}
                </p>
                <p className="text-xs text-muted-foreground">
                  Como o CPF é único por currículo, não é possível criar um novo. As informações
                  importadas podem ser aplicadas sobre o cadastro existente.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={gravando} onClick={() => void continuar(false)}>
                    ACRESCENTAR ÀS LISTAS
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={gravando}
                    onClick={() => void continuar(true)}
                  >
                    SUBSTITUIR LISTAS
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>CPF *</Label>
                  <Input
                    value={cpf}
                    onChange={(e) => void verificarCpfManual(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label>Telefone principal *</Label>
                  <Input
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={gravando}>
            {dados ? "CANCELAR" : "FECHAR"}
          </Button>
          {dados && !existente && (
            <Button onClick={() => void continuar()} disabled={gravando}>
              {gravando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              CONTINUAR PARA REVISÃO
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
