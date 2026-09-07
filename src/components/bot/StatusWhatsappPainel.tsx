import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Plus, Send, Trash2, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicarStatusAgora, sincronizarAgendaStatus } from "@/lib/status-whatsapp.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConfirmarExclusao } from "@/components/ConfirmarExclusao";

type Status = {
  id: string;
  tipo: string;
  texto: string;
  cor_fundo: string;
  imagem_url: string | null;
  imagem_nome: string | null;
  legenda: string;
  modo: string;
  agendado_em: string | null;
  dias_semana: number[] | null;
  hora: string | null;
  ativo: boolean;
  ultima_publicacao_em: string | null;
  ultimo_erro: string | null;
};

const DIAS = [
  { valor: 0, rotulo: "Dom" },
  { valor: 1, rotulo: "Seg" },
  { valor: 2, rotulo: "Ter" },
  { valor: 3, rotulo: "Qua" },
  { valor: 4, rotulo: "Qui" },
  { valor: 5, rotulo: "Sex" },
  { valor: 6, rotulo: "Sáb" },
];

const VAZIO = {
  tipo: "texto",
  texto: "",
  cor_fundo: "#0b7285",
  imagem_url: null as string | null,
  imagem_nome: null as string | null,
  legenda: "",
  modo: "uma_vez",
  agendado_em: "",
  dias_semana: [] as number[],
  hora: "09:00",
  ativo: true,
};

function dataLocalParaISO(valor: string) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isoParaCampoLocal(valor: string | null) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function descreverAgenda(s: Status) {
  if (s.modo === "uma_vez") {
    return s.agendado_em ? `Uma vez em ${new Date(s.agendado_em).toLocaleString("pt-BR")}` : "Sem data definida";
  }
  const dias = (s.dias_semana ?? []).map((d) => DIAS.find((x) => x.valor === d)?.rotulo).filter(Boolean);
  return `${dias.length ? dias.join(", ") : "Sem dias"} às ${(s.hora ?? "").slice(0, 5)}`;
}

