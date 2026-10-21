import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppLayout";
import {
  obterConfiguracaoCentral,
  obterStatusProvedoresIA,
  testarConexaoIA,
  listarDispositivos,
  registrarDispositivo,
  revogarDispositivo,
  minhasPermissoesAgentes,
  listarAgentes,
  type ProvedorIAStatus,
} from "@/lib/agentes/agentes.functions";
import {
  listarConexoesAgente,
  obterConfigAgenteConexao,
  salvarConfigAgenteConexao,
  toggleAgenteAtendimento,
  listarAgentesAtendimento,
  listarFerramentasDoAgente,
  type WhatsappAgenteConfig,
} from "@/lib/whatsapp-agente.functions";

/**
 * Convenção de dias da semana igual à do worker (`Date.getDay()`):
 * 0 = Domingo, 1 = Segunda, ..., 6 = Sábado.
 */
const DIAS_SEMANA: Array<{ valor: number; label: string }> = [
  { valor: 0, label: "Dom" },
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
];

export default function ConfiguracoesPainel() {
  const qc = useQueryClient();
  const fnConfig = useServerFn(obterConfiguracaoCentral);
  const fnProvedores = useServerFn(obterStatusProvedoresIA);
  const fnTestarIA = useServerFn(testarConexaoIA);
  const fnPermissoes = useServerFn(minhasPermissoesAgentes);
  const fnDispositivos = useServerFn(listarDispositivos);
  const fnRegistrarDispositivo = useServerFn(registrarDispositivo);
  const fnAgentes = useServerFn(listarAgentes);

  const permissoes = useQuery({ queryKey: ["agentes-permissoes"], queryFn: () => fnPermissoes() });
  const config = useQuery({ queryKey: ["agentes-config-central"], queryFn: () => fnConfig() });
  const provedores = useQuery({ queryKey: ["agentes-provedores-ia"], queryFn: () => fnProvedores() });
  const dispositivos = useQuery({ queryKey: ["agentes-dispositivos"], queryFn: () => fnDispositivos() });
  const agentes = useQuery({ queryKey: ["agentes-lista"], queryFn: () => fnAgentes() });

  const podeDispositivos = permissoes.data?.dispositivos ?? false;

  const [testandoIA, setTestandoIA] = useState(false);
  const [registrandoDispositivo, setRegistrandoDispositivo] = useState(false);
  const [novoDispositivo, setNovoDispositivo] = useState({ agenteId: "", nome: "" });
  const [tokenGerado, setTokenGerado] = useState<string | null>(null);
  const [mostrarToken, setMostrarToken] = useState(false);

  async function handleTestarIA() {
    setTestandoIA(true);
    try {
      const resp = await fnTestarIA();
      if (resp.ok) {
        toast.success(`Conexão OK: ${resp.provedor} / ${resp.modelo} → "${resp.resposta}"`);
      } else {
        toast.error(`Falha: ${resp.mensagem}`);
      }
    } catch {
      toast.error("Não foi possível testar a conexão de IA.");
    } finally {
      setTestandoIA(false);
    }
  }

  async function handleRegistrarDispositivo() {
    setRegistrandoDispositivo(true);
    try {
      const resp = await fnRegistrarDispositivo({
        data: { agenteId: novoDispositivo.agenteId, nome: novoDispositivo.nome.trim() },
      });
      if (!resp.ok || !resp.token) {
        toast.error(resp.erro ?? "Não foi possível registrar.");
        return;
      }
      setTokenGerado(resp.token);
      setMostrarToken(true);
      setNovoDispositivo({ agenteId: "", nome: "" });
      await qc.invalidateQueries({ queryKey: ["agentes-dispositivos"] });
      await qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
    } catch {
      toast.error("Não foi possível registrar o dispositivo.");
    } finally {
      setRegistrandoDispositivo(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configurações da Central"
        subtitulo="Parâmetros globais, provedores de IA, agente WhatsApp e dispositivos autorizados."
      />

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="ia">Provedores de IA</TabsTrigger>
          <TabsTrigger value="whatsapp">Agente WhatsApp</TabsTrigger>
          <TabsTrigger value="dispositivos">Dispositivos Windows</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros da Central</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : config.data ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ConfigField
                    label="Limite de profundidade entre agentes"
                    value={config.data.limite_profundidade_agentes}
                    description="Máximo de níveis de delegação entre agentes (evita ciclos)."
                  />
                  <ConfigField
                    label="Timeout de execução (segundos)"
                    value={config.data.timeout_execucao_segundos}
                    description="Tempo máximo antes de cancelar uma execução travada."
                  />
                  <ConfigField
                    label="Máx. tentativas padrão"
                    value={config.data.max_tentativas_padrao}
                    description="Repetições automáticas em falhas temporárias."
                  />
                  <ConfigField
                    label="Lease da tarefa (segundos)"
                    value={config.data.lease_tarefa_segundos}
                    description="Tempo que um worker reserva a tarefa antes de expirar."
                  />
                  <ConfigField
                    label="Expiração de aprovação (horas)"
                    value={config.data.aprovacao_expira_horas}
                    description="Após este tempo, aprovações pendentes expiram automaticamente."
                  />
                  <ConfigField
                    label="Retenção de idempotência (dias)"
                    value={config.data.idempotencia_expira_dias}
                    description="Tempo antes de limpar chaves de idempotência concluídas."
                  />
                  <ConfigField
                    label="Retenção de auditoria (dias)"
                    value={config.data.auditoria_retencao_dias}
                    description="Período de guarda dos registros de auditoria."
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não foi possível carregar a configuração.</p>
              )}
              {!config.isLoading && config.data && (
                <Button variant="outline" size="sm" onClick={() => void config.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ia">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Provedor Atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {provedores.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : provedores.data ? (
                  <>
                    {provedores.data
                      .filter(
                        (p) =>
                          p.status !== "sem_chave" ||
                          p.provedor === provedores.data.find((x) => x.status === "configurado")?.provedor,
                      )
                      .map((p) => (
                        <ProvedorCard key={p.provedor} provedor={p} />
                      ))}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => void handleTestarIA()} disabled={testandoIA}>
                        {testandoIA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Testar conexão atual
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void provedores.refetch()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Atualizar status
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Não foi possível carregar provedores.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Todos os Provedores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {provedores.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : provedores.data ? (
                  provedores.data.map((p) => <ProvedorStatusRow key={p.provedor} provedor={p} />)
                ) : (
                  <p className="text-sm text-muted-foreground">Não foi possível carregar.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Nota sobre configuração de IA</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                A Central de Agentes <strong>não armazena credenciais de IA</strong>. Ela reutiliza
                exclusivamente a configuração da aba "IA" em Configurações do sistema
                (<code>configuracoes.ia_provedor</code>, <code>ia_modelo</code>, <code>ia_credenciais</code>).
              </p>
              <p>
                Os agentes podem ter um <code>modelo</code> e <code>temperatura</code> de override opcional,
                mas a resolução final de provedor e chave sempre passa por <code>resolverConfigIA()</code>.
              </p>
              <p>
                Para alterar provedor, modelo ou gravar chaves próprias (OpenAI/Gemini), use a tela{" "}
                <strong>Configurações → IA</strong> (requer perfil de administrador).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppAgenteConfigTab />
        </TabsContent>

        <TabsContent value="dispositivos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Dispositivos Windows Autorizados</CardTitle>
              {podeDispositivos && (
                <Button size="sm" onClick={() => setRegistrandoDispositivo(true)}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Registrar dispositivo
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {dispositivos.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (dispositivos.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum dispositivo registrado. O agente Windows faz long-poll HTTPS para a Central.
                </p>
              ) : (
                <div className="space-y-2">
                  {dispositivos.data?.map((d) => (
                    <DispositivoRow key={d.id} dispositivo={d} podeRevogar={podeDispositivos} />
                  ))}
                </div>
              )}
              {!dispositivos.isLoading && (
                <Button variant="outline" size="sm" onClick={() => void dispositivos.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              )}
            </CardContent>
          </Card>

          {tokenGerado && (
            <Card className="mt-4 border-amber-500 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-900">Token gerado (copie agora)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Input
                    value={tokenGerado}
                    readOnly
                    className="flex-1 min-w-[200px] font-mono text-sm"
                    type={mostrarToken ? "text" : "password"}
                  />
                  <Button variant="outline" size="sm" onClick={() => setMostrarToken(!mostrarToken)}>
                    {mostrarToken ? "Ocultar" : "Mostrar"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(tokenGerado);
                      toast.success("Token copiado!");
                      setTokenGerado(null);
                    }}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Copiar e fechar
                  </Button>
                </div>
                <p className="text-xs text-amber-800">
                  <strong>Importante:</strong> Este token só é exibido uma vez. Configure no arquivo de
                  configuração do agente Windows (<code>api-local</code>) e reinicie o serviço. Se perder,
                  revogue o dispositivo e crie outro.
                </p>
              </CardContent>
            </Card>
          )}

          <Dialog open={registrandoDispositivo} onOpenChange={(v) => !v && setRegistrandoDispositivo(false)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar novo dispositivo Windows</DialogTitle>
                <DialogDescription>
                  O dispositivo fará long-poll HTTPS para a Central. O token é exibido apenas uma vez.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Agente associado</Label>
                  <Select
                    value={novoDispositivo.agenteId}
                    onValueChange={(v) => setNovoDispositivo({ ...novoDispositivo, agenteId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o agente Operador de Computador" />
                    </SelectTrigger>
                    <SelectContent>
                      {(agentes.data ?? [])
                        .filter((a) => a.tipo === "operador_computador")
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {(agentes.data ?? []).filter((a) => a.tipo === "operador_computador").length === 0 && (
                    <p className="text-xs text-amber-700">
                      Nenhum agente do tipo "Operador de Computador" cadastrado. Crie-o na Central de Agentes.
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="disp-nome">Nome do dispositivo</Label>
                  <Input
                    id="disp-nome"
                    value={novoDispositivo.nome}
                    onChange={(e) => setNovoDispositivo({ ...novoDispositivo, nome: e.target.value })}
                    maxLength={80}
                    placeholder="Ex.: Loja Centro - Terminal 1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRegistrandoDispositivo(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleRegistrarDispositivo()}
                  disabled={registrandoDispositivo || !novoDispositivo.agenteId || novoDispositivo.nome.trim().length < 2}
                >
                  {registrandoDispositivo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar e gerar token
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Aba de configuração do Agente de Atendimento WhatsApp
// ============================================================

function WhatsAppAgenteConfigTab() {
  const qc = useQueryClient();
  const fnConexoes = useServerFn(listarConexoesAgente);
  const fnAgentes = useServerFn(listarAgentesAtendimento);
  const fnConfig = useServerFn(obterConfigAgenteConexao);
  const fnSalvar = useServerFn(salvarConfigAgenteConexao);
  const fnToggle = useServerFn(toggleAgenteAtendimento);
  const fnFerramentas = useServerFn(listarFerramentasDoAgente);

  const conexoes = useQuery({ queryKey: ["agentes-conexoes-agente"], queryFn: () => fnConexoes() });
  const agentes = useQuery({ queryKey: ["agentes-atendimento-listar"], queryFn: () => fnAgentes() });

  const [conexaoId, setConexaoId] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsappAgenteConfig | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    if (!conexaoId) {
      setConfig(null);
      setAlterado(false);
      return;
    }
    let ativo = true;
    setCarregando(true);
    fnConfig({ data: { conexao_id: conexaoId } })
      .then((r) => {
        if (!ativo) return;
        setConfig(r);
        setAlterado(false);
      })
      .catch(() => {
        if (ativo) setConfig(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [conexaoId, fnConfig]);

  const agenteId = config?.agente_atendimento_id ?? null;
  const ferramentas = useQuery({
    queryKey: ["agentes-ferramentas-agente", agenteId],
    queryFn: () => fnFerramentas({ data: { agente_id: agenteId as string } }),
    enabled: Boolean(agenteId),
  });

  function atualizar(patch: Partial<WhatsappAgenteConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
    setAlterado(true);
  }

  async function handleSalvar() {
    if (!config || !conexaoId) return;
    setSalvando(true);
    try {
      const r = await fnSalvar({ data: { ...config, conexao_id: conexaoId } });
      if (r.ok) {
        toast.success("Configuração salva com sucesso!");
        setAlterado(false);
        await qc.invalidateQueries({ queryKey: ["agentes-conexoes-agente"] });
      } else {
        toast.error(r.erro ?? "Erro ao salvar configuração");
      }
    } catch {
      toast.error("Erro ao salvar configuração");
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(ativo: boolean) {
    if (!config || !conexaoId) return;
    const anterior = config.agente_atendimento_ativo;
    setConfig((prev) => (prev ? { ...prev, agente_atendimento_ativo: ativo } : prev));
    try {
      const r = await fnToggle({ data: { conexao_id: conexaoId, ativo } });
      if (r.ok) {
        toast.success(ativo ? "Agente ativado" : "Agente desativado");
        await qc.invalidateQueries({ queryKey: ["agentes-conexoes-agente"] });
      } else {
        setConfig((prev) => (prev ? { ...prev, agente_atendimento_ativo: anterior } : prev));
        toast.error(r.erro ?? "Erro ao alterar status");
      }
    } catch {
      setConfig((prev) => (prev ? { ...prev, agente_atendimento_ativo: anterior } : prev));
      toast.error("Erro ao alterar status");
    }
  }

  if (conexoes.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conexão WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:max-w-md">
            <Label>Conexão</Label>
            <Select value={conexaoId ?? ""} onValueChange={(v) => setConexaoId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conexão WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                {(conexoes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.telefone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(conexoes.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma conexão WhatsApp cadastrada. Crie uma em{" "}
                <Link to="/conexoes" className="text-primary hover:underline">
                  Conexões
                </Link>
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {conexaoId && carregando && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {conexaoId && !carregando && !config && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Esta conexão ainda não possui um registro de configuração (<code>whatsapp_config</code>).
              Edite/salve a conexão em{" "}
              <Link to="/conexoes" className="text-primary hover:underline">
                Conexões
              </Link>{" "}
              para criá-lo e volte aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {conexaoId && !carregando && config && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Configuração do Agente de Atendimento</h3>
              <p className="text-sm text-muted-foreground">
                Conexão: {conexoes.data?.find((c) => c.id === conexaoId)?.nome}
                {alterado && <span className="ml-2 text-amber-600">• alterações não salvas</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="agente-ativo"
                checked={config.agente_atendimento_ativo}
                onCheckedChange={(v) => void handleToggleAtivo(v)}
                disabled={salvando}
              />
              <Label htmlFor="agente-ativo" className="cursor-pointer">
                Agente ativo
              </Label>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agente Responsável</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Agente de Atendimento</Label>
                  <Select
                    value={config.agente_atendimento_id ?? "__none__"}
                    onValueChange={(v) => atualizar({ agente_atendimento_id: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {(agentes.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome}
                          {a.modelo ? ` (${a.modelo})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Máx. Contexto (mensagens)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={config.agente_atendimento_max_contexto_mensagens}
                    onChange={(e) =>
                      atualizar({
                        agente_atendimento_max_contexto_mensagens: Math.min(
                          50,
                          Math.max(1, parseInt(e.target.value, 10) || 20),
                        ),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Quantidade de mensagens do histórico enviadas ao agente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="exigir-validacao"
                  checked={config.agente_atendimento_exigir_validacao}
                  onCheckedChange={(v) => atualizar({ agente_atendimento_exigir_validacao: v })}
                />
                <Label htmlFor="exigir-validacao" className="cursor-pointer">
                  Exigir validação de identidade antes de revelar dados particulares
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mensagem de Ativação</Label>
                <Textarea
                  value={config.agente_atendimento_msg_ativacao}
                  onChange={(e) => atualizar({ agente_atendimento_msg_ativacao: e.target.value })}
                  placeholder="Mensagem inicial ao iniciar o atendimento automático"
                  maxLength={500}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem Fora de Horário</Label>
                <Textarea
                  value={config.agente_atendimento_msg_fora_horario}
                  onChange={(e) => atualizar({ agente_atendimento_msg_fora_horario: e.target.value })}
                  placeholder="Mensagem quando fora do horário de atendimento"
                  maxLength={500}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem de Transferência</Label>
                <Textarea
                  value={config.agente_atendimento_msg_transferencia}
                  onChange={(e) => atualizar({ agente_atendimento_msg_transferencia: e.target.value })}
                  placeholder="Mensagem ao transferir para atendente humano"
                  maxLength={500}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Horário de Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={config.agente_atendimento_horario_inicio.slice(0, 5)}
                    onChange={(e) => atualizar({ agente_atendimento_horario_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={config.agente_atendimento_horario_fim.slice(0, 5)}
                    onChange={(e) => atualizar({ agente_atendimento_horario_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">Dias da semana</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia) => {
                    const ativoDia = config.agente_atendimento_dias_semana.includes(dia.valor);
                    return (
                      <button
                        key={dia.valor}
                        type="button"
                        onClick={() =>
                          atualizar({
                            agente_atendimento_dias_semana: ativoDia
                              ? config.agente_atendimento_dias_semana.filter((d) => d !== dia.valor)
                              : [...config.agente_atendimento_dias_semana, dia.valor].sort((a, b) => a - b),
                          })
                        }
                        className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                          ativoDia ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:bg-muted"
                        }`}
                        aria-pressed={ativoDia}
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Convenção: 0 = Domingo … 6 = Sábado (igual à verificação do worker).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ferramentas do Agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!agenteId ? (
                <p className="text-sm text-muted-foreground">
                  Selecione um agente de atendimento para ver as ferramentas vinculadas.
                </p>
              ) : ferramentas.isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : ferramentas.isError ? (
                <p className="text-sm text-muted-foreground">Não foi possível carregar as ferramentas.</p>
              ) : (ferramentas.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este agente não possui ferramentas vinculadas. Vincule ferramentas para que ele possa
                  responder com dados do sistema.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 max-h-[400px] overflow-y-auto pr-1">
                  {(ferramentas.data ?? []).map((f) => (
                    <div key={f.chave} className="space-y-1 rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{f.nome}</span>
                        <Badge variant="secondary">{f.tipo}</Badge>
                        {f.sensivel && <Badge variant="destructive">Sensível</Badge>}
                      </div>
                      <code className="block text-xs text-muted-foreground">{f.chave}</code>
                      {f.descricao && <p className="text-xs text-muted-foreground">{f.descricao}</p>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Somente leitura. Os vínculos de ferramentas são gerenciados no painel de{" "}
                <Link
                  to="/agentes/ferramentas"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ferramentas
                  <ExternalLink className="h-3 w-3" />
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setConexaoId(null);
              }}
            >
              Voltar
            </Button>
            <Button onClick={() => void handleSalvar()} disabled={salvando || !config}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar configuração
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function ConfigField({ label, value, description }: { label: string; value: string | number; description: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="text-2xl font-semibold text-primary">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function ProvedorCard({ provedor }: { provedor: ProvedorIAStatus }) {
  const statusLabels: Record<string, string> = {
    configurado: "Configurado",
    sem_chave: "Sem chave própria",
    usando_gateway: "Usando gateway Lovable",
  };
  const statusColors: Record<string, string> = {
    configurado: "bg-emerald-100 text-emerald-800",
    sem_chave: "bg-amber-100 text-amber-800",
    usando_gateway: "bg-sky-100 text-sky-800",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium capitalize">{provedor.provedor.replace("_", " ")}</span>
        <Badge className={statusColors[provedor.status]}>{statusLabels[provedor.status]}</Badge>
        {provedor.tem_chave_propria && (
          <Badge variant="secondary">
            <ShieldCheck className="mr-1 h-3 w-3" /> Chave própria
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Modelo texto: <code className="bg-muted px-1">{provedor.modelo_texto}</code>
      </p>
      <p className="text-sm text-muted-foreground">
        Modelo áudio: <code className="bg-muted px-1">{provedor.modelo_audio}</code>
      </p>
    </div>
  );
}

function ProvedorStatusRow({ provedor }: { provedor: ProvedorIAStatus }) {
  const statusLabels: Record<string, string> = {
    configurado: "Configurado",
    sem_chave: "Sem chave própria",
    usando_gateway: "Usando gateway",
  };
  const statusColors: Record<string, string> = {
    configurado: "bg-emerald-100 text-emerald-800",
    sem_chave: "bg-amber-100 text-amber-800",
    usando_gateway: "bg-sky-100 text-sky-800",
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="font-medium capitalize">{provedor.provedor.replace("_", " ")}</span>
      <Badge className={statusColors[provedor.status]}>{statusLabels[provedor.status]}</Badge>
      {provedor.tem_chave_propria && (
        <Badge variant="secondary">
          <ShieldCheck className="mr-1 h-3 w-3" /> Chave
        </Badge>
      )}
      <span className="text-muted-foreground">{provedor.modelo_texto}</span>
    </div>
  );
}

interface DispositivoResumo {
  id: string;
  agente_id: string;
  nome: string;
  ativo: boolean;
  versao: string | null;
  ultimo_ping: string | null;
  criado_em: string;
}

function DispositivoRow({ dispositivo, podeRevogar }: { dispositivo: DispositivoResumo; podeRevogar: boolean }) {
  const qc = useQueryClient();
  const fnRevogar = useServerFn(revogarDispositivo);
  const [revogando, setRevogando] = useState(false);
  const online =
    Boolean(dispositivo.ultimo_ping) && new Date(dispositivo.ultimo_ping as string).getTime() > Date.now() - 2 * 60 * 1000;

  async function handleRevogar() {
    if (!confirm(`Revogar dispositivo "${dispositivo.nome}"?`)) return;
    setRevogando(true);
    try {
      const resp = await fnRevogar({ data: { dispositivoId: dispositivo.id } });
      if (!resp.ok) {
        toast.error(resp.erro ?? "Não foi possível revogar.");
        return;
      }
      toast.success("Dispositivo revogado.");
      await qc.invalidateQueries({ queryKey: ["agentes-dispositivos"] });
      await qc.invalidateQueries({ queryKey: ["agentes-metricas"] });
    } catch {
      toast.error("Não foi possível revogar.");
    } finally {
      setRevogando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{dispositivo.nome}</span>
          <Badge variant={online ? "default" : "secondary"}>{online ? "Online" : "Offline"}</Badge>
          <Badge variant={dispositivo.ativo ? "outline" : "secondary"}>
            {dispositivo.ativo ? "Ativo" : "Revogado"}
          </Badge>
          {dispositivo.versao && <span className="text-xs text-muted-foreground">v{dispositivo.versao}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Último ping:{" "}
          {dispositivo.ultimo_ping ? new Date(dispositivo.ultimo_ping).toLocaleString("pt-BR") : "nunca"} · Criado em{" "}
          {new Date(dispositivo.criado_em).toLocaleString("pt-BR")}
        </p>
      </div>
      {podeRevogar && dispositivo.ativo && (
        <Button variant="destructive" size="sm" onClick={() => void handleRevogar()} disabled={revogando}>
          {revogando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Revogar
        </Button>
      )}
    </div>
  );
}
