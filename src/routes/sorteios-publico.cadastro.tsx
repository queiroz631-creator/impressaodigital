import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LayoutPublico } from "@/modules/sorteios/components/publico/LayoutPublico";
import { concluirCadastroPublico } from "@/lib/sorteios-publico.functions";
import { lerFluxo, limparFluxo } from "@/modules/sorteios/services/fluxo-publico";

/** Aplica a máscara DD/MM/AAAA enquanto a pessoa digita (somente números). */
function mascararData(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** Converte DD/MM/AAAA para AAAA-MM-DD (formato aceito pelo servidor). */
function dataTextoParaIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  if (data.getDate() !== Number(dia) || data.getMonth() + 1 !== Number(mes)) return null;
  return `${ano}-${mes}-${dia}`;
}

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
          data_nascimento: pedeNascimento ? (dataTextoParaIso(nascimento) ?? "") : "",
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
              <div className="flex gap-2">
                <Input
                  id="nascimento"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  className="h-12 text-lg"
                  value={nascimento}
                  maxLength={10}
                  onChange={(e) => setNascimento(mascararData(e.target.value))}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0"
                      aria-label="Escolher no calendário"
                    >
                      <CalendarIcon className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      locale={ptBR}
                      selected={dataTextoParaIso(nascimento) ? new Date(`${dataTextoParaIso(nascimento)}T00:00:00`) : undefined}
                      onSelect={(data) => setNascimento(data ? format(data, "dd/MM/yyyy") : "")}
                      disabled={{ after: new Date() }}
                      defaultMonth={
                        dataTextoParaIso(nascimento)
                          ? new Date(`${dataTextoParaIso(nascimento)}T00:00:00`)
                          : new Date(new Date().getFullYear() - 30, 0, 1)
                      }
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground">
                Digite a data ou toque no calendário para escolher.
              </p>
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
