import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutPublico } from "@/modules/sorteios/components/publico/LayoutPublico";
import {
  aceitarTermosSorteio,
  obterInformacoesPublicasSorteio,
} from "@/lib/sorteios-publico.functions";
import { useContextoPortal } from "@/modules/sorteios/hooks/usePortalParticipante";

const META_PRIVADA = [
  { title: "Termos do Sorteio | Queiroz Papelaria" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/termos")({
  component: TermosPortal,
  head: () => ({ meta: META_PRIVADA }),
});

const SECOES: { chave: string; titulo: string }[] = [
  { chave: "regras", titulo: "Regras" },
  { chave: "como_participar", titulo: "Como participar" },
  { chave: "validade", titulo: "Validade" },
  { chave: "como_sera_realizado", titulo: "Como será realizado" },
  { chave: "informacoes", titulo: "Informações" },
  { chave: "premios", titulo: "Prêmios" },
  { chave: "outras_condicoes", titulo: "Outras condições" },
];

function TermosPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const contexto = useContextoPortal();
  const infoFn = useServerFn(obterInformacoesPublicasSorteio);
  const aceitar = useServerFn(aceitarTermosSorteio);
  const info = useQuery({
    queryKey: ["portal-informacoes"],
    queryFn: () => infoFn({}),
    retry: false,
    enabled: Boolean(contexto.data?.ok),
  });
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (contexto.data?.ok && !contexto.data.dados.precisaAceitarTermos) {
      void navigate({ to: "/sorteios-publico/painel" });
    }
  }, [contexto.data, navigate]);

  const termos = info.data?.ok ? info.data.dados.termos : null;

  async function confirmar() {
    if (!termos) return;
    if (!aceito) {
      setErro("É preciso marcar que você leu e aceita os termos.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const resultado = await aceitar({ data: { versao: termos.versao, aceito: true } });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["portal-contexto"] });
      void navigate({ to: "/sorteios-publico/painel" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico
      autenticado
      titulo="Termos do sorteio"
      subtitulo="Leia com atenção e aceite para participar."
    >
      {!info.data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !info.data.ok ? (
        <p className="text-sm text-muted-foreground">{info.data.mensagem}</p>
      ) : !termos ? (
        <p className="text-sm text-muted-foreground">
          Os termos deste sorteio ainda não foram publicados.
        </p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-5">
              {termos.titulo && <h2 className="font-semibold">{termos.titulo}</h2>}
              {SECOES.map(({ chave, titulo: rotulo }) => {
                const texto = (termos as unknown as Record<string, string | null>)[chave];
                if (!texto?.trim()) return null;
                return (
                  <section key={chave}>
                    <h3 className="text-sm font-semibold text-foreground">{rotulo}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">
                      {texto}
                    </p>
                  </section>
                );
              })}
            </CardContent>
          </Card>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <Checkbox checked={aceito} onCheckedChange={(v) => setAceito(v === true)} />
            Li e aceito os termos e condições do sorteio (versão {termos.versao}).
          </label>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button
            className="w-full h-12 text-base"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
            Aceitar e continuar
          </Button>
        </div>
      )}
    </LayoutPublico>
  );
}
