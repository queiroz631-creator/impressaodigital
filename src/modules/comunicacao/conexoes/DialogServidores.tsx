import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  excluirServidorProvedor,
  listarServidoresProvedor,
  salvarServidorEvolution,
  testarServidorEvolution,
  type ServidorPublico,
} from "@/lib/whatsapp-provedores.functions";
import { segredoRefValido } from "./rotulos";

export const CHAVE_SERVIDORES = "whatsapp-servidores";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

interface Formulario {
  id?: string;
  nome: string;
  baseUrl: string;
  segredoRef: string;
  ativo: boolean;
}

const VAZIO: Formulario = { nome: "", baseUrl: "https://", segredoRef: "EVOLUTION_API_KEY", ativo: true };

export default function DialogServidores({ aberto, onFechar }: Props) {
  const qc = useQueryClient();
  const listar = useServerFn(listarServidoresProvedor);
  const salvar = useServerFn(salvarServidorEvolution);
  const testar = useServerFn(testarServidorEvolution);
  const excluir = useServerFn(excluirServidorProvedor);

  const [form, setForm] = useState<Formulario | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { data: servidores = [], isLoading } = useQuery({
    queryKey: [CHAVE_SERVIDORES],
    queryFn: () => listar(),
    enabled: aberto,
    retry: 1,
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: [CHAVE_SERVIDORES] });

  const gravar = useMutation({
    mutationFn: (f: Formulario) =>
      salvar({ data: { ...f, nome: f.nome.trim(), baseUrl: f.baseUrl.trim(), segredoRef: f.segredoRef.trim() } }),
    onSuccess: (r: { ok: boolean; erro: string | null }) => {
      if (!r.ok) {
        toast.error(r.erro ?? "Não foi possível salvar o servidor.");
        return;
      }
      toast.success("Servidor salvo.");
      setForm(null);
      void recarregar();
    },
    onError: () => toast.error("Não foi possível salvar o servidor."),
  });

  function validar(f: Formulario): string | null {
    if (f.nome.trim().length < 2) return "Informe o nome do servidor.";
    if (!/^https:\/\//i.test(f.baseUrl.trim())) return "O endereço deve começar com https://.";
    if (!segredoRefValido(f.segredoRef)) {
      return "Use um nome de variável como EVOLUTION_API_KEY ou EVOLUTION_API_KEY_2.";
    }
    return null;
  }

  async function aoTestar(s: ServidorPublico) {
    setOcupado(s.id);
    try {
      const r = await testar({ data: { id: s.id } });
      if (r.ok) {
        toast.success(
          `Servidor OK${r.versao ? ` (v${r.versao})` : ""}${r.instancias !== null ? ` — ${r.instancias} instância(s)` : ""}.`,
        );
      } else {
        toast.error(r.erro ?? "Falha ao testar o servidor.");
      }
      void recarregar();
    } finally {
      setOcupado(null);
    }
  }

  async function aoExcluir(s: ServidorPublico) {
    if (!confirm(`Excluir o servidor "${s.nome}"?`)) return;
    setOcupado(s.id);
    try {
      const r = await excluir({ data: { id: s.id } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível excluir.");
      else {
        toast.success("Servidor excluído.");
        void recarregar();
      }
    } finally {
      setOcupado(null);
    }
  }

  function aoSalvar() {
    if (!form) return;
    const erro = validar(form);
    if (erro) {
      toast.error(erro);
      return;
    }
    gravar.mutate(form);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Servidores Evolution API</DialogTitle>
          <DialogDescription>
            A chave do servidor fica na variável de ambiente do backend; aqui se informa só o nome
            da variável.
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sv-nome">Nome</Label>
              <Input id="sv-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-url">Endereço (https)</Label>
              <Input
                id="sv-url"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://evolution.exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-ref">Variável de ambiente da chave</Label>
              <Input
                id="sv-ref"
                value={form.segredoRef}
                onChange={(e) => setForm({ ...form, segredoRef: e.target.value.toUpperCase() })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              Servidor ativo
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>
                Voltar
              </Button>
              <Button disabled={gravar.isPending} onClick={aoSalvar}>
                {gravar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Novo servidor
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : servidores.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum servidor cadastrado.
              </p>
            ) : (
              <ul className="space-y-2">
                {(servidores as ServidorPublico[]).map((s) => (
                  <li key={s.id} className="space-y-2 rounded border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{s.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.base_url}</p>
                        <p className="text-xs text-muted-foreground">
                          Chave: {s.segredo_ref ?? "—"}{" "}
                          {s.chave_configurada ? "(configurada)" : "(NÃO encontrada no ambiente)"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {!s.ativo && <Badge variant="secondary">Inativo</Badge>}
                        {s.ultimo_teste_ok === true && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Teste OK</Badge>
                        )}
                        {s.ultimo_teste_ok === false && <Badge variant="destructive">Teste falhou</Badge>}
                        {!s.chave_configurada && <Badge variant="outline">Sem chave</Badge>}
                      </div>
                    </div>
                    {s.ultimo_erro && <p className="text-xs text-destructive">{s.ultimo_erro}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={ocupado === s.id} onClick={() => void aoTestar(s)}>
                        <Wifi className="mr-1.5 h-3.5 w-3.5" />
                        Testar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            id: s.id,
                            nome: s.nome,
                            baseUrl: s.base_url,
                            segredoRef: s.segredo_ref ?? "EVOLUTION_API_KEY",
                            ativo: s.ativo,
                          })
                        }
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={ocupado === s.id}
                        onClick={() => void aoExcluir(s)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
