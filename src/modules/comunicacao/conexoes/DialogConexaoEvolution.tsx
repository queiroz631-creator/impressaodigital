import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarConexaoEvolution,
  listarServidoresProvedor,
  type ServidorPublico,
} from "@/lib/whatsapp-provedores.functions";
import { CHAVE_SERVIDORES } from "./DialogServidores";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Recebe o id da conexão criada (para abrir o QR Code em seguida). */
  onCriada: (id: string, nome: string) => void;
}

const REGEX_INSTANCIA = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;

export default function DialogConexaoEvolution({ aberto, onFechar, onCriada }: Props) {
  const listar = useServerFn(listarServidoresProvedor);
  const criar = useServerFn(criarConexaoEvolution);

  const [servidorId, setServidorId] = useState("");
  const [nome, setNome] = useState("");
  const [instancia, setInstancia] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cor, setCor] = useState("#25D366");
  const [salvando, setSalvando] = useState(false);

  const { data: servidores = [] } = useQuery({
    queryKey: [CHAVE_SERVIDORES],
    queryFn: () => listar(),
    enabled: aberto,
    retry: 1,
  });
  const disponiveis = (servidores as ServidorPublico[]).filter((s) => s.ativo);

  useEffect(() => {
    if (!aberto) return;
    setNome("");
    setInstancia("");
    setTelefone("");
    setCor("#25D366");
    setServidorId("");
  }, [aberto]);

  useEffect(() => {
    if (aberto && !servidorId && disponiveis.length === 1) setServidorId(disponiveis[0]!.id);
  }, [aberto, servidorId, disponiveis]);

  async function salvar() {
    if (!servidorId) return void toast.error("Escolha o servidor.");
    if (nome.trim().length < 2) return void toast.error("Informe o nome da conexão.");
    if (!REGEX_INSTANCIA.test(instancia.trim())) {
      return void toast.error("Instância: 3 a 40 caracteres (letras, números, _ e -).");
    }
    setSalvando(true);
    try {
      const r = await criar({
        data: { servidorId, nome: nome.trim(), nomeInstancia: instancia.trim(), telefone: telefone.trim(), cor },
      });
      if (!r.ok || !r.id) {
        toast.error(r.erro ?? "Não foi possível criar a conexão.");
        return;
      }
      if (r.aviso) toast.warning(`Conexão criada, mas o webhook não foi configurado: ${r.aviso}`);
      else toast.success("Conexão criada.");
      onCriada(r.id, nome.trim());
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova conexão Evolution</DialogTitle>
          <DialogDescription>
            Cria a instância no servidor, configura o webhook e abre o QR Code para conectar o número.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Servidor</Label>
            <Select value={servidorId} onValueChange={setServidorId}>
              <SelectTrigger>
                <SelectValue placeholder={disponiveis.length ? "Escolha o servidor" : "Nenhum servidor ativo"} />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                    {s.chave_configurada ? "" : " (sem chave)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {disponiveis.length === 0 && (
              <p className="text-xs text-amber-600">Cadastre um servidor em “Servidores” antes.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-nome">Nome</Label>
              <Input id="ev-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-inst">Nome da instância</Label>
              <Input
                id="ev-inst"
                value={instancia}
                onChange={(e) => setInstancia(e.target.value)}
                placeholder="loja-principal"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-tel">Número (opcional)</Label>
              <Input
                id="ev-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="5511999999999"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cor">Cor</Label>
              <Input
                id="ev-cor"
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-10 p-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={salvando || !disponiveis.length} onClick={() => void salvar()}>
            {salvando ? "Criando..." : "Criar conexão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
