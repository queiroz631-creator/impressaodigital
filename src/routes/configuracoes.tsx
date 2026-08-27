import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { statusInstanciaZapi } from "@/lib/whatsapp.functions";
import { toast } from "sonner";
import { Copy, Plus, Printer, RefreshCw, Save, ShieldAlert, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfiguracao } from "@/hooks/useDados";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  listarImpressoras,
  statusQz,
  testarImpressora,
  ultimoErroQz,
  type StatusQz,
} from "@/lib/impressora";
import { PIX_MENSAGEM_PADRAO, PRAZO_MENSAGEM_PADRAO } from "@/lib/orcamento-extras";
import { PerfisImpressao } from "@/components/PerfisImpressao";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";



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
  const [qz, setQz] = useState<StatusQz | "verificando">("verificando");
  const [erroQz, setErroQz] = useState<string | null>(null);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState(false);
  const impressaoDireta = qz === "conectado";

  async function verificarQz() {
    setQz("verificando");
    setErroQz(null);
    const status = await statusQz();
    setQz(status);
    if (status === "conectado") {
      const lista = await listarImpressoras().catch(() => []);
      setImpressorasDetectadas(lista);
      if (lista.length === 0) setErroQz(ultimoErroQz());
    } else {
      setImpressorasDetectadas([]);
      setErroQz(ultimoErroQz());
    }
  }

  function adicionarImpressora(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    if (form.impressoras_padrao.some((n) => n.toLowerCase() === limpo.toLowerCase())) {
      toast.error("Essa impressora já está na lista.");
      return;
    }
    set("impressoras_padrao", [...form.impressoras_padrao, limpo]);
    toast.success(`"${limpo}" adicionada. Clique em Salvar Alterações.`);
  }


  useEffect(() => {
    void verificarQz();
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
    setAlteracoesPendentes(true);
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    if (!form.empresa_nome.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    const impressoras = form.impressoras_padrao.map((n) => n.trim()).filter(Boolean);
    if (form.impressora_padrao_tipo === "qz" && impressoras.length === 0) {
      toast.error(
        "Adicione ao menos uma impressora para usar a impressão direta via QZ Tray.",
      );
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
      impressora_padrao_nome: impressoras[0] ?? null,
      impressora_padrao_tipo: form.impressora_padrao_tipo,
      impressora_padrao_largura: 80,
      impressoras_padrao: impressoras,
      pix_ativo: form.pix_ativo,
      pix_chave: form.pix_chave || null,
      pix_nome: form.pix_nome || null,
      pix_banco: form.pix_banco || null,
      pix_mensagem: form.pix_mensagem || PIX_MENSAGEM_PADRAO,
      mensagem_prazo_orcamento: form.mensagem_prazo_orcamento || PRAZO_MENSAGEM_PADRAO,
    };

    const { data, error } = config
      ? await supabase.from("configuracoes").update(payload).eq("id", config.id).select()
      : await supabase.from("configuracoes").insert(payload).select();
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Nada foi salvo: você não tem permissão para alterar as configurações.");
      return;
    }
    setAlteracoesPendentes(false);
    await queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
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

      <Tabs defaultValue="empresa" className="max-w-3xl">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="pix">PIX e prazo</TabsTrigger>
          <TabsTrigger value="impressao">Impressão</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="link">Link do orçamento</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
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

        </TabsContent>

        <TabsContent value="pix">
        <Card className="max-w-3xl shadow-card">
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



        </TabsContent>

        <TabsContent value="impressao" className="grid gap-4">
        <Card className="max-w-3xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Impressão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Estas impressoras serão utilizadas como padrão para impressão de etiquetas e recibos
            térmicos de 80mm. A impressão usa a ordem da lista: a primeira disponível é escolhida.
          </p>

          {/*
           * STATUS DA CONEXÃO COM O QZ TRAY
           */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                qz === "conectado"
                  ? "bg-green-500"
                  : qz === "verificando"
                    ? "bg-muted-foreground"
                    : "bg-amber-500"
              }`}
            />
            <div className="min-w-40 flex-1 text-sm">
              <p className="font-medium">
                {qz === "conectado" && "QZ Tray conectado"}
                {qz === "verificando" && "Verificando QZ Tray..."}
                {qz === "agente_ausente" && "QZ Tray não detectado"}
                {qz === "script_indisponivel" && "Integração QZ Tray indisponível"}
              </p>
              <p className="text-xs text-muted-foreground">
                {qz === "conectado" &&
                  `${impressorasDetectadas.length} impressora(s) encontrada(s). Impressão direta ativa.`}
                {qz === "verificando" && "Aguarde enquanto a conexão é estabelecida."}
                {qz === "agente_ausente" &&
                  "Instale e inicie o QZ Tray neste computador para imprimir direto na térmica."}
                {qz === "script_indisponivel" &&
                  "Não foi possível carregar o componente de impressão. Usando o navegador."}
              </p>
              {qz === "agente_ausente" && (
                <a
                  href="https://qz.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary underline"
                >
                  Baixar o QZ Tray (gratuito)
                </a>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => void verificarQz()}>
              <RefreshCw className="h-4 w-4" /> Reconectar
            </Button>
          </div>

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

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Impressoras encontradas no computador</Label>
                <Button variant="outline" size="sm" onClick={() => void verificarQz()}>
                  <RefreshCw className="h-4 w-4" /> Buscar
                </Button>
              </div>

              {impressorasDetectadas.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {impressorasDetectadas.map((nome) => {
                    const jaAdicionada = form.impressoras_padrao.some(
                      (n) => n.toLowerCase() === nome.toLowerCase(),
                    );
                    return (
                      <div
                        key={nome}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                      >
                        <span className="truncate text-sm">{nome}</span>
                        <Button
                          variant={jaAdicionada ? "ghost" : "outline"}
                          size="sm"
                          disabled={jaAdicionada}
                          onClick={() => adicionarImpressora(nome)}
                        >
                          <Plus className="h-4 w-4" />
                          {jaAdicionada ? "Adicionada" : "Adicionar"}
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-1 self-start"
                    onClick={() => {
                      const novas = impressorasDetectadas.filter(
                        (nome) =>
                          !form.impressoras_padrao.some(
                            (n) => n.toLowerCase() === nome.toLowerCase(),
                          ),
                      );
                      if (novas.length === 0) {
                        toast.error("Todas já estão na lista.");
                        return;
                      }
                      set("impressoras_padrao", [...form.impressoras_padrao, ...novas]);
                      toast.success(`${novas.length} impressora(s) adicionada(s).`);
                    }}
                  >
                    Adicionar todas
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {qz === "verificando"
                    ? "Procurando impressoras..."
                    : "Nenhuma impressora encontrada. Verifique se o QZ Tray está em execução e clique em Buscar."}
                </p>
              )}

              {erroQz && <p className="text-xs text-amber-600">Detalhe técnico: {erroQz}</p>}
            </div>


            <div className="flex items-center gap-2 pt-2">
              <Input
                value={novaImpressora}
                placeholder="Informar nome manualmente (ex.: POS-80)"
                onChange={(e) => setNovaImpressora(e.target.value)}
              />
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
                impressora manualmente, mas a seleção automática depende do QZ Tray em execução.
              </p>
            )}
            {alteracoesPendentes && (
              <p className="text-xs font-medium text-amber-600">
                Há alterações não salvas. Clique em "Salvar Alterações" antes de sair da tela.
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

      <PerfisImpressao
        impressorasDetectadas={impressorasDetectadas}
        impressorasConfiguradas={form.impressoras_padrao}
      />

        </TabsContent>

        <TabsContent value="whatsapp" className="grid gap-4">
          <CardWhatsapp />
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-semibold">Atendimento automático (bot)</p>
                <p className="text-xs text-muted-foreground">
                  Horários, menu, respostas automáticas, mensagens e simulador.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/bot">Abrir Configuração do Bot</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="link">
          <CardLinkPublico />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface FormLink {
  permitir_link: boolean;
  mostrar_precos_link: boolean;
  link_permitir_upload: boolean;
  link_permitir_material: boolean;
  link_permitir_acabamento: boolean;
  link_permitir_formato: boolean;
  link_permitir_tipo: boolean;
  link_permitir_copias: boolean;
  link_permitir_frente_verso: boolean;
  link_permitir_confirmacao: boolean;
  link_exigir_telefone: boolean;
}

const CAMPOS_LINK: { chave: keyof FormLink; rotulo: string; ajuda: string }[] = [
  { chave: "permitir_link", rotulo: "Link ativo", ajuda: "Habilita o link público do orçamento enviado ao cliente." },
  { chave: "mostrar_precos_link", rotulo: "Mostrar valores", ajuda: "Exibe o total do orçamento na página do cliente." },
  { chave: "link_permitir_material", rotulo: "Alterar material", ajuda: "O cliente pode trocar o papel/material." },
  { chave: "link_permitir_copias", rotulo: "Alterar cópias", ajuda: "O cliente pode mudar a quantidade de cópias." },
  { chave: "link_permitir_frente_verso", rotulo: "Alterar frente e verso", ajuda: "O cliente pode ligar/desligar frente e verso." },
  { chave: "link_permitir_acabamento", rotulo: "Alterar acabamentos", ajuda: "O cliente pode escolher acabamentos." },
  { chave: "link_permitir_formato", rotulo: "Alterar formato", ajuda: "Permite trocar A3/A4/A5 pelo link." },
  { chave: "link_permitir_tipo", rotulo: "Alterar tipo de impressão", ajuda: "Permite trocar impressão simples/especial." },
  { chave: "link_permitir_upload", rotulo: "Enviar arquivos pelo link", ajuda: "Reservado para envio de novos arquivos pelo cliente." },
  { chave: "link_permitir_confirmacao", rotulo: "Confirmar pelo link", ajuda: "O cliente pode aprovar o pedido pela página." },
  { chave: "link_exigir_telefone", rotulo: "Exigir telefone", ajuda: "Pede confirmação do telefone antes de aprovar." },
];

/** Link público do orçamento enviado ao cliente. */
function CardLinkPublico() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormLink | null>(null);
  const [salvando, setSalvando] = useState(false);

  const config = useQuery({
    queryKey: ["whatsapp-config-link"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const d = config.data;
    if (!d || form) return;
    const inicial = {} as FormLink;
    for (const campo of CAMPOS_LINK) {
      inicial[campo.chave] = Boolean((d as Record<string, unknown>)[campo.chave]);
    }
    setForm(inicial);
  }, [config.data, form]);

  if (config.isLoading || !form) return <Skeleton className="h-64 max-w-3xl" />;

  const id = config.data?.id;

  async function salvarLink() {
    if (!id || !form) return;
    setSalvando(true);
    const { error } = await supabase.from("whatsapp_config").update(form).eq("id", id);
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link do orçamento atualizado.");
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-config-link"] });
  }

  return (
    <Card className="max-w-3xl shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Link público do orçamento</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-5">
        <p className="text-xs text-muted-foreground">
          O cliente recebe um endereço exclusivo para conferir o orçamento. Os valores continuam
          sendo calculados pelo sistema — o cliente só escolhe entre as opções liberadas abaixo.
        </p>

        <div className="grid gap-3">
          {CAMPOS_LINK.map((campo) => (
            <label key={campo.chave} className="flex items-center justify-between gap-4 text-sm">
              <span>
                <strong>{campo.rotulo}</strong>
                <span className="block text-xs text-muted-foreground">{campo.ajuda}</span>
              </span>
              <Switch
                checked={form[campo.chave]}
                onCheckedChange={(v) => setForm({ ...form, [campo.chave]: v })}
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={salvarLink} disabled={salvando}>
            <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar link do orçamento"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
/** Conexão com a Z-API e endereço do webhook do WhatsApp. */
function CardWhatsapp() {
  const [origem, setOrigem] = useState("");
  const consultarStatus = useServerFn(statusInstanciaZapi);

  useEffect(() => setOrigem(window.location.origin), []);

  const config = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("id, conexao_nome, base_url, webhook_token")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const status = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: async () => consultarStatus(),
    retry: false,
  });

  const token = config.data?.webhook_token ?? "";
  const urlWebhook = origem && token ? `${origem}/api/public/whatsapp/webhook?token=${token}` : "";

  const cor = !status.data?.configurado
    ? "bg-muted text-muted-foreground"
    : status.data.conectado
      ? "bg-success text-success-foreground"
      : "bg-destructive text-destructive-foreground";

  return (
    <Card className="max-w-3xl shadow-card">
      <CardHeader>
        <CardTitle className="text-base">WhatsApp (Z-API)</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cor}`}>
            {status.isFetching
              ? "Verificando..."
              : !status.data?.configurado
                ? "Não configurado"
                : status.data.conectado
                  ? "Conectado"
                  : "Desconectado"}
          </span>

          <Button variant="outline" size="sm" onClick={() => status.refetch()} disabled={status.isFetching}>
            <RefreshCw className="h-4 w-4" /> Testar conexão
          </Button>

          <span className="text-xs text-muted-foreground">
            {status.data?.detalhe ?? "Credenciais guardadas com segurança no servidor."}
          </span>
        </div>

        <div className="grid gap-2">
          <Label>URL do webhook (cole no painel da Z-API)</Label>
          <div className="flex gap-2">
            <Input readOnly value={urlWebhook} placeholder="Gerando..." className="font-mono text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!urlWebhook) return;
                await navigator.clipboard.writeText(urlWebhook);
                toast.success("URL copiada.");
              }}
            >
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure em <strong>Ao receber</strong>, <strong>Ao receber status</strong> e{" "}
            <strong>Ao desconectar</strong> na Z-API. O token na URL valida as chamadas recebidas.
          </p>
        </div>

        <div className="grid gap-1 text-xs text-muted-foreground">
          <p>
            Credenciais necessárias (guardadas como segredos do backend):{" "}
            <strong>ZAPI_INSTANCE_ID</strong>, <strong>ZAPI_INSTANCE_TOKEN</strong>,{" "}
            <strong>ZAPI_CLIENT_TOKEN</strong> e, opcionalmente, <strong>ZAPI_BASE_URL</strong>.
          </p>
          <p>Conexão: {config.data?.conexao_nome ?? "Principal"} · Base: {config.data?.base_url ?? "https://api.z-api.io"}</p>
        </div>
      </CardContent>
    </Card>
  );
}


