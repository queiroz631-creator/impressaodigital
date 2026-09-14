import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Pencil, Plus, RefreshCw, Settings, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  atualizarConexao,
  excluirConexao,
  listarConexoes,
  reconfigurarWebhookConexao,
  testarConexao,
  type ConexaoPublica,
} from "@/lib/conexoes.functions";
import DialogConexao from "./DialogConexao";
import DialogConfiguracaoWhatsapp from "./DialogConfiguracaoWhatsapp";

export const CHAVE_CONEXOES = "conexoes-whatsapp";

export default function ConexoesPainel() {
  const qc = useQueryClient();
  const listar = useServerFn(listarConexoes);
  const salvar = useServerFn(atualizarConexao);
  const excluir = useServerFn(excluirConexao);
  const testar = useServerFn(testarConexao);
  const reconfigurar = useServerFn(reconfigurarWebhookConexao);

  const [editando, setEditando] = useState<ConexaoPublica | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [configuracaoAberta, setConfiguracaoAberta] = useState(false);
  const [status, setStatus] = useState<Record<string, boolean | null>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { session } = useAuth();

  const { data: conexoes = [], isLoading } = useQuery({
    queryKey: [CHAVE_CONEXOES],
    queryFn: () => listar(),
    // Aguarda o token da sessão para não chamar o servidor sem autorização.
    enabled: Boolean(session?.access_token),
    retry: 1,
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: [CHAVE_CONEXOES] });

  const alternar = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => salvar({ data: v }),
    onSuccess: (r) => {
      if (r?.erro) toast.error(r.erro);
      else toast.success("Situação atualizada.");
      recarregar();
    },
  });

  async function aoTestar(c: ConexaoPublica) {
    setOcupado(c.id);
    try {
      const r = await testar({ data: { id: c.id } });
      setStatus((s) => ({ ...s, [c.id]: r.conectado }));
      if (r.conectado) toast.success(r.detalhe);
      else toast.error(r.detalhe);
    } finally {
      setOcupado(null);
    }
  }

  async function aoReconfigurar(c: ConexaoPublica) {
    setOcupado(c.id);
    try {
      const r = await reconfigurar({ data: { id: c.id } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível reconfigurar.");
      else if (r.erro) toast.warning(r.erro);
      else toast.success("Webhook reconfigurado na Z-API.");
    } finally {
      setOcupado(null);
    }
  }

  async function aoExcluir(c: ConexaoPublica) {
    if (!confirm(`Excluir a conexão "${c.nome}"?`)) return;
    setOcupado(c.id);
    try {
      const r = await excluir({ data: { id: c.id } });
      if (r.erro) toast.error(r.erro);
      else {
        toast.success("Conexão excluída.");
        recarregar();
      }
    } finally {
      setOcupado(null);
    }
  }

  function copiar(url: string) {
    void navigator.clipboard.writeText(url);
    toast.success("Endereço copiado.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cada conexão tem número, credenciais e bot próprios.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setConfiguracaoAberta(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configuração
          </Button>
          <Button onClick={() => setNovoAberto(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova conexão
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : conexoes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma conexão cadastrada.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {conexoes.map((c) => {
            const conectado = status[c.id];
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: c.cor }} />
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.telefone || "número não informado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!c.ativo ? (
                        <Badge variant="secondary">Inativa</Badge>
                      ) : conectado === true ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Conectado</Badge>
                      ) : conectado === false ? (
                        <Badge variant="destructive">Desconectado</Badge>
                      ) : (
                        <Badge variant="outline">Ativa</Badge>
                      )}
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={(v) => alternar.mutate({ id: c.id, ativo: v })}
                      />
                    </div>
                  </div>

                  {!c.tem_credenciais && (
                    <p className="text-xs text-amber-600">
                      Credenciais ainda não guardadas nesta conexão.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado === c.id}
                      onClick={() => void aoTestar(c)}
                    >
                      <Wifi className="mr-1.5 h-3.5 w-3.5" />
                      Testar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado === c.id}
                      onClick={() => void aoReconfigurar(c)}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Reconfigurar webhook
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copiar(c.webhook_url)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copiar webhook
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditando(c)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={ocupado === c.id}
                      onClick={() => void aoExcluir(c)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DialogConexao
        aberto={novoAberto}
        conexao={null}
        onFechar={() => setNovoAberto(false)}
        onSalvo={recarregar}
      />
      <DialogConexao
        aberto={Boolean(editando)}
        conexao={editando}
        onFechar={() => setEditando(null)}
        onSalvo={recarregar}
      />
      <DialogConfiguracaoWhatsapp
        aberto={configuracaoAberta}
        onFechar={() => setConfiguracaoAberta(false)}
      />
    </div>
  );
}
