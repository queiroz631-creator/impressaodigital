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
import {
  gerarChave,
  listarChaves,
  salvarChave,
  verChave,
  type ChaveResumo,
} from "@/lib/sistema-chaves.functions";

interface BlocoChaveProps {
  nome: "sincronizacao" | "backup";
  titulo: string;
  descricao: string;
  rotuloUrl: string;
  placeholderUrl: string;
  atual: ChaveResumo | undefined;
}

function BlocoChave({ nome, titulo, descricao, rotuloUrl, placeholderUrl, atual }: BlocoChaveProps) {
  const queryClient = useQueryClient();
  const revelar = useServerFn(verChave);
  const gravar = useServerFn(salvarChave);
  const gerar = useServerFn(gerarChave);
  const [chave, setChave] = useState("");
  const [urlBase, setUrlBase] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [carregada, setCarregada] = useState(false);

  useEffect(() => {
    setUrlBase(atual?.urlBase || (nome === "backup" ? placeholderUrl : ""));
    setCarregada(false);
    setMostrar(false);
    setChave("");
  }, [atual, nome, placeholderUrl]);

  async function garantirValor() {
    if (carregada) return chave;
    const resposta = await revelar({ data: { nome } });
    setChave(resposta.valor);
    setCarregada(true);
    return resposta.valor;
  }

  const mostrarChave = useMutation({
    mutationFn: async () => {
      await garantirValor();
      setMostrar(true);
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
  const copiarChave = useMutation({
    mutationFn: async () => {
      const valor = await garantirValor();
      if (!valor) throw new Error("Nenhuma chave gravada ainda.");
      await navigator.clipboard.writeText(valor);
    },
    onSuccess: () => toast.success("Chave copiada."),
    onError: (erro: Error) => toast.error(erro.message),
  });
  const copiarConexao = useMutation({
    mutationFn: async () => {
      const valor = await garantirValor();
      if (!valor) throw new Error("Nenhuma chave gravada ainda.");
      await navigator.clipboard.writeText(`URL: ${urlBase}\nCHAVE: ${valor}`);
    },
    onSuccess: () => toast.success("Dados de conexão copiados."),
    onError: (erro: Error) => toast.error(erro.message),
  });
  const gerarNova = useMutation({
    mutationFn: () => gerar(),
    onSuccess: (resposta) => {
      setChave(resposta.valor);
      setCarregada(true);
      setMostrar(true);
      toast.info("Chave gerada. Clique em Salvar para aplicar.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });
  const salvar = useMutation({
    mutationFn: async () => {
      const valor = carregada ? chave : await garantirValor();
      return gravar({ data: { nome, valor, urlBase } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sistema-chaves"] });
      toast.success(`${titulo} salva.`);
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const id = `chave-${nome}`;
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <div className="space-y-2">
          <Label htmlFor={id}>Chave</Label>
          <div className="flex gap-2">
            <Input
              id={id}
              type={mostrar ? "text" : "password"}
              value={mostrar || carregada ? chave : atual?.temChave ? "••••••••••••" : ""}
              placeholder="Cole a chave ou clique em Gerar chave"
              onChange={(evento) => {
                setChave(evento.target.value.trim());
                setCarregada(true);
              }}
              onFocus={() => {
                if (!carregada) void garantirValor();
              }}
            />
            <Button type="button" variant="outline" size="icon" title={mostrar ? "Ocultar" : "Mostrar"} onClick={() => (mostrar ? setMostrar(false) : mostrarChave.mutate())}>
              {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" size="icon" title="Copiar chave" onClick={() => copiarChave.mutate()}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {atual?.temChave && !mostrar ? <p className="text-xs text-muted-foreground">Chave gravada, terminando em {atual.final4}.</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`url-${nome}`}>{rotuloUrl}</Label>
          <Input id={`url-${nome}`} value={urlBase} placeholder={placeholderUrl} onChange={(evento) => setUrlBase(evento.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
          <Button type="button" variant="outline" onClick={() => gerarNova.mutate()} disabled={gerarNova.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" /> Gerar chave
          </Button>
          <Button type="button" variant="outline" onClick={() => copiarConexao.mutate()}>
            <Copy className="mr-2 h-4 w-4" /> Copiar dados de conexão
          </Button>
        </div>
        {atual?.atualizadoEm ? <p className="text-xs text-muted-foreground">Última alteração em {new Date(atual.atualizadoEm).toLocaleString("pt-BR")}.</p> : null}
      </CardContent>
    </Card>
  );
}

export function ConfiguracaoChaves() {
  const buscar = useServerFn(listarChaves);
  const { data, isLoading } = useQuery({ queryKey: ["sistema-chaves"], queryFn: () => buscar() });
  if (isLoading) {
    return <Card className="shadow-card"><CardContent className="space-y-3 p-6"><Skeleton className="h-5 w-48" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>;
  }
  return (
    <div className="grid gap-4">
      <BlocoChave nome="sincronizacao" titulo="Chave Key sincronização" descricao="Chave usada pelo aplicativo de sincronização da loja, junto com a URL do sistema." rotuloUrl="URL base do sistema" placeholderUrl="https://impressaodigital.lovable.app" atual={data?.find((item) => item.nome === "sincronizacao")} />
      <BlocoChave nome="backup" titulo="Chave Key backup" descricao="Token exclusivo usado pelo módulo de backup do programa da loja." rotuloUrl="URL da API de backup" placeholderUrl="https://backup.queiroztecno.com.br" atual={data?.find((item) => item.nome === "backup")} />
    </div>
  );
}