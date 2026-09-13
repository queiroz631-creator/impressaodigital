import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MODULOS, PERMISSOES_SENSIVEIS } from "@/lib/modulos";
import { CHAVE_PERMISSOES } from "@/hooks/usePermissoes";

interface Perfil {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  permissoes: string[];
}

export function PerfisPainel() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Perfil | null>(null);

  const { data: perfis, isLoading } = useQuery({
    queryKey: ["perfis-acesso-completo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_acesso")
        .select("id, nome, descricao, ativo, permissoes")
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        permissoes: Array.isArray(p.permissoes) ? (p.permissoes as string[]) : [],
      })) as Perfil[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["perfis-acesso-completo"] });
    qc.invalidateQueries({ queryKey: ["perfis-acesso"] });
    qc.invalidateQueries({ queryKey: [CHAVE_PERMISSOES] });
  };

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("perfis_acesso").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setEditando({ id: "", nome: "", descricao: "", ativo: true, permissoes: [] })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo perfil
        </Button>
      </div>

      {(perfis ?? []).map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.nome}</p>
              <p className="truncate text-sm text-muted-foreground">
                {p.descricao || `${p.permissoes.length} permissões`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={p.ativo ? "default" : "secondary"}>
                {p.ativo ? "ATIVO" : "INATIVO"}
              </Badge>
              <Switch
                checked={p.ativo}
                onCheckedChange={(ativo) => alternarAtivo.mutate({ id: p.id, ativo })}
                aria-label="Ativar ou desativar perfil"
              />
              <Button variant="outline" size="sm" onClick={() => setEditando(p)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {editando && (
        <DialogPerfil
          perfil={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            invalidar();
          }}
        />
      )}
    </div>
  );
}

function DialogPerfil({
  perfil,
  onFechar,
  onSalvo,
}: {
  perfil: Perfil;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [descricao, setDescricao] = useState(perfil.descricao ?? "");
  const [chaves, setChaves] = useState<string[]>(perfil.permissoes);

  const alternar = (chave: string) =>
    setChaves((atual) =>
      atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave],
    );

  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome do perfil");
      const campos = { nome: nome.trim(), descricao: descricao.trim() || null, permissoes: chaves };
      const { error } = perfil.id
        ? await supabase.from("perfis_acesso").update(campos).eq("id", perfil.id)
        : await supabase.from("perfis_acesso").insert({ ...campos, ativo: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil salvo");
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{perfil.id ? "Editar perfil" : "Novo perfil"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>

        <div className="space-y-5">
          {MODULOS.map((modulo) => (
            <div key={modulo.id} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {modulo.nome}
              </p>
              <CaixaPermissao
                chave={modulo.permissao}
                nome={`Módulo ${modulo.nome}`}
                marcada={chaves.includes(modulo.permissao)}
                alternar={alternar}
              />
              {modulo.itens.map((item) => (
                <CaixaPermissao
                  key={item.id}
                  chave={item.permissao}
                  nome={item.nome}
                  marcada={chaves.includes(item.permissao)}
                  alternar={alternar}
                />
              ))}
            </div>
          ))}

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Permissões sensíveis
            </p>
            {PERMISSOES_SENSIVEIS.map((p) => (
              <CaixaPermissao
                key={p.chave}
                chave={p.chave}
                nome={p.nome}
                marcada={chaves.includes(p.chave)}
                alternar={alternar}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaixaPermissao({
  chave,
  nome,
  marcada,
  alternar,
}: {
  chave: string;
  nome: string;
  marcada: boolean;
  alternar: (chave: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md px-1 py-1 text-sm">
      <Checkbox checked={marcada} onCheckedChange={() => alternar(chave)} />
      <span className="flex-1">{nome}</span>
      <span className="text-xs text-muted-foreground">{chave}</span>
    </label>
  );
}
