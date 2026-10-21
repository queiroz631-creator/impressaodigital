import { useEffect, useRef } from "react";
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
import { obterQrCodeConexao } from "@/lib/whatsapp-provedores.functions";
import { srcQrCode } from "./rotulos";

interface Props {
  conexaoId: string | null;
  nome: string;
  onFechar: () => void;
  onConectado: () => void;
}

export default function DialogQrCode({ conexaoId, nome, onFechar, onConectado }: Props) {
  const obter = useServerFn(obterQrCodeConexao);
  const avisou = useRef(false);

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-qr", conexaoId],
    queryFn: () => obter({ data: { id: conexaoId! } }),
    enabled: Boolean(conexaoId),
    // O QR expira em segundos: renova sozinho enquanto a janela estiver aberta.
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: false,
  });

  const conectado = data?.ok === true && data.estado === "open";

  useEffect(() => {
    avisou.current = false;
  }, [conexaoId]);

  useEffect(() => {
    if (!conectado || avisou.current) return;
    avisou.current = true;
    toast.success("WhatsApp conectado.");
    onConectado();
    onFechar();
  }, [conectado, onConectado, onFechar]);

  const imagem = srcQrCode(data?.qrCodeBase64);

  return (
    <Dialog open={Boolean(conexaoId)} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code — {nome}</DialogTitle>
          <DialogDescription>
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho. O código é
            renovado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-64 items-center justify-center">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : data && !data.ok ? (
            <p className="text-center text-sm text-destructive">
              {data.erro ?? "Não foi possível obter o QR Code."}
            </p>
          ) : imagem ? (
            <img src={imagem} alt="QR Code do WhatsApp" className="h-64 w-64 rounded border bg-white p-2" />
          ) : data?.codigoPareamento ? (
            <p className="text-center text-sm">
              Código de pareamento: <strong>{data.codigoPareamento}</strong>
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Aguardando o servidor gerar o QR Code…
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Atualizando..." : "Atualizar agora"}
          </Button>
          <Button onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
