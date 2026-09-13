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
      <div className="flex justify-end">
        <DialogNovoUsuario perfis={perfis ?? []} />
      </div>
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

interface PerfilOpcao {
  id: string;
  nome: string;
  ativo: boolean;
}

function DialogNovoUsuario({ perfis }: { perfis: PerfilOpcao[] }) {
  const qc = useQueryClient();
  const criar = useServerFn(criarUsuario);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfilId, setPerfilId] = useState(SEM_PERFIL);

  const salvar = useMutation({
    mutationFn: async () =>
      criar({
        data: {
          nome,
          email,
          senha,
          perfilId: perfilId === SEM_PERFIL ? null : perfilId,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r?.existente
          ? "Este e-mail já existia; o acesso foi atualizado com a nova senha e perfil."
          : "Usuário criado. Ele já pode entrar com o e-mail e a senha.",
      );

      setAberto(false);
      setNome("");
      setEmail("");
      setSenha("");
      setPerfilId(SEM_PERFIL);
      qc.invalidateQueries({ queryKey: ["usuarios-lista"] });
      qc.invalidateQueries({ queryKey: [CHAVE_PERMISSOES] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            O acesso é liberado na hora, sem confirmação por e-mail.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="novo-nome">Nome</Label>
            <Input id="novo-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-email">E-mail</Label>
            <Input
              id="novo-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Senha inicial</Label>
            <Input
              id="nova-senha"
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Perfil de acesso</Label>
            <Select value={perfilId} onValueChange={setPerfilId}>
              <SelectTrigger>
                <SelectValue placeholder="Perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_PERFIL}>Sem perfil</SelectItem>
                {perfis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.ativo ? "" : " (inativo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Criando..." : "Criar usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
