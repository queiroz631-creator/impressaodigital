import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Save, Sparkles, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  estadoIA,
  removerChaveIA,
  salvarChaveIA,
  salvarConfiguracaoIA,
  testarIA,
} from "@/lib/ia-config.functions";

type Provedor = "lovable_openai" | "lovable_gemini" | "openai_proprio" | "gemini_proprio";

const OPCOES: { valor: Provedor; titulo: string; ajuda: string; modelo: string; audio: string }[] = [
  {
    valor: "lovable_openai",
    titulo: "OpenAI pela Lovable (recomendado)",
    ajuda: "Já incluso, sem precisar de chave. Consome créditos da Lovable.",
    modelo: "openai/gpt-6-astra",
    audio: "google/gemini-3.7-flash",
  },
  {
    valor: "lovable_gemini",
    titulo: "Google Gemini pela Lovable",
    ajuda: "Como o sistema funcionava antes. Também sem chave.",
    modelo: "google/gemini-3.6-flash",
    audio: "google/gemini-3.7-flash",
  },
  {
    valor: "openai_proprio",
    titulo: "OpenAI com a minha chave",
    ajuda: "Usa sua conta na OpenAI. A cobrança é feita direto por eles.",
    modelo: "gpt-4o-mini",
    audio: "whisper-1",
  },
  {
    valor: "gemini_proprio",
    titulo: "Google Gemini com a minha chave",
    ajuda: "Usa sua conta no Google AI Studio.",
    modelo: "gemini-3.6-flash",
    audio: "gemini-3.6-flash",
  },
];

const NOMES: Record<Provedor, string> = {
  lovable_openai: "OpenAI pela Lovable",
  lovable_gemini: "Google Gemini pela Lovable",
  openai_proprio: "OpenAI (chave própria)",
  gemini_proprio: "Google Gemini (chave própria)",
};

export function ConfiguracaoIA() {
  const queryClient = useQueryClient();
  const buscarEstado = useServerFn(estadoIA);
  const salvarConfig = useServerFn(salvarConfiguracaoIA);
  const gravarChave = useServerFn(salvarChaveIA);
  const apagarChave = useServerFn(removerChaveIA);
  const testar = useServerFn(testarIA);

  const { data, isLoading } = useQuery({ queryKey: ["ia-config"], queryFn: () => buscarEstado() });

  const [provedor, setProvedor] = useState<Provedor>("lovable_openai");
  const [modelo, setModelo] = useState("");
  const [modeloAudio, setModeloAudio] = useState("");
  const [chave, setChave] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    const padrao = OPCOES.find((o) => o.valor === data.provedor);
    setProvedor(data.provedor);
    setModelo(data.modelo ?? padrao?.modelo ?? "");
    setModeloAudio(data.modeloAudio ?? padrao?.audio ?? "");
  }, [data]);

  const opcao = OPCOES.find((o) => o.valor === provedor);
  const usaChavePropria = provedor === "openai_proprio" || provedor === "gemini_proprio";
  const temChave =
    provedor === "openai_proprio"
      ? Boolean(data?.chaveOpenai)
      : provedor === "gemini_proprio"
        ? Boolean(data?.chaveGemini)
        : false;

  function trocarProvedor(valor: string) {
    const novo = valor as Provedor;
    const padrao = OPCOES.find((o) => o.valor === novo);
    setProvedor(novo);
    setModelo(padrao?.modelo ?? "");
    setModeloAudio(padrao?.audio ?? "");
    setResultado(null);
  }

  const mSalvar = useMutation({
    mutationFn: () =>
      salvarConfig({ data: { provedor, modelo: modelo || null, modeloAudio: modeloAudio || null } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ia-config"] });
      toast.success("Configuração de IA salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mChave = useMutation({
    mutationFn: () => {
      if (provedor !== "openai_proprio" && provedor !== "gemini_proprio")
        throw new Error("Escolha um provedor com chave própria.");
      return gravarChave({ data: { provedor, chave: chave.trim() } });
    },
    onSuccess: async () => {
      setChave("");
      await queryClient.invalidateQueries({ queryKey: ["ia-config"] });
      toast.success("Chave guardada com segurança.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRemover = useMutation({
    mutationFn: () => {
      if (provedor !== "openai_proprio" && provedor !== "gemini_proprio")
        throw new Error("Este provedor não usa chave própria.");
      return apagarChave({ data: { provedor } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ia-config"] });
      toast.success("Chave removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mTestar = useMutation({
    mutationFn: () => testar(),
    onSuccess: (r) => {
      if (r.ok)
        setResultado({
          ok: true,
          texto: `Funcionando com ${NOMES[r.provedor as Provedor]} (${r.modelo}). Resposta: ${r.resposta}`,
        });
      else
        setResultado({
          ok: false,
          texto: `${r.mensagem} (provedor em uso: ${NOMES[r.provedor as Provedor]}, modelo ${r.modelo})`,
        });
    },
    onError: (e: Error) => setResultado({ ok: false, texto: e.message }),
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;

  return (
    <Card className="max-w-3xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Inteligência artificial
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="text-sm text-muted-foreground">
          A escolha abaixo vale para todos os recursos com IA: leitura de currículos, respostas do
          bot do WhatsApp e transcrição de áudios.
        </p>

        <div className="grid gap-2">
          <Label>Provedor</Label>
          <RadioGroup value={provedor} onValueChange={trocarProvedor} className="gap-3">
            {OPCOES.map((o) => (
              <label
                key={o.valor}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent/40"
              >
                <RadioGroupItem value={o.valor} id={`ia-${o.valor}`} className="mt-1" />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{o.titulo}</span>
                  <span className="text-xs text-muted-foreground">{o.ajuda}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="ia-modelo">Modelo de texto</Label>
            <Input
              id="ia-modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder={opcao?.modelo ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ia-modelo-audio">Modelo de áudio</Label>
            <Input
              id="ia-modelo-audio"
              value={modeloAudio}
              onChange={(e) => setModeloAudio(e.target.value)}
              placeholder={opcao?.audio ?? ""}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Deixe em branco para usar o modelo sugerido do provedor escolhido.
          </p>
        </div>

        {usaChavePropria && (
          <div className="grid gap-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Minha chave</span>
              <span
                className={`ml-auto text-xs ${temChave ? "text-primary" : "text-muted-foreground"}`}
              >
                {temChave ? "chave configurada" : "não configurada"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave é guardada em cofre no servidor e nunca é mostrada de volta nesta tela.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="off"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder={temChave ? "Digite para substituir a chave" : "Cole sua chave de API"}
              />
              <Button
                type="button"
                onClick={() => mChave.mutate()}
                disabled={chave.trim().length < 10 || mChave.isPending}
              >
                {temChave ? "Substituir" : "Guardar"}
              </Button>
              {temChave && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => mRemover.mutate()}
                  disabled={mRemover.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => mSalvar.mutate()} disabled={mSalvar.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {mSalvar.isPending ? "Salvando..." : "Salvar configuração"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => mTestar.mutate()}
            disabled={mTestar.isPending}
          >
            {mTestar.isPending ? "Testando..." : "Testar agora"}
          </Button>
        </div>

        {resultado && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              resultado.ok ? "border-primary/40 text-foreground" : "border-destructive/40"
            }`}
          >
            {resultado.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
            )}
            <span>{resultado.texto}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
