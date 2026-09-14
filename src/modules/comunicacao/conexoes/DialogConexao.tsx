import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { atualizarConexao, criarConexao, type ConexaoPublica } from "@/lib/conexoes.functions";

interface Props {
  aberto: boolean;
  conexao: ConexaoPublica | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export default function DialogConexao({ aberto, conexao, onFechar, onSalvo }: Props) {
  const criar = useServerFn(criarConexao);
  const atualizar = useServerFn(atualizarConexao);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cor, setCor] = useState("#25D366");
  const [baseUrl, setBaseUrl] = useState("https://api.z-api.io");
  const [instanceId, setInstanceId] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(conexao?.nome ?? "");
    setTelefone(conexao?.telefone ?? "");
    setCor(conexao?.cor ?? "#25D366");
    setBaseUrl(conexao?.base_url ?? "https://api.z-api.io");
    setInstanceId("");
    setInstanceToken("");
    setClientToken("");
    setOrdem(conexao?.ordem ?? 0);
  }, [aberto, conexao]);

  async function salvar() {
    if (nome.trim().length < 2) {
      toast.error("Informe o nome da conexão.");
      return;
    }
    setSalvando(true);
    try {
      const base = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        cor,
        baseUrl: baseUrl.trim(),
        instanceId: instanceId.trim(),
        instanceToken: instanceToken.trim(),
        clientToken: clientToken.trim(),
        ordem,
      };
      const r = conexao
        ? await atualizar({ data: { ...base, id: conexao.id } })
        : await criar({ data: { ...base, ativo: true } });
      if (r.erro) {
        toast.error(r.erro);
        return;
      }
      toast.success(conexao ? "Conexão salva." : "Conexão criada.");
      onSalvo();
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{conexao ? "Editar conexão" : "Nova conexão"}</DialogTitle>
          <DialogDescription>
            As credenciais ficam guardadas somente no servidor.
            {conexao ? " Deixe os campos de token em branco para manter os atuais." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cx-nome">Nome</Label>
              <Input id="cx-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cx-tel">Número</Label>
              <Input
                id="cx-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="5511999999999"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cx-cor">Cor</Label>
              <Input
                id="cx-cor"
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-10 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cx-ordem">Ordem</Label>
              <Input
                id="cx-ordem"
                type="number"
                min={0}
                value={ordem}
                onChange={(e) => setOrdem(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-base">Endereço da API</Label>
            <Input id="cx-base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-inst">Instance ID</Label>
            <Input
              id="cx-inst"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder={conexao ? "manter o atual" : ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-itoken">Instance Token</Label>
            <Input
              id="cx-itoken"
              type="password"
              autoComplete="new-password"
              value={instanceToken}
              onChange={(e) => setInstanceToken(e.target.value)}
              placeholder={conexao ? "manter o atual" : ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cx-ctoken">Client Token</Label>
            <Input
              id="cx-ctoken"
              type="password"
              autoComplete="new-password"
              value={clientToken}
              onChange={(e) => setClientToken(e.target.value)}
              placeholder={conexao ? "manter o atual" : ""}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={salvando} onClick={() => void salvar()}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