/** Programa textos e imagens para publicação automática no Status do WhatsApp. */
export function StatusWhatsappPainel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...VAZIO });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  const lista = useQuery({
    queryKey: ["bot-status-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_status_whatsapp")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Status[];
    },
  });

  async function sincronizar() {
    try {
      await sincronizarAgendaStatus({ data: undefined });
    } catch {
      /* o arquivo é recriado na próxima verificação */
    }
    queryClient.invalidateQueries({ queryKey: ["bot-status-whatsapp"] });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (form.tipo === "texto" && !form.texto.trim()) throw new Error("Escreva o texto do status.");
      if (form.tipo === "imagem" && !form.imagem_url) throw new Error("Anexe a imagem do status.");
      if (form.modo === "uma_vez" && !form.agendado_em) throw new Error("Informe a data e a hora.");
      if (form.modo === "recorrente" && form.dias_semana.length === 0)
        throw new Error("Escolha ao menos um dia da semana.");

      const registro = {
        tipo: form.tipo,
        texto: form.texto,
        cor_fundo: form.cor_fundo,
        imagem_url: form.imagem_url,
        imagem_nome: form.imagem_nome,
        legenda: form.legenda,
        modo: form.modo,
        agendado_em: form.modo === "uma_vez" ? dataLocalParaISO(form.agendado_em) : null,
        dias_semana: form.modo === "recorrente" ? form.dias_semana : [],
        hora: form.modo === "recorrente" ? form.hora : null,
        ativo: form.ativo,
      };

      const { error } = editandoId
        ? await supabase.from("bot_status_whatsapp").update(registro).eq("id", editandoId)
        : await supabase.from("bot_status_whatsapp").insert(registro);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(editandoId ? "Publicação atualizada." : "Publicação programada.");
      setForm({ ...VAZIO });
      setEditandoId(null);
      await sincronizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("bot_status_whatsapp").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: sincronizar,
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bot_status_whatsapp").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Publicação excluída.");
      await sincronizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicar = useMutation({
    mutationFn: async (id: string) => publicarStatusAgora({ data: { id } }),
    onSuccess: async (r) => {
      if (r.ok) toast.success("Status publicado.");
      else toast.error(r.erro ?? "Não foi possível publicar.");
      await sincronizar();
    },
    onError: () => toast.error("Não foi possível publicar."),
  });

  async function subirImagem(arquivo: File) {
    setEnviandoArquivo(true);
    try {
      const extensao = arquivo.name.split(".").pop() ?? "jpg";
      const caminho = `status/${crypto.randomUUID()}.${extensao}`;
      const { error } = await supabase.storage.from("bot-midia").upload(caminho, arquivo, { upsert: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      setForm((f) => ({ ...f, imagem_url: caminho, imagem_nome: arquivo.name }));
      toast.success("Imagem anexada.");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  function editar(s: Status) {
    setEditandoId(s.id);
    setForm({
      tipo: s.tipo,
      texto: s.texto,
      cor_fundo: s.cor_fundo,
      imagem_url: s.imagem_url,
      imagem_nome: s.imagem_nome,
      legenda: s.legenda,
      modo: s.modo,
      agendado_em: isoParaCampoLocal(s.agendado_em),
      dias_semana: s.dias_semana ?? [],
      hora: (s.hora ?? "09:00").slice(0, 5),
      ativo: s.ativo,
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editandoId ? "Editar publicação" : "Nova publicação no Status"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RadioGroup
            className="flex gap-6"
            value={form.tipo}
            onValueChange={(v) => setForm({ ...form, tipo: v })}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="texto" id="status-texto" />
              <Label htmlFor="status-texto" className="flex items-center gap-1">
                <Type className="h-4 w-4" /> Texto
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="imagem" id="status-imagem" />
              <Label htmlFor="status-imagem" className="flex items-center gap-1">
                <ImageIcon className="h-4 w-4" /> Imagem
              </Label>
            </div>
          </RadioGroup>

          {form.tipo === "texto" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1">
                <Label>Texto do status *</Label>
                <Textarea
                  rows={3}
                  value={form.texto}
                  onChange={(e) => setForm({ ...form, texto: e.target.value })}
                  placeholder="Ex.: Impressão colorida a partir de R$ 1,00 a página!"
                />
              </div>
              <div className="grid gap-1">
                <Label>Cor de fundo</Label>
                <Input
                  type="color"
                  className="h-10 w-20 p-1"
                  value={form.cor_fundo}
                  onChange={(e) => setForm({ ...form, cor_fundo: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Imagem *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={enviandoArquivo}
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) void subirImagem(arquivo);
                  }}
                />
                {form.imagem_nome ? (
                  <span className="text-xs text-muted-foreground">Anexada: {form.imagem_nome}</span>
                ) : null}
              </div>
              <div className="grid gap-1">
                <Label>Legenda</Label>
                <Input
                  value={form.legenda}
                  onChange={(e) => setForm({ ...form, legenda: e.target.value })}
                  placeholder="Texto que aparece na imagem"
                />
              </div>
            </div>
          )}

          <RadioGroup
            className="flex gap-6"
            value={form.modo}
            onValueChange={(v) => setForm({ ...form, modo: v })}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="uma_vez" id="modo-uma-vez" />
              <Label htmlFor="modo-uma-vez">Uma vez</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="recorrente" id="modo-recorrente" />
              <Label htmlFor="modo-recorrente">Recorrente</Label>
            </div>
          </RadioGroup>

          {form.modo === "uma_vez" ? (
            <div className="grid gap-1 sm:max-w-xs">
              <Label>Data e hora *</Label>
              <Input
                type="datetime-local"
                value={form.agendado_em}
                onChange={(e) => setForm({ ...form, agendado_em: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1">
                <Label>Dias da semana *</Label>
                <div className="flex flex-wrap gap-1">
                  {DIAS.map((d) => {
                    const marcado = form.dias_semana.includes(d.valor);
                    return (
                      <Button
                        key={d.valor}
                        type="button"
                        size="sm"
                        variant={marcado ? "default" : "outline"}
                        onClick={() =>
                          setForm({
                            ...form,
                            dias_semana: marcado
                              ? form.dias_semana.filter((x) => x !== d.valor)
                              : [...form.dias_semana, d.valor].sort(),
                          })
                        }
                      >
                        {d.rotulo}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-1">
                <Label>Horário</Label>
                <Input
                  type="time"
                  className="w-32"
                  value={form.hora}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativa</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || enviandoArquivo}>
              <Plus className="mr-1 h-4 w-4" />
              {editandoId ? "Salvar alterações" : "Programar publicação"}
            </Button>
            {editandoId ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditandoId(null);
                  setForm({ ...VAZIO });
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publicações programadas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {lista.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (lista.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma publicação programada ainda.</p>
          ) : (
            (lista.data ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.tipo === "imagem" ? "secondary" : "outline"}>
                      {s.tipo === "imagem" ? "Imagem" : "Texto"}
                    </Badge>
                    <span className="truncate text-sm font-medium">
                      {s.tipo === "imagem" ? (s.legenda || s.imagem_nome || "Imagem") : s.texto}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{descreverAgenda(s)}</p>
                  {s.ultima_publicacao_em ? (
                    <p className="text-xs text-muted-foreground">
                      Última: {new Date(s.ultima_publicacao_em).toLocaleString("pt-BR")}
                    </p>
                  ) : null}
                  {s.ultimo_erro ? <p className="text-xs text-destructive">{s.ultimo_erro}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.ativo}
                    onCheckedChange={(v) => alternarAtivo.mutate({ id: s.id, ativo: v })}
                  />
                  <Button size="sm" variant="outline" onClick={() => publicar.mutate(s.id)}>
                    <Send className="mr-1 h-4 w-4" /> Publicar agora
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => editar(s)}>
                    Editar
                  </Button>
                  <ConfirmarExclusao
                    titulo="Excluir publicação?"
                    descricao="A publicação programada será removida."
                    onConfirmar={() => excluir.mutate(s.id)}
                  >
                    <Button size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmarExclusao>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
