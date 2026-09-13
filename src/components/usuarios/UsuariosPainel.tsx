import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarUsuario } from "@/lib/usuarios.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHAVE_PERMISSOES } from "@/hooks/usePermissoes";

const SEM_PERFIL = "sem-perfil";

interface UsuarioLinha {
  id: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
  perfil_id: string | null;
}

export function UsuariosPainel() {
  const qc = useQueryClient();

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, ativo, perfil_id")
        .order("nome", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as UsuarioLinha[];
    },
  });

  const { data: perfis } = useQuery({
    queryKey: ["perfis-acesso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_acesso")
        .select("id, nome, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<UsuarioLinha> }) => {
      const { error } = await supabase.from("profiles").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado");
      qc.invalidateQueries({ queryKey: ["usuarios-lista"] });
      qc.invalidateQueries({ queryKey: [CHAVE_PERMISSOES] });
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
      {(usuarios ?? []).map((u) => (
        <Card key={u.id}>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{u.nome || "Sem nome"}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={u.perfil_id ?? SEM_PERFIL}
                onValueChange={(valor) =>
                  salvar.mutate({
                    id: u.id,
                    campos: { perfil_id: valor === SEM_PERFIL ? null : valor },
                  })
                }
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PERFIL}>Sem perfil</SelectItem>
                  {(perfis ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.ativo ? "" : " (inativo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant={u.ativo ? "default" : "secondary"}>
                {u.ativo ? "ATIVO" : "INATIVO"}
              </Badge>

              <Switch
                checked={u.ativo}
                onCheckedChange={(valor) => salvar.mutate({ id: u.id, campos: { ativo: valor } })}
                aria-label="Ativar ou desativar usuário"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {(usuarios ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
      )}
    </div>
  );
}
