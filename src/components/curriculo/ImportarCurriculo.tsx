/** Importação de currículo pronto (PDF/DOC/DOCX) com revisão no formulário. */

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileUp,
  FolderOpen,
  Loader2,
  Upload,
} from "lucide-react";
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
import {
  ErroArquivamento,
  escolherPastaDestino,
  lerPastaSalva,
  limparPasta,
  mensagemErroArquivamento,
  moverArquivo,
  suportaArquivamento,
} from "@/lib/curriculo-arquivo";

interface Existente {
  id: string;
  nome_completo: string;
  telefone_principal: string;
  status: string;
}

const PASSOS = [
  "Lendo o documento…",
  "Extraindo o texto…",
  "Preenchendo pelo padrão do documento…",
  "Completando com a IA…",
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
  const [textoExtraido, setTextoExtraido] = useState("");
  const [erroIA, setErroIA] = useState("");
  const [verTexto, setVerTexto] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pasta, setPasta] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [arquivoHandle, setArquivoHandle] = useState<any | null>(null);
  const [avisoArquivo, setAvisoArquivo] = useState("");
  const suporta = suportaArquivamento();

  useEffect(() => {
    if (!aberto || !suporta) return;
    void lerPastaSalva().then((h) => setPasta(h));
  }, [aberto, suporta]);

  const escolherPasta = async () => {
    try {
      const h = await escolherPastaDestino();
      if (h) {
        setPasta(h);
        toast.success(`Os arquivos importados serão movidos para "${h.name}".`);
      }
    } catch (e) {
      toast.error(
        mensagemErroArquivamento(e instanceof ErroArquivamento ? e.message : "FALHA_MOVER"),
      );
    }
  };

  const desligarPasta = async () => {
    await limparPasta();
    setPasta(null);
  };

  /** Move o arquivo original para a pasta escolhida, se possível. */
  const arquivarArquivo = async (): Promise<{
    ok: boolean;
    nome?: string;
    aviso?: string;
  }> => {
    if (!pasta) return { ok: false };
    if (!suporta || !arquivoHandle) {
      const aviso = mensagemErroArquivamento("SEM_CONTROLE_ARQUIVO");
      setAvisoArquivo(aviso);
      return { ok: false, aviso };
    }
    try {
      const nome = await moverArquivo(arquivoHandle, pasta);
      return { ok: true, nome };
    } catch (e) {
      const aviso = mensagemErroArquivamento(
        e instanceof ErroArquivamento ? e.message : "FALHA_MOVER",
      );
      setAvisoArquivo(aviso);
      return { ok: false, aviso };
    }
  };

  const limpar = () => {
    setPasso(null);
    setErro("");
    setDados(null);
    setExistente(null);
    setCpf("");
    setTelefone("");
    setGravando(false);
    setTextoExtraido("");
    setErroIA("");
    setVerTexto(false);
    setArquivoHandle(null);
  };

  const fechar = () => {
    limpar();
    setAvisoArquivo("");
    onFechar();
  };

  /** Abre o seletor nativo para obter também o controle do arquivo original. */
  const selecionarArquivo = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const picker = (window as any).showOpenFilePicker;
    if (!suporta || typeof picker !== "function") {
      inputRef.current?.click();
      return;
    }
    try {
      const [handle] = await picker({
        multiple: false,
        types: [
          {
            description: "Currículo",
            accept: {
              "application/pdf": [".pdf"],
              "application/msword": [".doc"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            },
          },
        ],
      });
      if (!handle) return;
      setArquivoHandle(handle);
      void processar(await handle.getFile());
    } catch {
      /* seleção cancelada */
    }
  };

  const processar = async (file: File) => {
    setErro("");
    setDados(null);
    setExistente(null);
    setErroIA("");
    setVerTexto(false);
    setAvisoArquivo("");
    if (!tipoImportacao(file.name)) {
      setErro(mensagemErroImportacao("FORMATO_NAO_SUPORTADO"));
      return;
    }
    try {
      setPasso(0);
      const texto = await extrairTextoCurriculo(file);
      setTextoExtraido(texto);
      setPasso(2);
      const r = await interpretar({ data: { texto } });
      setPasso(4);
      setDados(r.dados);
      setExistente((r.existente as Existente | null) ?? null);
      setErroIA(r.erroIA ?? "");
      setVerTexto(Boolean(r.erroIA));
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

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textoExtraido);
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
    }
  };

  const continuar = async (substituirListas = false) => {
    if (!dados) return;
    setGravando(true);
    setAvisoArquivo("");
    try {
      let id: string;
      if (existente) {
        const r = await atualizar({
          data: { curriculoId: existente.id, dados, substituirListas },
        });
        id = r.id;
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
        id = r.id;
      }

      const arquivamento = await arquivarArquivo();
      const base = existente
        ? "Cadastro atualizado com as informações importadas."
        : "Currículo importado. Revise as informações.";
      toast.success(
        arquivamento.ok ? `${base} Arquivo movido para "${pasta?.name}".` : base,
      );
      if (arquivamento.aviso) toast.warning(arquivamento.aviso, { duration: 10000 });
      onImportado(id);
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
                const item = e.dataTransfer.items?.[0];
                const file = e.dataTransfer.files?.[0];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const obter = (item as any)?.getAsFileSystemHandle;
                if (suporta && typeof obter === "function") {
                  void obter

                    .call(item)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .then(async (h: any) => {
                      if (h?.kind === "file") {
                        setArquivoHandle(h);
                        await processar(await h.getFile());
                      } else if (file) {
                        await processar(file);
                      }
                    })
                    .catch(() => {
                      if (file) void processar(file);
                    });
                  return;
                }
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
              <Button variant="outline" onClick={() => void selecionarArquivo()}>
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

            <div className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Pasta de arquivamento</span>
                </div>
                {suporta ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void escolherPasta()}>
                      {pasta ? "TROCAR PASTA" : "ESCOLHER PASTA"}
                    </Button>
                    {pasta && (
                      <Button size="sm" variant="ghost" onClick={() => void desligarPasta()}>
                        NÃO ARQUIVAR
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    ESCOLHER PASTA
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {!suporta
                  ? "Este navegador não permite mover arquivos. Use o Chrome ou o Edge no computador."
                  : pasta
                    ? `Depois de importar, o arquivo sai da pasta de origem e vai para "${pasta.name}".`
                    : "Escolha uma pasta para que o arquivo seja movido para lá depois da importação."}
              </p>
            </div>

            {erro && (
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {erro}
              </p>
            )}
            {avisoArquivo && (
              <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {avisoArquivo}
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

            {erroIA && (
              <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {mensagemErroImportacao(erroIA)} As informações reconhecidas pelo sistema foram
                  preenchidas — confira e complete o que falta.
                </span>
              </p>
            )}

            {textoExtraido && (
              <div className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setVerTexto((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">Texto lido do arquivo</span>
                  <span className="text-xs text-muted-foreground">
                    {verTexto ? "OCULTAR" : "VER / COPIAR"}
                  </span>
                </button>
                {verTexto && (
                  <div className="space-y-2 border-t p-2">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => void copiarTexto()}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> COPIAR TEXTO
                      </Button>
                    </div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                      {textoExtraido}
                    </pre>
                  </div>
                )}
              </div>
            )}

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
