import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, ShieldAlert, MessageSquare, Wrench, Zap, ScrollText, Settings, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppLayout";
import {
  listarFerramentas,
  minhasPermissoesAgentes,
  salvarFerramenta,
  type FerramentaResumo,
} from "@/lib/agentes/agentes.functions";
import { ROTULOS_RISCO, rotulo } from "@/lib/agentes/utils/rotulos";

const ATALHOS = [
  { rota: "/agentes/chat", nome: "Chat Operacional", icone: MessageSquare },
  { rota: "/agentes/ferramentas", nome: "Ferramentas", icone: Wrench },
  { rota: "/agentes/execucoes", nome: "Execuções", icone: Zap },
  { rota: "/agentes/aprovacoes", nome: "Aprovações", icone: ShieldAlert },
  { rota: "/agentes/auditoria", nome: "Auditoria", icone: ScrollText },
  { rota: "/agentes/configuracoes", nome: "Configurações", icone: Settings },
] as const;

export default function FerramentasPainel() {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarFerramentas);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);
  const fnSalvar = useServerFn(salvarFerramenta);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const ferramentas = useQuery({ queryKey: ["agentes-ferramentas"], queryFn: () => fnListar() });
  const podeGerir = permissoes.data?.gerenciar ?? false;

  const [editando, setEditando] = useState<FerramentaResumo | null>(null);
  const [aberto, setAberto] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Ferramentas dos agentes"
        subtitulo="Catálogo de ferramentas que podem ser autorizadas a cada agente."
        semPaddingHorizontal
      />

      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((atalho) => (
          <Button key={atalho.rota} variant="outline" size="sm" asChild>
            <Link to={atalho.rota}>
              <atalho.icone className="mr-2 h-4 w-4" />
              {atalho.nome}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex justify-end">
        {podeGerir && (
          <Button
            size="sm"
            onClick={() => {
              setEditando(null);
              setAberto(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova ferramenta
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(ferramentas.data ?? []).length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">Nenhuma ferramenta cadastrada.</p>
        )}
        {(ferramentas.data ?? []).map((f) => (
          <Card key={f.id}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.nome}</span>
                <code className="rounded bg-muted px-1 text-xs">{f.chave}</code>
                <Badge variant={f.tipo === "acao" ? "default" : "secondary"}>{f.tipo}</Badge>
                <Badge variant="outline">Risco {rotulo(ROTULOS_RISCO, f.risco)}</Badge>
                {f.sensivel && (
                  <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> Sensível
                  </Badge>
                )}
                {!f.ativo && <Badge variant="secondary">Inativa</Badge>}
              </div>
              {f.descricao && <p className="text-sm text-muted-foreground">{f.descricao}</p>}
              <p className="text-xs text-muted-foreground">
                {f.efeito_externo ? "Efeito externo" : "Somente interno"} ·{" "}
                {f.idempotente ? "Idempotente" : "Não idempotente"} · {f.categoria}
              </p>
              {podeGerir && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditando(f);
                    setAberto(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DialogFerramenta
        aberto={aberto}
        ferramenta={editando}
        aoFechar={() => setAberto(false)}
        aoSalvar={async () => {
          await qc.invalidateQueries({ queryKey: ["agentes-ferramentas"] });
        }}
      />
    </div>
  );
}

function DialogFerramenta({
  aberto,
  ferramenta,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  ferramenta: FerramentaResumo | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const salvar = useServerFn(salvarFerramenta);
  const [chave, setChave] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [tipo, setTipo] = useState("consulta");
  const [risco, setRisco] = useState("baixo");
  const [sensivel, setSensivel] = useState(false);
  const [efeitoExterno, setEfeitoExterno] = useState(false);
  const [idempotente, setIdempotente] = useState(true);
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setChave(ferramenta?.chave ?? "");
    setNome(ferramenta?.nome ?? "");
    setDescricao(ferramenta?.descricao ?? "");
    setCategoria(ferramenta?.categoria ?? "geral");
    setTipo(ferramenta?.tipo ?? "consulta");
    setRisco(ferramenta?.risco ?? "baixo");
    setSensivel(ferramenta?.sensivel ?? false);
    setEfeitoExterno(ferramenta?.efeito_externo ?? false);
    setIdempotente(ferramenta?.idempotente ?? true);
    setAtivo(ferramenta?.ativo ?? true);
  }, [aberto, ferramenta]);

  async function enviar() {
    if (!chave.trim() || !nome.trim()) {
      toast.error("Informe o nome e a chave.");
      return;
    }
    setSalvando(true);
    try {
      const resp = await salvar({
        data: {
          id: ferramenta?.id,
          chave: chave.trim(),
          nome: nome.trim(),
          descricao: descricao.trim(),
          categoria: categoria.trim() || "geral",
          tipo: tipo as "consulta" | "acao",
          risco: risco as "baixo" | "medio" | "alto",
          sensivel,
          efeito_externo: efeitoExterno,
          idempotente,
          ativo,
        },
      });
      if (!resp.ok) {
        toast.error(resp.erro ?? "Não foi possível salvar.");
        return;
      }
      toast.success("Ferramenta salva.");
      await aoSalvar();
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{ferramenta ? "Editar ferramenta" : "Nova ferramenta"}</DialogTitle>
          <DialogDescription>
            A configuração define risco e efeito externo. Credenciais nunca são guardadas aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="f-nome">Nome</Label>
            <Input id="f-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="f-chave">Chave</Label>
            <Input
              id="f-chave"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              maxLength={80}
              placeholder="ex.: lojamix.consultar_produto"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="f-desc">Descrição</Label>
            <Textarea id="f-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} maxLength={300} />
          </div>
          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={60} />
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consulta">Consulta</SelectItem>
                <SelectItem value="acao">Ação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Risco</Label>
            <Select value={risco} onValueChange={setRisco}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Sensível</Label>
            <Switch checked={sensivel} onCheckedChange={setSensivel} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Efeito externo</Label>
            <Switch checked={efeitoExterno} onCheckedChange={setEfeitoExterno} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Idempotente</Label>
            <Switch checked={idempotente} onCheckedChange={setIdempotente} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Ativa</Label>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={salvando}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
