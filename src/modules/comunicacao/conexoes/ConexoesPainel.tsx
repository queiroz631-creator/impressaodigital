import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  Trash2,
  Unplug,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  atualizarConexao,
  excluirConexao,
  listarConexoes,
  reconfigurarWebhookConexao,
  testarConexao,
  type ConexaoPublica,
} from "@/lib/conexoes.functions";
import {
  consultarStatusConexaoProvedor,
  desconectarConexaoProvedor,
  reconfigurarWebhookProvedor,
} from "@/lib/whatsapp-provedores.functions";
import DialogConexao from "./DialogConexao";
import DialogConexaoEvolution from "./DialogConexaoEvolution";
import DialogConfiguracaoWhatsapp from "./DialogConfiguracaoWhatsapp";
import DialogEventosConexao from "./DialogEventosConexao";
import DialogQrCode from "./DialogQrCode";
import DialogServidores from "./DialogServidores";
import { normalizarEstado, rotuloEstado, rotuloProvedor, usaQrCode } from "./rotulos";

export const CHAVE_CONEXOES = "conexoes-whatsapp";

export default function ConexoesPainel() {
  const qc = useQueryClient();
  const listar = useServerFn(listarConexoes);
  const salvar = useServerFn(atualizarConexao);
  const excluir = useServerFn(excluirConexao);
  const testar = useServerFn(testarConexao);
  const reconfigurar = useServerFn(reconfigurarWebhookConexao);

  const consultarStatus = useServerFn(consultarStatusConexaoProvedor);
  const desconectar = useServerFn(desconectarConexaoProvedor);
  const reconfigurarProvedor = useServerFn(reconfigurarWebhookProvedor);

  const [evolutionAberto, setEvolutionAberto] = useState(false);
  const [servidoresAberto, setServidoresAberto] = useState(false);
  const [qr, setQr] = useState<{ id: string; nome: string } | null>(null);
  const [eventos, setEventos] = useState<{ id: string; nome: string } | null>(null);
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
      if (usaQrCode(c.provedor)) {
        const r = await reconfigurarProvedor({ data: { id: c.id } });
        if (!r.ok) toast.error(r.erro ?? "Não foi possível reconfigurar.");
        else toast.success("Webhook reconfigurado na Evolution.");
        return;
      }
      const r = await reconfigurar({ data: { id: c.id } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível reconfigurar.");
      else if (r.erro) toast.warning(r.erro);
      else toast.success("Webhook reconfigurado na Z-API.");
    } finally {
      setOcupado(null);
    }
  }

  async function aoConsultarStatus(c: ConexaoPublica) {
    setOcupado(c.id);
    try {
      const r = await consultarStatus({ data: { id: c.id } });
      if (r.ok && r.conectado) toast.success(r.detalhe);
      else toast.error(r.detalhe || r.erro || "Não foi possível consultar o status.");
      void recarregar();
    } finally {
      setOcupado(null);
    }
  }

  async function aoDesconectar(c: ConexaoPublica) {
    if (!confirm(`Desconectar o número da conexão "${c.nome}"? Será preciso ler o QR Code de novo.`)) {
      return;
    }
    setOcupado(c.id);
    try {
      const r = await desconectar({ data: { id: c.id } });
      if (!r.ok) toast.error(r.erro ?? "Não foi possível desconectar.");
      else toast.success("Conexão desconectada.");
      void recarregar();
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
          <Button variant="outline" onClick={() => setServidoresAberto(true)}>
            <Server className="mr-2 h-4 w-4" />
            Servidores
          </Button>
          <Button variant="outline" onClick={() => setEvolutionAberto(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Evolution
          </Button>
          <Button onClick={() => setNovoAberto(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Z-API
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
            const evolution = usaQrCode(c.provedor);
            const estado = normalizarEstado(c.status);
            const conectado = status[c.id] ?? (estado === "conectado" ? true : null);
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
                      <p className="text-xs text-muted-foreground">
                        {rotuloProvedor(c.provedor)}
                        {evolution && c.id_externo ? ` · instância ${c.id_externo}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!c.ativo ? (
                        <Badge variant="secondary">Inativa</Badge>
                      ) : conectado === true ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Conectado</Badge>
                      ) : conectado === false || estado === "desconectado" || estado === "erro" ? (
                        <Badge variant="destructive">
                          {estado === "erro" ? rotuloEstado("erro") : "Desconectado"}
                        </Badge>
                      ) : estado === "conectando" ? (
                        <Badge variant="outline">{rotuloEstado("conectando")}</Badge>
                      ) : (
                        <Badge variant="outline">Ativa</Badge>
                      )}
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={(v) => alternar.mutate({ id: c.id, ativo: v })}
                      />
                    </div>
                  </div>

                  {!evolution && !c.tem_credenciais && (
                    <p className="text-xs text-amber-600">
                      Credenciais ainda não guardadas nesta conexão.
                    </p>
                  )}
                  {c.ultimo_erro && (estado === "erro" || estado === "desconectado") && (
                    <p className="text-xs text-destructive">{c.ultimo_erro}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {evolution ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQr({ id: c.id, nome: c.nome })}
                        >
                          <QrCode className="mr-1.5 h-3.5 w-3.5" />
                          QR Code
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ocupado === c.id}
                          onClick={() => void aoConsultarStatus(c)}
                        >
                          <Wifi className="mr-1.5 h-3.5 w-3.5" />
                          Status
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ocupado === c.id}
                          onClick={() => void aoDesconectar(c)}
                        >
                          <Unplug className="mr-1.5 h-3.5 w-3.5" />
                          Desconectar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEventos({ id: c.id, nome: c.nome })}
                        >
                          <ScrollText className="mr-1.5 h-3.5 w-3.5" />
                          Eventos
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado === c.id}
                        onClick={() => void aoTestar(c)}
                      >
                        <Wifi className="mr-1.5 h-3.5 w-3.5" />
                        Testar
                      </Button>
                    )}
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
      <DialogServidores aberto={servidoresAberto} onFechar={() => setServidoresAberto(false)} />
      <DialogConexaoEvolution
        aberto={evolutionAberto}
        onFechar={() => setEvolutionAberto(false)}
        onCriada={(id, nome) => {
          void recarregar();
          setQr({ id, nome });
        }}
      />
      <DialogQrCode
        conexaoId={qr?.id ?? null}
        nome={qr?.nome ?? ""}
        onFechar={() => setQr(null)}
        onConectado={() => void recarregar()}
      />
      <DialogEventosConexao
        conexaoId={eventos?.id ?? null}
        nome={eventos?.nome ?? ""}
        onFechar={() => setEventos(null)}
      />
    </div>
  );
}
