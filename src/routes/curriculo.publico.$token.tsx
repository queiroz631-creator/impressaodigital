import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { FormularioCurriculo } from "@/components/curriculo/FormularioCurriculo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import {
  carregarCurriculoPublico,
  criarCurriculoPublico,
  salvarCurriculoPublico,
} from "@/lib/curriculo.functions";
import { cpfValido, formatarCpf, formatarTelefone, somenteNumeros, type CurriculoCompleto, type PayloadEtapa } from "@/lib/curriculo";

export const Route = createFileRoute("/curriculo/publico/$token")({
  head: () => ({
    meta: [
      { title: "Preencha seu currículo" },
      { name: "description", content: "Preencha os dados do seu currículo profissional em poucos passos." },
      { property: "og:title", content: "Preencha seu currículo" },
      { property: "og:description", content: "Formulário rápido para montar o seu currículo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CurriculoPublico,
});

function CurriculoPublico() {
  const { token } = Route.useParams();
  const carregar = useServerFn(carregarCurriculoPublico);
  const salvar = useServerFn(salvarCurriculoPublico);
  const criar = useServerFn(criarCurriculoPublico);
  const queryClient = useQueryClient();
  const [concluido, setConcluido] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["curriculo-publico", token],
    retry: false,
    queryFn: () => carregar({ data: { token } }),
  });

  const conteudo = () => {
    if (isLoading) return <Skeleton className="h-72 w-full" />;

    if (error || !data) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">Este link expirou. Solicite um novo link ao atendimento.</p>
          </CardContent>
        </Card>
      );
    }

    if (concluido) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Currículo enviado com sucesso!</p>
            <p className="text-sm text-muted-foreground">
              Obrigado. Nossa equipe já pode preparar a impressão do seu currículo.
            </p>
          </CardContent>
        </Card>
      );
    }

    // Link de criação: o cliente precisa se identificar antes de preencher.
    if (data.novo) {
      return (
        <IdentificacaoNovoCurriculo
          expiraEm={data.expiraEm}
          onCriado={(dados) => {
            queryClient.setQueryData(["curriculo-publico", token], dados);
          }}
        />
      );
    }

    const dados: CurriculoCompleto = {
      curriculo: data.curriculo as CurriculoCompleto["curriculo"],
      telefones: data.telefones,
      cursos: data.cursos,
      formacoes: data.formacoes,
      experiencias: data.experiencias,
      habilidades: data.habilidades,
    };

    return (
      <FormularioCurriculo
        dados={dados}
        catalogoHabilidades={data.catalogoHabilidades}
        objetivosSugeridos={data.objetivosSugeridos}
        modo="publico"
        salvar={async (payload: PayloadEtapa) => {
          await salvar({ data: { token, payload } });
        }}
        onFinalizado={() => setConcluido(true)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-muted/40 py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <header className="mb-6 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {data?.empresaNome ?? ""}
          </p>
          <h1 className="text-2xl font-extrabold">Preencha seu currículo</h1>
        </header>
        {conteudo()}
      </div>
    </div>
  );

  function IdentificacaoNovoCurriculo({
    expiraEm,
    onCriado,
  }: {
    expiraEm: string;
    onCriado: (dados: Awaited<ReturnType<typeof criar>>) => void;
  }) {
    const [nome, setNome] = useState("");
    const [cpf, setCpf] = useState("");
    const [telefone, setTelefone] = useState("");
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      const nomeTrim = nome.trim();
      if (nomeTrim.length < 2) {
        setErro("Informe seu nome completo.");
        return;
      }
      if (!cpfValido(somenteNumeros(cpf))) {
        setErro("CPF inválido. Verifique os dígitos.");
        return;
      }
      if (somenteNumeros(telefone).length < 10) {
        setErro("Informe um telefone válido com DDD.");
        return;
      }
      setSalvando(true);
      try {
        const dados = await criar({ data: { token, nome: nomeTrim, cpf, telefone } });
        onCriado(dados);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Não foi possível iniciar o currículo.");
      } finally {
        setSalvando(false);
      }
    };

    return (
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-bold">Identificação</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Informe seus dados para começarmos a montar o seu currículo.
          </p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
              />
            </div>
            {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Iniciando..." : "Começar currículo"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Link válido até {new Date(expiraEm).toLocaleDateString("pt-BR")}.
            </p>
          </form>
        </CardContent>
      </Card>
    );
  }
}
