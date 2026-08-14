import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfiguracao } from "@/hooks/useDados";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <AppLayout>
      <Configuracoes />
    </AppLayout>
  ),
  head: () => ({
    meta: [
      { title: "Configurações | Impressão Digital" },
      { name: "description", content: "Dados da empresa, contatos e padrões usados nos orçamentos." },
      { property: "og:title", content: "Configurações | Impressão Digital" },
      { property: "og:description", content: "Personalize os dados exibidos nos orçamentos em PDF." },
    ],
  }),
});

interface Form {
  empresa_nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  instagram: string;
  rodape_orcamento: string;
  validade_padrao_dias: number;
}

const vazio: Form = {
  empresa_nome: "",
  telefone: "",
  whatsapp: "",
  email: "",
  endereco: "",
  instagram: "",
  rodape_orcamento: "",
  validade_padrao_dias: 7,
};

function Configuracoes() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: carregandoPapel } = useIsAdmin(user?.id);
  const { data: config, isLoading } = useConfiguracao();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(vazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      empresa_nome: config.empresa_nome ?? "",
      telefone: config.telefone ?? "",
      whatsapp: config.whatsapp ?? "",
      email: config.email ?? "",
      endereco: config.endereco ?? "",
      instagram: config.instagram ?? "",
      rodape_orcamento: config.rodape_orcamento ?? "",
      validade_padrao_dias: config.validade_padrao_dias ?? 7,
    });
  }, [config]);

  function set<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    if (!form.empresa_nome.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    setSalvando(true);
    const payload = {
      empresa_nome: form.empresa_nome.trim(),
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      endereco: form.endereco || null,
      instagram: form.instagram || null,
      rodape_orcamento: form.rodape_orcamento,
      validade_padrao_dias: Number(form.validade_padrao_dias) || 7,
    };
    const { error } = config
      ? await supabase.from("configuracoes").update(payload).eq("id", config.id)
      : await supabase.from("configuracoes").insert(payload);
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
    toast.success("Configurações salvas com sucesso.");
  }

  if (carregandoPapel || isLoading) return <Skeleton className="h-96 w-full" />;

  if (!isAdmin) {
    return (
      <>
        <PageHeader titulo="CONFIGURAÇÕES" />
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">
              Somente administradores podem alterar as configurações.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="CONFIGURAÇÕES" subtitulo="Dados usados no cabeçalho e rodapé dos orçamentos." />
      <Card className="max-w-3xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="empresa">Nome da empresa</Label>
            <Input
              id="empresa"
              value={form.empresa_nome}
              onChange={(e) => set("empresa_nome", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validade">Validade padrão (dias)</Label>
            <Input
              id="validade"
              type="number"
              min="1"
              value={form.validade_padrao_dias}
              onChange={(e) => set("validade_padrao_dias", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rodape">Rodapé do orçamento</Label>
            <Textarea
              id="rodape"
              rows={3}
              value={form.rodape_orcamento}
              onChange={(e) => set("rodape_orcamento", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={salvar} disabled={salvando}>
              <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}