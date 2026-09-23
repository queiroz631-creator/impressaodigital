import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { gerarChave, listarChaves, salvarChave, verChave } from "@/lib/sistema-chaves.functions";

const NOME_SINCRONIZACAO = "sincronizacao";

export function ConfiguracaoChaves() {
  const queryClient = useQueryClient();
  const buscar = useServerFn(listarChaves);
  const revelar = useServerFn(verChave);
  const gravar = useServerFn(salvarChave);
  const gerar = useServerFn(gerarChave);

  const { data, isLoading } = useQuery({ queryKey: ["sistema-chaves"], queryFn: () => buscar() });

  const [chave, setChave] = useState("");
  const [urlBase, setUrlBase] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [carregada, setCarregada] = useState(false);

  const atual = data?.find((c) => c.nome === NOME_SINCRONIZACAO);

  useEffect(() => {
    if (!data) return;
    setUrlBase(atual?.urlBase ?? "");
    setCarregada(false);
    setMostrar(false);
    setChave("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function garantirValor() {
    if (carregada) return chave;
    const r = await revelar({ data: { nome: NOME_SINCRONIZACAO } });
    setChave(r.valor);
    setCarregada(true);
    return r.valor;
  }

  const mMostrar = useMutation({
    mutationFn: async () => {
      await garantirValor();
      setMostrar(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCopiarChave = useMutation({
    mutationFn: async () => {
      const valor = await garantirValor();
      if (!valor) throw new Error("Nenhuma chave gravada ainda.");
      await navigator.clipboard.writeText(valor);
    },
    onSuccess: () => toast.success("Chave copiada."),
    onError: (e: Error) => toast.error(e.message),
  });

  const mCopiarConexao = useMutation({
    mutationFn: async () => {
      const valor = await garantirValor();
      if (!valor) throw new Error("Nenhuma chave gravada ainda.");
      await navigator.clipboard.writeText(`URL: ${urlBase}\nCHAVE: ${valor}`);
    },
    onSuccess: () => toast.success("Dados de conexão copiados."),
    onError: (e: Error) => toast.error(e.message),
  });

  const mGerar = useMutation({
    mutationFn: () => gerar(),
    onSuccess: (r) => {
      setChave(r.valor);
      setCarregada(true);
      setMostrar(true);
      toast.info("Chave gerada. Clique em Salvar para aplicar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mSalvar = useMutation({
    mutationFn: async () => {
      const valor = carregada ? chave : await garantirValor();
      return gravar({ data: { nome: NOME_SINCRONIZACAO, valor, urlBase } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sistema-chaves"] });
      toast.success("Chave de sincronização salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Chave Key sincronização
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Chave usada pelo aplicativo de sincronização da loja, junto com a URL do sistema.
        </p>

        <div className="space-y-2">
          <Label htmlFor="chave-sinc">Chave</Label>
          <div className="flex gap-2">
            <Input
              id="chave-sinc"
              type={mostrar ? "text" : "password"}
              value={mostrar || carregada ? chave : atual?.temChave ? "••••••••••••" : ""}
              placeholder="Cole a chave ou clique em Gerar chave"
              onChange={(e) => {
                setChave(e.target.value.trim());
                setCarregada(true);
              }}
              onFocus={() => {
                if (!carregada) void garantirValor();
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={mostrar ? "Ocultar" : "Mostrar"}
              onClick={() => (mostrar ? setMostrar(false) : mMostrar.mutate())}
            >
              {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Copiar chave"
              onClick={() => mCopiarChave.mutate()}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {atual?.temChave && !mostrar ? (
            <p className="text-xs text-muted-foreground">
              Chave gravada, terminando em {atual.final4}.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="url-sinc">URL base do sistema</Label>
          <Input
            id="url-sinc"
            value={urlBase}
            placeholder="https://impressaodigital.lovable.app"
            onChange={(e) => setUrlBase(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => mSalvar.mutate()} disabled={mSalvar.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => mGerar.mutate()}
            disabled={mGerar.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Gerar chave
          </Button>
          <Button type="button" variant="outline" onClick={() => mCopiarConexao.mutate()}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar dados de conexão
          </Button>
        </div>

        {atual?.atualizadoEm ? (
          <p className="text-xs text-muted-foreground">
            Última alteração em {new Date(atual.atualizadoEm).toLocaleString("pt-BR")}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
