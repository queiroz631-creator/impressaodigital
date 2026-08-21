import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Printer, Save, ShieldAlert, Trash2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { listarImpressoras, qzDisponivel, testarImpressora } from "@/lib/impressora";
import { PIX_MENSAGEM_PADRAO, PRAZO_MENSAGEM_PADRAO } from "@/lib/orcamento-extras";
import { Switch } from "@/components/ui/switch";


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
  impressora_padrao_tipo: string;
  impressoras_padrao: string[];
  pix_ativo: boolean;
  pix_chave: string;
  pix_nome: string;
  pix_banco: string;
  pix_mensagem: string;
  mensagem_prazo_orcamento: string;
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
  impressora_padrao_tipo: "navegador",
  impressoras_padrao: [],
  pix_ativo: false,
  pix_chave: "",
  pix_nome: "",
  pix_banco: "",
  pix_mensagem: PIX_MENSAGEM_PADRAO,
  mensagem_prazo_orcamento: PRAZO_MENSAGEM_PADRAO,
};


function Configuracoes() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: carregandoPapel } = useIsAdmin(user?.id);
  const { data: config, isLoading } = useConfiguracao();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [impressorasDetectadas, setImpressorasDetectadas] = useState<string[]>([]);
  const [novaImpressora, setNovaImpressora] = useState("");
  const impressaoDireta = qzDisponivel();

  useEffect(() => {
    listarImpressoras()
      .then(setImpressorasDetectadas)
      .catch(() => setImpressorasDetectadas([]));
  }, []);

  useEffect(() => {
    if (!config) return;
    const lista = Array.isArray(config.impressoras_padrao)
      ? (config.impressoras_padrao as unknown[]).map((n) => String(n)).filter(Boolean)
      : [];
    const padrao = config.impressora_padrao_nome?.trim();
    if (padrao && !lista.includes(padrao)) lista.unshift(padrao);
    setForm({
      empresa_nome: config.empresa_nome ?? "",
      telefone: config.telefone ?? "",
      whatsapp: config.whatsapp ?? "",
      email: config.email ?? "",
      endereco: config.endereco ?? "",
      instagram: config.instagram ?? "",
      rodape_orcamento: config.rodape_orcamento ?? "",
      validade_padrao_dias: config.validade_padrao_dias ?? 7,
      impressora_padrao_tipo: config.impressora_padrao_tipo ?? "navegador",
      impressoras_padrao: lista,
      pix_ativo: config.pix_ativo ?? false,
      pix_chave: config.pix_chave ?? "",
      pix_nome: config.pix_nome ?? "",
      pix_banco: config.pix_banco ?? "",
      pix_mensagem: config.pix_mensagem || PIX_MENSAGEM_PADRAO,
      mensagem_prazo_orcamento: config.mensagem_prazo_orcamento || PRAZO_MENSAGEM_PADRAO,
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
      impressora_padrao_nome: form.impressoras_padrao[0] ?? null,
      impressora_padrao_tipo: form.impressora_padrao_tipo,
      impressora_padrao_largura: 80,
      impressoras_padrao: form.impressoras_padrao,
      pix_ativo: form.pix_ativo,
      pix_chave: form.pix_chave || null,
      pix_nome: form.pix_nome || null,
      pix_banco: form.pix_banco || null,
      pix_mensagem: form.pix_mensagem || PIX_MENSAGEM_PADRAO,
      mensagem_prazo_orcamento: form.mensagem_prazo_orcamento || PRAZO_MENSAGEM_PADRAO,
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

      <Card className="mt-6 max-w-3xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Pagamento PIX e prazo de entrega</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Habilitar PIX nos orçamentos</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, é possível incluir os dados do PIX ao gerar o orçamento.
              </p>
            </div>
            <Switch checked={form.pix_ativo} onCheckedChange={(v) => set("pix_ativo", v)} />
          </div>
          <div>
            <Label htmlFor="pix_chave">Chave PIX</Label>
            <Input
              id="pix_chave"
              value={form.pix_chave}
              onChange={(e) => set("pix_chave", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pix_nome">Nome do beneficiário</Label>
            <Input
              id="pix_nome"
              value={form.pix_nome}
              onChange={(e) => set("pix_nome", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pix_banco">Banco</Label>
            <Input
              id="pix_banco"
              value={form.pix_banco}
              onChange={(e) => set("pix_banco", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pix_mensagem">Mensagem do PIX</Label>
            <Textarea
              id="pix_mensagem"
              rows={4}
              value={form.pix_mensagem}
              onChange={(e) => set("pix_mensagem", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Variáveis: {"{chave_pix}"}, {"{nome_pix}"}, {"{banco_pix}"}, {"{empresa}"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="msg_prazo">Mensagem do prazo de entrega</Label>
            <Textarea
              id="msg_prazo"
              rows={2}
              value={form.mensagem_prazo_orcamento}
              onChange={(e) => set("mensagem_prazo_orcamento", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Variável: {"{prazo}"}</p>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={salvar} disabled={salvando}>
              <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>



      <Card className="mt-6 max-w-3xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Impressão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Estas impressoras serão utilizadas como padrão para impressão de etiquetas e recibos
            térmicos de 80mm. A impressão usa a ordem da lista: a primeira disponível é escolhida.
          </p>

          <div className="space-y-2">
            <Label>Impressoras padrão</Label>
            <div className="flex flex-col gap-2">
              {form.impressoras_padrao.map((nome, i) => (
                <div key={`${nome}-${i}`} className="flex items-center gap-2">
                  <Input
                    value={nome}
                    onChange={(e) =>
                      set(
                        "impressoras_padrao",
                        form.impressoras_padrao.map((n, idx) => (idx === i ? e.target.value : n)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remover impressora"
                    onClick={() =>
                      set(
                        "impressoras_padrao",
                        form.impressoras_padrao.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {form.impressoras_padrao.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma impressora configurada.</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Input
                list="impressoras-detectadas"
                value={novaImpressora}
                placeholder={
                  impressorasDetectadas.length > 0
                    ? "Selecionar impressora"
                    : "Nome da impressora (ex.: POS-80)"
                }
                onChange={(e) => setNovaImpressora(e.target.value)}
              />
              <datalist id="impressoras-detectadas">
                {impressorasDetectadas.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
              <Button
                variant="outline"
                onClick={() => {
                  const nome = novaImpressora.trim();
                  if (!nome) return;
                  if (form.impressoras_padrao.includes(nome)) {
                    toast.error("Essa impressora já está na lista.");
                    return;
                  }
                  set("impressoras_padrao", [...form.impressoras_padrao, nome]);
                  setNovaImpressora("");
                }}
              >
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {!impressaoDireta && (
              <p className="text-xs text-muted-foreground">
                Impressão direta não disponível neste computador. Você pode informar o nome da
                impressora manualmente, mas a seleção automática depende da integração local (QZ
                Tray).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Formato da etiqueta</Label>
            <Input value="80mm" readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label>Método de impressão</Label>
            <RadioGroup
              value={form.impressora_padrao_tipo}
              onValueChange={(v) => set("impressora_padrao_tipo", v)}
              className="gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="navegador" id="metodo-navegador" />
                <Label htmlFor="metodo-navegador">Impressão pelo navegador</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="qz" id="metodo-qz" disabled={!impressaoDireta} />
                <Label htmlFor="metodo-qz">Impressão direta via QZ Tray</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const resultado = await testarImpressora(form.impressoras_padrao[0] ?? null, 80);
                if (resultado.metodo === "qz") toast.success("Teste enviado para a impressora.");
              }}
            >
              <Printer className="h-4 w-4" /> Testar impressão
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}