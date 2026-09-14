import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutPublico } from "@/modules/sorteios/components/publico/LayoutPublico";
import { concluirCadastroPublico } from "@/lib/sorteios-publico.functions";
import { lerFluxo, limparFluxo } from "@/modules/sorteios/services/fluxo-publico";

const META_PRIVADA = [
  { title: "Portal de Sorteios | Queiroz Papelaria" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/cadastro")({
  component: CadastroPortal,
  head: () => ({ meta: META_PRIVADA }),
});

function CadastroPortal() {
  const navigate = useNavigate();
  const concluir = useServerFn(concluirCadastroPublico);
  const [fluxo] = useState(() => lerFluxo());
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const faltantes = fluxo.faltantes;
  const pedeNome = !faltantes || faltantes.includes("nome");
  const pedeNascimento = !faltantes || faltantes.includes("data_nascimento");

  useEffect(() => {
    if (!fluxo.cpf || !fluxo.telefone) void navigate({ to: "/sorteios-publico" });
  }, [fluxo.cpf, fluxo.telefone, navigate]);

  if (!fluxo.cpf || !fluxo.telefone) return null;

  async function concluirCadastro() {
    setErro("");
    setEnviando(true);
    try {
      const resultado = await concluir({
        data: {
          cpf: fluxo.cpf!,
          telefone: fluxo.telefone!,
          lembrar: fluxo.lembrar ?? false,
          nome: pedeNome ? nome : "",
          data_nascimento: pedeNascimento ? nascimento : "",
        },
      });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      limparFluxo();
      const { etapa } = resultado.dados;
      void navigate({
        to:
          etapa === "termos"
            ? "/sorteios-publico/termos"
            : etapa === "painel"
              ? "/sorteios-publico/painel"
              : "/sorteios-publico",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico
      titulo={faltantes ? "Complete seu cadastro" : "Crie seu cadastro"}
      subtitulo={
        faltantes
          ? "Precisamos só de mais uma informação para continuar."
          : "Você é novo por aqui! Preencha seus dados para participar."
      }
    >
      <Card>
        <CardContent className="pt-6 space-y-5">
          {pedeNome && (
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                placeholder="Nome e sobrenome"
                className="h-12 text-lg"
                value={nome}
                autoFocus
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
          )}
          {pedeNascimento && (
            <div className="space-y-2">
              <Label htmlFor="nascimento">Data de nascimento</Label>
              <Input
                id="nascimento"
                type="date"
                className="h-12 text-lg"
                value={nascimento}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setNascimento(e.target.value)}
              />
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button
            className="w-full h-12 text-base"
            disabled={enviando}
            onClick={() => void concluirCadastro()}
          >
            {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
            Continuar
          </Button>
        </CardContent>
      </Card>
    </LayoutPublico>
  );
}
