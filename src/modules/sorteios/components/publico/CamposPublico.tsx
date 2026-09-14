import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarCpf } from "@/modules/sorteios/validations/cliente";
import { telefoneBR } from "@/lib/format";

/** Campo de CPF com máscara 000.000.000-00 (o valor guardado é só dígitos). */
export function CampoCpf({
  valor,
  aoMudar,
  desabilitado,
  autoFocus,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="cpf">CPF</Label>
      <Input
        id="cpf"
        inputMode="numeric"
        placeholder="000.000.000-00"
        className="h-12 text-lg"
        value={valor}
        autoFocus={autoFocus ?? false}
        disabled={desabilitado ?? false}
        onChange={(e) => aoMudar(formatarCpf(e.target.value))}
      />
    </div>
  );
}

/** Campo de telefone com máscara (00) 00000-0000. */
export function CampoTelefone({
  valor,
  aoMudar,
  desabilitado,
  autoFocus,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
      <Input
        id="telefone"
        inputMode="numeric"
        placeholder="(00) 00000-0000"
        className="h-12 text-lg"
        value={valor}
        autoFocus={autoFocus ?? false}
        disabled={desabilitado ?? false}
        onChange={(e) => aoMudar(telefoneBR(e.target.value))}
      />
    </div>
  );
}
