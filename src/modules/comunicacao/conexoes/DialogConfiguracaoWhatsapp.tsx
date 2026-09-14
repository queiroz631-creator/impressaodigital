import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

export default function DialogConfiguracaoWhatsapp({ aberto, onFechar }: Props) {
  const [origem, setOrigem] = useState("");
  const [enderecoSistema, setEnderecoSistema] = useState("");
  const enderecoCarregado = useRef(false);

  useEffect(() => setOrigem(window.location.origin), []);

  const config = useQuery({
    queryKey: ["whatsapp-config"],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("id, app_url")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!aberto) {
      enderecoCarregado.current = false;
      return;
    }
    if (enderecoCarregado.current || !config.data) return;
    enderecoCarregado.current = true;
    setEnderecoSistema(config.data.app_url ?? "");
  }, [aberto, config.data]);

  const salvarEndereco = useMutation({
    mutationFn: async (valor: string) => {
      const id = config.data?.id;
      if (!id) throw new Error("Configuração não encontrada");
      const { error } = await supabase
        .from("whatsapp_config")
        .update({ app_url: valor.trim().replace(/\/+$/, "") })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Endereço do sistema salvo.");
      await config.refetch();
      onFechar();
    },
    onError: (erro: unknown) => {
      const detalhe =
        erro && typeof erro === "object" && "message" in erro
          ? String((erro as { message?: unknown }).message ?? "")
          : "";
      toast.error(
        detalhe
          ? `Não foi possível salvar o endereço do sistema: ${detalhe}`
          : "Não foi possível salvar o endereço do sistema.",
      );
    },
  });

  const enderecoNormalizado = enderecoSistema.replace(/\/+$/, "");

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuração do WhatsApp</DialogTitle>
          <DialogDescription>
            Defina o endereço público usado pelas rotinas automáticas do WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="whatsapp-endereco-sistema">Endereço do sistema</Label>
          <Input
            id="whatsapp-endereco-sistema"
            value={enderecoSistema}
            onChange={(evento) => setEnderecoSistema(evento.target.value)}
            placeholder="https://seudominio.com"
            className="font-mono text-xs"
            disabled={config.isLoading || salvarEndereco.isPending}
          />
          <p className="text-xs text-muted-foreground">
            É o endereço em que o sistema está publicado. As respostas automáticas do bot e os
            avisos de inatividade são disparados por aqui — se estiver diferente do endereço em uso,
            o bot não responde.
          </p>
          {origem && enderecoNormalizado !== origem ? (
            <p className="text-xs font-semibold text-destructive">
              Diferente do endereço aberto agora ({origem}).
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          {origem && enderecoNormalizado !== origem ? (
            <Button
              variant="outline"
              onClick={() => setEnderecoSistema(origem)}
              disabled={config.isLoading || salvarEndereco.isPending}
            >
              Usar este endereço
            </Button>
          ) : null}
          <Button
            onClick={() => salvarEndereco.mutate(enderecoSistema)}
            disabled={config.isLoading || salvarEndereco.isPending || !enderecoSistema.trim()}
          >
            {salvarEndereco.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
