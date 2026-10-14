import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  obterAgente,
  salvarAgente,
  salvarPrompt,
  type AgenteResumo,
} from "@/lib/agentes/agentes.functions";
import { ROTULOS_TIPO_AGENTE } from "@/lib/agentes/utils/rotulos";
import { OPCOES_ICONE } from "./icones";

interface Props {
  aberto: boolean;
  agente: AgenteResumo | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}

/** Extrai o texto do prompt ativo a partir do conteúdo jsonb da versão. */
function textoDoPrompt(conteudo: unknown): string {
  if (conteudo && typeof conteudo === "object" && "texto" in conteudo) {
    const valor = (conteudo as { texto?: unknown }).texto;
    if (typeof valor === "string") return valor;
  }
  return "";
}

export default function DialogAgente({ aberto, agente, aoFechar, aoSalvar }: Props) {
  const salvar = useServerFn(salvarAgente);
  const gravarPrompt = useServerFn(salvarPrompt);
  const obter = useServerFn(obterAgente);

  const [nome, setNome] = useState("");
  const [chave, setChave] = useState("");
  const [tipo, setTipo] = useState("personalizado");
  const [descricao, setDescricao] = useState("");
  const [icone, setIcone] = useState("Bot");
  const [modelo, setModelo] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [rota, setRota] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [ativo, setAtivo] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [salvando, setSalvando] = useState(false);

  const detalhe = useQuery({
    queryKey: ["agente-detalhe", agente?.id],
    queryFn: () => obter({ data: { id: agente!.id } }),
    enabled: aberto && !!agente?.id,
  });

  useEffect(() => {
    if (!aberto) return;
    if (!agente) {
      setNome("");
      setChave("");
      setTipo("personalizado");
      setDescricao("");
      setIcone("Bot");
      setModelo("");
      setTemperatura("");
      setRota("");
      setOrdem("0");
      setAtivo(false);
      setPrompt("");
      return;
    }
    setNome(agente.nome);
    setChave(agente.chave);
    setTipo(agente.tipo);
    setDescricao(agente.descricao);
    setIcone(agente.icone);
    setModelo(agente.modelo ?? "");
    setTemperatura(agente.temperatura === null ? "" : String(agente.temperatura));
    setRota(agente.rota_painel ?? "");
    setOrdem(String(agente.ordem));
    setAtivo(agente.ativo);
  }, [aberto, agente]);

  useEffect(() => {
    if (!detalhe.data) return;
    const ativo_ = detalhe.data.versoes.find((v) => v.tipo === "prompt" && v.ativo);
    setPrompt(textoDoPrompt(ativo_?.conteudo));
  }, [detalhe.data]);

  async function enviar() {
    if (!nome.trim() || !chave.trim()) {
      toast.error("Informe o nome e a chave do agente.");
      return;
    }
    setSalvando(true);
    try {
      const temp = temperatura.trim() === "" ? null : Number(temperatura.replace(",", "."));
      if (temp !== null && (Number.isNaN(temp) || temp < 0 || temp > 2)) {
        toast.error("A temperatura deve ficar entre 0 e 2.");
        return;
      }
      const resultado = await salvar({
        data: {
          id: agente?.id,
          chave: chave.trim(),
          nome: nome.trim(),
          tipo: tipo as "atendimento" | "operacional" | "operador_computador" | "personalizado",
          descricao: descricao.trim(),
          icone,
          modelo: modelo.trim() || null,
          temperatura: temp,
          rota_painel: rota.trim() || null,
          ordem: Number(ordem) || 0,
          ativo,
        },
      });
      if (!resultado.ok || !resultado.id) {
        toast.error(resultado.erro ?? "Não foi possível salvar o agente.");
        return;
      }
      if (prompt.trim()) {
        const versao = await gravarPrompt({
          data: { agenteId: resultado.id, texto: prompt.trim(), observacao: "" },
        });
        if (!versao.ok) toast.error(versao.erro ?? "O agente foi salvo, mas o prompt não.");
      }
      toast.success(agente ? "Agente atualizado." : "Agente criado.");
      aoSalvar();
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{agente ? "Editar agente" : "Novo agente"}</DialogTitle>
          <DialogDescription>
            Dados de identificação e o prompt do sistema. Nenhuma credencial é guardada aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="agente-nome">Nome</Label>
            <Input id="agente-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agente-chave">Chave</Label>
            <Input
              id="agente-chave"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              maxLength={60}
              placeholder="ex.: atendimento"
            />
            <p className="text-xs text-muted-foreground">Letras minúsculas, números e _.</p>
          </div>

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROTULOS_TIPO_AGENTE).map(([valor, texto]) => (
                  <SelectItem key={valor} value={valor}>
                    {texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="agente-descricao">Descrição</Label>
            <Textarea
              id="agente-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={600}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label>Ícone</Label>
            <Select value={icone} onValueChange={setIcone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_ICONE.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agente-ordem">Ordem</Label>
            <Input
              id="agente-ordem"
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              min={0}
              max={999}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agente-modelo">Modelo (opcional)</Label>
            <Input
              id="agente-modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              maxLength={120}
              placeholder="padrão do provedor"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agente-temperatura">Temperatura (0 a 2)</Label>
            <Input
              id="agente-temperatura"
              value={temperatura}
              onChange={(e) => setTemperatura(e.target.value)}
              placeholder="padrão"
              inputMode="decimal"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="agente-rota">Rota do painel (opcional)</Label>
            <Input
              id="agente-rota"
              value={rota}
              onChange={(e) => setRota(e.target.value)}
              maxLength={120}
              placeholder="/agentes"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="agente-prompt">Prompt do sistema</Label>
            <Textarea
              id="agente-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="Instruções permanentes do agente (salvas como nova versão)."
              disabled={detalhe.isLoading && !!agente?.id}
            />
            <p className="text-xs text-muted-foreground">
              Ao salvar, o texto vira uma nova versão ativa; as anteriores ficam no histórico.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Agente ativo</p>
              <p className="text-xs text-muted-foreground">
                Enquanto inativo, o agente não participa de execuções.
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
