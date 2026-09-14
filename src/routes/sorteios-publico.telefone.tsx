import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutPublico } from "@/modules/sorteios/components/publico/LayoutPublico";
import { CampoTelefone } from "@/modules/sorteios/components/publico/CamposPublico";
import { verificarTelefonePublico } from "@/lib/sorteios-publico.functions";
import { gravarFluxo, lerFluxo, limparFluxo } from "@/modules/sorteios/services/fluxo-publico";
import { telefoneRaw } from "@/lib/format";

const META_PRIVADA = [
  { title: "Portal de Sorteios | Queiroz Papelaria" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/telefone")({
  component: TelefonePortal,
  head: () => ({ meta: META_PRIVADA }),
});

function TelefonePortal() {
  const navigate = useNavigate();
  const verificar = useServerFn(verificarTelefonePublico);
  const [fluxo, setFluxo] = useState(() => lerFluxo());
  const [telefone, setTelefone] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!fluxo.cpf) void navigate({ to: "/sorteios-publico" });
  }, [fluxo.cpf, navigate]);

  if (!fluxo.cpf) return null;

  async function continuar() {
    setErro("");
    if (telefoneRaw(telefone).length < 10) {
      setErro("Informe o telefone com DDD.");
      return;
    }
    setEnviando(true);
    try {
      const resultado = await verificar({
        data: { cpf: fluxo.cpf!, telefone, lembrar },
      });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      const { etapa } = resultado.dados;
      if (etapa === "cadastro") {
        gravarFluxo({ ...fluxo, telefone, lembrar });
        void navigate({ to: "/sorteios-publico/cadastro" });
        return;
      }
      if (etapa === "completar") {
        gravarFluxo({ ...fluxo, telefone, lembrar, faltantes: resultado.dados.faltantes });
        void navigate({ to: "/sorteios-publico/cadastro" });
        return;
      }
      limparFluxo();
      void navigate({
        to: etapa === "termos" ? "/sorteios-publico/termos" : "/sorteios-publico/painel",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico
      titulo="Confirme seu telefone"
      subtitulo="Informe o telefone usado no seu cadastro."
    >
      <Card>
        <CardContent className="pt-6 space-y-5">
          <CampoTelefone valor={telefone} aoMudar={setTelefone} autoFocus />
          <label className="flex items-center gap-3 text-sm text-foreground">
            <Checkbox
              checked={lembrar}
              onCheckedChange={(v) => setLembrar(v === true)}
            />
            Lembrar neste dispositivo
          </label>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button
            className="w-full h-12 text-base"
            disabled={enviando}
            onClick={() => void continuar()}
          >
            {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
            Continuar
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline"
            onClick={() => {
              setFluxo({});
              limparFluxo();
              void navigate({ to: "/sorteios-publico" });
            }}
          >
            Usar outro CPF
          </button>
        </CardContent>
      </Card>
    </LayoutPublico>
  );
}
