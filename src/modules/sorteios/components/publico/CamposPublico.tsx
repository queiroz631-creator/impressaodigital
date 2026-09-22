import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarCpf } from "@/modules/sorteios/validations/cliente";
import { telefoneBR, telefoneRaw } from "@/lib/format";

/**
 * Resolve o "apagar travado" das máscaras: quando o Backspace remove apenas um
 * separador (espaço, ")", "-", "."), a contagem de dígitos não muda e a máscara
 * recriaria o separador na hora. Nesse caso, removemos também o dígito logo
 * antes do cursor e devolvemos o valor remascarado.
 */
function mudarComMascara(
  e: ChangeEvent<HTMLInputElement>,
  valorAtual: string,
  mascarar: (v: string) => string,
  aoMudar: (v: string) => void,
) {
  const novo = e.target.value;
  const digitosAtuais = telefoneRaw(valorAtual);
  const digitosNovos = telefoneRaw(novo);

  if (novo.length < valorAtual.length && digitosNovos.length === digitosAtuais.length) {
    // Apagou só formatação: remove o dígito imediatamente antes do cursor.
    const cursor = e.target.selectionStart ?? novo.length;
    const digitosAntesDoCursor = telefoneRaw(novo.slice(0, cursor)).length;
    const indice = digitosAntesDoCursor - 1;
    const novoRaw =
      indice >= 0
        ? digitosAtuais.slice(0, indice) + digitosAtuais.slice(indice + 1)
        : digitosAtuais;
    aoMudar(mascarar(novoRaw));
    return;
  }

  aoMudar(mascarar(novo));
}

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
        onChange={(e) => mudarComMascara(e, valor, formatarCpf, aoMudar)}
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
        onChange={(e) => mudarComMascara(e, valor, telefoneBR, aoMudar)}
      />
    </div>
  );
}
