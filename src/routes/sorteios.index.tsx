import { useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Gift, Link2, ImageUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brl, dataBR } from "@/lib/format";
import logoPadrao from "@/assets/logo-queiroz-sorteios.png.asset.json";
import {
  limparLogoSorteio,
  logoPortalAtual,
  salvarLogoSorteio,
} from "@/lib/sorteio-logo.functions";
import { useListaSorteios } from "@/modules/sorteios/hooks/useSorteios";
import { StatusSorteioBadge } from "@/modules/sorteios/components/StatusSorteioBadge";
import { somenteConsulta } from "@/modules/sorteios/services/status";
import { urlPublicaSorteios } from "@/modules/sorteios/services/url-publica";

const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export const Route = createFileRoute("/sorteios/")({
  component: () => (
    <AppLayout permissao="sorteios.visualizar">
      <ListaSorteios />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Sorteios | Calculadora de Impressão Digital" },
      {
        name: "description",
        content:
          "Administre campanhas de sorteio: situação, período, valor por cupom, participantes, notas e cupons.",
      },
      { property: "og:title", content: "Sorteios | Calculadora de Impressão Digital" },
      {
        property: "og:description",
        content: "Administração das campanhas de sorteio da loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ListaSorteios() {
  const navigate = useNavigate();
  const { data: sorteios, isLoading, error } = useListaSorteios();

  return (
    <>
      <PageHeader titulo="Sorteios" subtitulo="Campanhas de sorteio da loja" />

      <div className="mb-4 flex justify-end">
        <Button onClick={() => navigate({ to: "/sorteios/novo" })}>
          <Plus className="mr-2 h-4 w-4" /> Novo sorteio
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Link público do portal</p>
              <p className="truncate text-xs text-muted-foreground">{urlPublicaSorteios()}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(urlPublicaSorteios())
                  .then(() => toast.success("Link do portal copiado."));
              }}
            >
              <Link2 className="mr-2 h-4 w-4" /> Copiar link
            </Button>
          </div>

          <LogoDoPortal />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && (sorteios?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Gift className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum sorteio cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Crie o primeiro sorteio para começar a cadastrar termos e prêmios.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(sorteios ?? []).map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Nº {s.numero_sorteio}
                  </span>
                  <span className="truncate font-semibold">{s.nome}</span>
                  <StatusSorteioBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {dataBR(s.data_inicio)} a {dataBR(s.data_fim)} · sorteio em{" "}
                  {dataBR(s.data_sorteio)} · {brl(s.valor_por_cupom_centavos / 100)} por cupom
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.participantes} participante(s) · {s.notas} nota(s) · {s.cupons} cupom(ns)
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/sorteios/$id" params={{ id: s.id }}>
                    Abrir
                  </Link>
                </Button>
                {!somenteConsulta(s.status) && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/sorteios/$id/editar" params={{ id: s.id }}>
                      Editar
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

/** Logo exibida no topo do portal público, com envio e volta ao padrão. */
function LogoDoPortal() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const buscar = useServerFn(logoPortalAtual);
  const salvar = useServerFn(salvarLogoSorteio);
  const limpar = useServerFn(limparLogoSorteio);

  const { data, isLoading } = useQuery({
    queryKey: ["sorteios", "logo-portal-admin"],
    queryFn: () => buscar(),
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["sorteios", "logo-portal-admin"] });
    void queryClient.invalidateQueries({ queryKey: ["sorteios", "logo-portal"] });
  }

  const mSalvar = useMutation({
    mutationFn: async (arquivo: File) => {
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        throw new Error("Escolha uma imagem PNG, JPG, WEBP ou SVG.");
      }
      if (arquivo.size > 2 * 1024 * 1024) throw new Error("A imagem precisa ter até 2 MB.");
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      let bruto = "";
      for (const b of bytes) bruto += String.fromCharCode(b);
      return salvar({ data: { base64: btoa(bruto), tipo: arquivo.type } });
    },
    onSuccess: () => {
      toast.success("Logo do portal atualizada.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mLimpar = useMutation({
    mutationFn: () => limpar(),
    onSuccess: () => {
      toast.success("Logo padrão restaurada.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ocupado = mSalvar.isPending || mLimpar.isPending;

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={data?.url ?? logoPadrao.url}
          alt="Logo do portal"
          className="h-12 w-12 shrink-0 rounded-full border bg-white object-contain"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Logo do portal</p>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : data?.personalizada
                ? "Imagem enviada pela loja."
                : "Usando a logo padrão do sistema."}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) mSalvar.mutate(arquivo);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp className="mr-2 h-4 w-4" />
          {data?.personalizada ? "Trocar logo" : "Adicionar logo"}
        </Button>
        {data?.personalizada && (
          <Button
            variant="ghost"
            size="sm"
            disabled={ocupado}
            onClick={() => mLimpar.mutate()}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Voltar à logo padrão
          </Button>
        )}
      </div>
    </div>
  );
}

