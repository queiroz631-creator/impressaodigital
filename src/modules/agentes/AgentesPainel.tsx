import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ClipboardList,
  MessageSquare,
  Monitor,
  Pencil,
  Plus,
  ScrollText,
  ShieldAlert,
  Wrench,
  Zap,
  Settings,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/AppLayout";
import {
  definirAgenteAtivo,
  listarAgentes,
  metricasCentral,
  minhasPermissoesAgentes,
  type AgenteResumo,
} from "@/lib/agentes/agentes.functions";
import { ROTULOS_TIPO_AGENTE, rotulo } from "@/lib/agentes/utils/rotulos";
import DialogAgente from "./DialogAgente";
import DialogFerramentas from "./DialogFerramentas";
import DialogVersoes from "./DialogVersoes";
import { iconeAgente } from "./icones";

const ATALHOS = [
  { rota: "/agentes/chat", nome: "Chat Operacional", icone: MessageSquare },
  { rota: "/agentes/ferramentas", nome: "Ferramentas", icone: Wrench },
  { rota: "/agentes/execucoes", nome: "Execuções", icone: Zap },
  { rota: "/agentes/aprovacoes", nome: "Aprovações", icone: ShieldAlert },
  { rota: "/agentes/auditoria", nome: "Auditoria", icone: ScrollText },
  { rota: "/agentes/configuracoes", nome: "Configurações", icone: Settings },
] as const;

export default function AgentesPainel() {
  const qc = useQueryClient();
  const fnAgentes = useServerFn(listarAgentes);
  const fnMetricas = useServerFn(metricasCentral);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);
  const fnAtivo = useServerFn(definirAgenteAtivo);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const agentes = useQuery({ queryKey: ["agentes-lista"], queryFn: () => fnAgentes() });
  const metricas = useQuery({ queryKey: ["agentes-metricas"], queryFn: () => fnMetricas() });

  const [dialogo, setDialogo] = useState(false);
  const [selecionado, setSelecionado] = useState<AgenteResumo | null>(null);
  const [ferramentasDe, setFerramentasDe] = useState<AgenteResumo | null>(null);
  const [versoesDe, setVersoesDe] = useState<AgenteResumo | null>(null);

  const podeGerir = permissoes.data?.gerenciar ?? false;
  const m = metricas.data;

  async function alternarAtivo(agente: AgenteResumo, ativo: boolean) {
    const resp = await fnAtivo({ data: { id: agente.id, ativo } });
    if (!resp.ok) {
      toast.error(resp.erro ?? "Não foi possível alterar a situação.");
      return;
    }
    toast.success(ativo ? "Agente ativado." : "Agente desativado.");
    await qc.invalidateQueries({ queryKey: ["agentes-lista"] });
    await qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
  }

  function aoSalvar() {
    void qc.invalidateQueries({ queryKey: ["agentes-lista"] });
    void qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Central de Agentes"
        subtitulo="Agentes de IA, ferramentas autorizadas e acompanhamento das execuções."
        semPaddingHorizontal
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoMetrica titulo="Agentes ativos" valor={`${m?.agentes_ativos ?? 0} / ${m?.agentes_total ?? 0}`} />
        <CartaoMetrica titulo="Execuções (24h)" valor={m?.execucoes_24h ?? 0} icone={<Activity className="h-4 w-4" />} />
        <CartaoMetrica
          titulo="Aguardando aprovação"
          valor={m?.aguardando_aprovacao ?? 0}
          icone={<ShieldAlert className="h-4 w-4" />}
        />
        <CartaoMetrica titulo="Aprovações pendentes" valor={m?.aprovacoes_pendentes ?? 0} />
        <CartaoMetrica titulo="Falhas (24h)" valor={m?.falhas_24h ?? 0} />
        <CartaoMetrica
          titulo="Fila de tarefas"
          valor={m?.tarefas_aguardando ?? 0}
          icone={<ClipboardList className="h-4 w-4" />}
        />
        <CartaoMetrica
          titulo="Dispositivos ativos"
          valor={m?.dispositivos_ativos ?? 0}
          icone={<Monitor className="h-4 w-4" />}
        />
        <CartaoMetrica titulo="Workers online" valor={m?.workers_online ?? 0} />
      </div>

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Agentes</CardTitle>
          {podeGerir && (
            <Button
              size="sm"
              onClick={() => {
                setSelecionado(null);
                setDialogo(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo agente
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {(agentes.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum agente cadastrado.</p>
          )}
          {(agentes.data ?? []).map((agente) => {
            const Icone = iconeAgente(agente.icone);
            return (
              <div key={agente.id} className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-muted p-2">
                  <Icone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{agente.nome}</span>
                    <code className="rounded bg-muted px-1 text-xs">{agente.chave}</code>
                    <Badge variant="secondary">{rotulo(ROTULOS_TIPO_AGENTE, agente.tipo)}</Badge>
                    {agente.ativo ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </div>
                  {agente.descricao && (
                    <p className="mt-1 text-sm text-muted-foreground">{agente.descricao}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {agente.total_ferramentas} ferramenta(s) ·{" "}
                    {agente.tem_prompt ? "prompt definido" : "sem prompt"} ·{" "}
                    {agente.modelo ?? "modelo padrão"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!podeGerir}
                    onClick={() => {
                      setSelecionado(agente);
                      setDialogo(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setFerramentasDe(agente)}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Ferramentas
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setVersoesDe(agente)}>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Versões
                  </Button>
                  <Switch
                    checked={agente.ativo}
                    disabled={!podeGerir}
                    onCheckedChange={(v) => void alternarAtivo(agente, v)}
                    aria-label={agente.ativo ? "Desativar agente" : "Ativar agente"}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DialogAgente
        aberto={dialogo}
        agente={selecionado}
        aoFechar={() => {
          setDialogo(false);
          setSelecionado(null);
        }}
        aoSalvar={aoSalvar}
      />
      <DialogFerramentas
        aberto={!!ferramentasDe}
        agente={ferramentasDe}
        aoFechar={() => setFerramentasDe(null)}
      />
      <DialogVersoes
        aberto={!!versoesDe}
        agenteId={versoesDe?.id ?? null}
        agenteNome={versoesDe?.nome ?? ""}
        aoFechar={() => setVersoesDe(null)}
      />
    </div>
  );
}

function CartaoMetrica({
  titulo,
  valor,
  icone,
}: {
  titulo: string;
  valor: string | number;
  icone?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
        {icone}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{valor}</div>
      </CardContent>
    </Card>
  );
}
