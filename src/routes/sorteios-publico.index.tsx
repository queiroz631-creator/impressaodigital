import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutPublico } from "@/modules/sorteios/components/publico/LayoutPublico";
import { CampoCpf } from "@/modules/sorteios/components/publico/CamposPublico";
import { iniciarAcessoPublico, obterSorteioAtivoPublico } from "@/lib/sorteios-publico.functions";
import { validarCpf } from "@/modules/sorteios/validations/cliente";
import { gravarFluxo } from "@/modules/sorteios/services/fluxo-publico";

export const Route = createFileRoute("/sorteios-publico/")({
  component: EntradaPortal,
  head: () => ({
    meta: [
      { title: "Portal de Sorteios | Queiroz Papelaria" },
      {
        name: "description",
        content:
          "Participe dos sorteios da Queiroz Papelaria: entre com seu CPF, registre suas notas e acompanhe seus cupons.",
      },
      { property: "og:title", content: "Portal de Sorteios | Queiroz Papelaria" },
      {
        property: "og:description",
        content:
          "Participe dos sorteios da Queiroz Papelaria: entre com seu CPF, registre suas notas e acompanhe seus cupons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EntradaPortal() {
  const navigate = useNavigate();
  const iniciar = useServerFn(iniciarAcessoPublico);
  const sorteioFn = useServerFn(obterSorteioAtivoPublico);
  const sorteio = useQuery({
    queryKey: ["portal-sorteio-ativo"],
    queryFn: () => sorteioFn({}),
    retry: false,
    staleTime: 60_000,
  });

  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const indisponivel = sorteio.data && !sorteio.data.ok ? sorteio.data.mensagem : null;

  async function continuar() {
    setErro("");
    const valido = validarCpf(cpf);
    if (!valido.ok) {
      setErro(valido.erro ?? "CPF inválido.");
      return;
    }
    setEnviando(true);
    try {
      const resultado = await iniciar({ data: { cpf } });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      gravarFluxo({ cpf });
      void navigate({ to: "/sorteios-publico/telefone" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico
      titulo="Participe do sorteio"
      subtitulo="Informe seu CPF para começar. É rápido e seguro."
    >
      <Card>
        <CardContent className="pt-6 space-y-5">
          {indisponivel ? (
            <p className="text-sm text-muted-foreground text-center py-4">{indisponivel}</p>
          ) : (
            <>
              <CampoCpf valor={cpf} aoMudar={setCpf} autoFocus />
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button
                className="w-full h-12 text-base"
                disabled={enviando}
                onClick={() => void continuar()}
              >
                {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
                Continuar
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Seus dados são usados apenas para a participação no sorteio.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </LayoutPublico>
  );
}
