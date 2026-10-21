import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import type { AgenteResumo } from "@/lib/agentes/agentes.functions";
import {
  listarFerramentasAutomaveis,
  salvarAutomacao,
  type AutomacaoItem,
} from "@/lib/agentes/automacoes.functions";
import {
  DIAS_SEMANA,
  EVENTOS_AUTORIZADOS,
  FREQUENCIAS,
  FUSOS_COMUNS,
  ROTULOS_FREQUENCIA,
  ROTULOS_TIPO_AUTOMACAO,
  TIPOS_AUTOMACAO,
  automacaoSchema,
  type FrequenciaAutomacao,
  type TipoAutomacao,
} from "@/lib/agentes/utils/automacoes";

interface Props {
  aberto: boolean;
  automacao: AutomacaoItem | null;
  agentes: AgenteResumo[];
  aoFechar: () => void;
  aoSalvar: () => void;
}

/** ISO -> valor de <input type="datetime-local"> (horário local do navegador). */
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function mensagemDaAcao(acao: unknown): string {
  if (acao && typeof acao === "object" && typeof (acao as { mensagem?: unknown }).mensagem === "string") {
    return (acao as { mensagem: string }).mensagem;
  }
  return "";
}

export default function DialogAutomacao({ aberto, automacao, agentes, aoFechar, aoSalvar }: Props) {
  const salvar = useServerFn(salvarAutomacao);
  const fnFerramentas = useServerFn(listarFerramentasAutomaveis);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [agenteId, setAgenteId] = useState("");
  const [tipo, setTipo] = useState<TipoAutomacao>("manual");
  const [frequencia, setFrequencia] = useState<FrequenciaAutomacao>("diaria");
  const [intervalo, setIntervalo] = useState("60");
  const [hora, setHora] = useState("08:00");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [executarEm, setExecutarEm] = useState("");
  const [fuso, setFuso] = useState("America/Sao_Paulo");
  const [evento, setEvento] = useState<string>(EVENTOS_AUTORIZADOS[0].chave);
  const [mensagem, setMensagem] = useState("");
  const [ferramentas, setFerramentas] = useState<string[]>([]);
  const [maxTentativas, setMaxTentativas] = useState("3");
  const [desativarApos, setDesativarApos] = useState("5");
  const [tolerancia, setTolerancia] = useState("15");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    if (!automacao) {
      setNome("");
      setDescricao("");
      setAgenteId("");
      setTipo("manual");
      setFrequencia("diaria");
      setIntervalo("60");
      setHora("08:00");
      setDias([1, 2, 3, 4, 5]);
      setExecutarEm("");
      setFuso("America/Sao_Paulo");
      setEvento(EVENTOS_AUTORIZADOS[0].chave);
      setMensagem("");
      setFerramentas([]);
      setMaxTentativas("3");
      setDesativarApos("5");
      setTolerancia("15");
      return;
    }
    setNome(automacao.nome);
    setDescricao(automacao.descricao ?? "");
    setAgenteId(automacao.agente_id);
    setTipo(automacao.tipo_gatilho as TipoAutomacao);
    setFrequencia((automacao.frequencia as FrequenciaAutomacao | null) ?? "diaria");
    setIntervalo(String(automacao.intervalo_minutos ?? 60));
    setHora(automacao.hora_local ? automacao.hora_local.slice(0, 5) : "08:00");
    setDias(automacao.dias_semana.length > 0 ? automacao.dias_semana : [1, 2, 3, 4, 5]);
    setExecutarEm(paraInputLocal(automacao.executar_em));
    setFuso(automacao.fuso);
    setEvento(automacao.evento ?? EVENTOS_AUTORIZADOS[0].chave);
    setMensagem(mensagemDaAcao(automacao.acao));
    setFerramentas(automacao.ferramentas_permitidas);
    setMaxTentativas(String(automacao.max_tentativas));
    setDesativarApos(String(automacao.desativar_apos_falhas));
    setTolerancia(String(automacao.tolerancia_minutos));
  }, [aberto, automacao]);

  const catalogo = useQuery({
    queryKey: ["automacao-ferramentas", agenteId],
    queryFn: () => fnFerramentas({ data: { agenteId } }),
    enabled: aberto && !!agenteId,
  });

  function alternarFerramenta(chave: string, marcado: boolean) {
    setFerramentas((atual) => (marcado ? [...new Set([...atual, chave])] : atual.filter((c) => c !== chave)));
  }

  function alternarDia(dia: number, marcado: boolean) {
    setDias((atual) => (marcado ? [...new Set([...atual, dia])] : atual.filter((d) => d !== dia)));
  }

  async function enviar() {
    const parse = automacaoSchema.safeParse({
      nome,
      descricao: descricao || null,
      agente_id: agenteId,
      tipo_gatilho: tipo,
      frequencia: tipo === "recorrente" ? frequencia : null,
      intervalo_minutos: tipo === "recorrente" && frequencia === "intervalo" ? Number(intervalo) : null,
      hora_local: tipo === "recorrente" && frequencia !== "intervalo" ? hora : null,
      dias_semana: tipo === "recorrente" && frequencia === "semanal" ? dias : [],
      executar_em: tipo === "agendado" && executarEm ? new Date(executarEm).toISOString() : null,
      fuso,
      evento: tipo === "evento" ? evento : null,
      mensagem,
      ferramentas_permitidas: ferramentas,
      max_tentativas: Number(maxTentativas),
      desativar_apos_falhas: Number(desativarApos),
      tolerancia_minutos: Number(tolerancia),
    });
    if (!parse.success) {
      toast.error(parse.error.issues[0]?.message ?? "Verifique os campos.");
      return;
    }

    setSalvando(true);
    try {
      const r = await salvar({ data: { id: automacao?.id, dados: parse.data } });
      if (!r.ok) {
        toast.error(r.erro ?? "Não foi possível salvar a automação.");
        return;
      }
      toast.success(automacao ? "Automação atualizada." : "Automação criada (pausada). Ative-a quando estiver pronta.");
      aoSalvar();
      aoFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a automação.");
    } finally {
      setSalvando(false);
    }
  }

  const agentesAtivos = agentes;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{automacao ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>
            A automação usa somente ferramentas de consulta, não sensíveis, já vinculadas ao agente. Ela nunca amplia as
            permissões do agente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aut-nome">Nome</Label>
              <Input id="aut-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Agente responsável</Label>
              <Select
                value={agenteId}
                onValueChange={(v) => {
                  setAgenteId(v);
                  setFerramentas([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente" />
                </SelectTrigger>
                <SelectContent>
                  {agentesAtivos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                      {a.ativo ? "" : " (desativado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aut-desc">Descrição</Label>
            <Input id="aut-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de automação</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAutomacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_AUTOMACAO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROTULOS_TIPO_AUTOMACAO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(tipo === "recorrente" || tipo === "agendado") && (
              <div className="space-y-1.5">
                <Label>Fuso horário</Label>
                <Select value={fuso} onValueChange={setFuso} disabled={tipo === "agendado"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUSOS_COMUNS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {tipo === "agendado" && (
            <div className="space-y-1.5">
              <Label htmlFor="aut-quando">Data e hora (horário do seu navegador)</Label>
              <Input
                id="aut-quando"
                type="datetime-local"
                value={executarEm}
                onChange={(e) => setExecutarEm(e.target.value)}
              />
            </div>
          )}

          {tipo === "recorrente" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Frequência</Label>
                  <Select value={frequencia} onValueChange={(v) => setFrequencia(v as FrequenciaAutomacao)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIAS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {ROTULOS_FREQUENCIA[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {frequencia === "intervalo" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="aut-int">Intervalo (minutos, mín. 5)</Label>
                    <Input
                      id="aut-int"
                      type="number"
                      min={5}
                      max={10080}
                      value={intervalo}
                      onChange={(e) => setIntervalo(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="aut-hora">Horário</Label>
                    <Input id="aut-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                  </div>
                )}
              </div>
              {frequencia === "semanal" && (
                <div className="flex flex-wrap gap-3">
                  {DIAS_SEMANA.map((d) => (
                    <label key={d.valor} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={dias.includes(d.valor)} onCheckedChange={(v) => alternarDia(d.valor, v === true)} />
                      {d.curto}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {tipo === "evento" && (
            <div className="space-y-1.5">
              <Label>Evento interno autorizado</Label>
              <Select value={evento} onValueChange={setEvento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTOS_AUTORIZADOS.map((e) => (
                    <SelectItem key={e.chave} value={e.chave}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Somente eventos da lista fechada acima podem disparar automações. Há limite de 1 disparo por minuto.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="aut-msg">O que o agente deve fazer</Label>
            <Textarea
              id="aut-msg"
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={2000}
              placeholder="Ex.: Liste os orçamentos criados hoje e resuma o total."
            />
          </div>

          <div className="space-y-2">
            <Label>Ferramentas permitidas nesta automação</Label>
            {!agenteId ? (
              <p className="text-sm text-muted-foreground">Selecione o agente para ver as ferramentas.</p>
            ) : catalogo.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (catalogo.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                O agente não tem ferramentas de consulta vinculadas. A automação rodará apenas com texto.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(catalogo.data ?? []).map((f) => (
                  <label key={f.chave} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                    <Checkbox
                      checked={ferramentas.includes(f.chave)}
                      onCheckedChange={(v) => alternarFerramenta(f.chave, v === true)}
                    />
                    <span>
                      <span className="font-medium">{f.nome}</span>
                      <span className="block text-xs text-muted-foreground">{f.chave}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="aut-tent">Tentativas por execução</Label>
              <Input id="aut-tent" type="number" min={1} max={10} value={maxTentativas} onChange={(e) => setMaxTentativas(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aut-desat">Desativar após N falhas</Label>
              <Input id="aut-desat" type="number" min={1} max={50} value={desativarApos} onChange={(e) => setDesativarApos(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aut-tol">Tolerância de atraso (min)</Label>
              <Input id="aut-tol" type="number" min={1} max={1440} value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Execuções perdidas (sistema parado na hora marcada): só a ocorrência mais recente roda, e apenas se estiver
            dentro da tolerância. As anteriores são descartadas e geram um alerta.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
