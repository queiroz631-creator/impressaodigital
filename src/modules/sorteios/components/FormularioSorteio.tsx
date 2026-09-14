import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import {
  centavosDeTexto,
  esquemaSorteio,
  paraDatetimeLocal,
  paraIso,
  textoDeCentavos,
  type DadosSorteio,
} from "../validations/sorteio";
import { MENSAGEM_BLOQUEIO_CRITICO } from "../services/status";
import type { Sorteio } from "../types";

export type ValoresSorteio = {
  nome: string;
  numero_sorteio: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  data_sorteio: string;
  valor_por_cupom: string;
  quantidade_maxima_cupons: string;
};

function valoresIniciais(sorteio?: Sorteio | null): ValoresSorteio {
  return {
    nome: sorteio?.nome ?? "",
    numero_sorteio: sorteio ? String(sorteio.numero_sorteio) : "",
    descricao: sorteio?.descricao ?? "",
    data_inicio: paraDatetimeLocal(sorteio?.data_inicio),
    data_fim: paraDatetimeLocal(sorteio?.data_fim),
    data_sorteio: paraDatetimeLocal(sorteio?.data_sorteio),
    valor_por_cupom: sorteio ? textoDeCentavos(sorteio.valor_por_cupom_centavos) : "",
    quantidade_maxima_cupons: sorteio?.quantidade_maxima_cupons
      ? String(sorteio.quantidade_maxima_cupons)
      : "",
  };
}

/**
 * Formulário de cadastro/edição do sorteio.
 * Quando `criticosBloqueados`, os campos críticos ficam somente leitura.
 */
export function FormularioSorteio({
  sorteio,
  criticosBloqueados = false,
  salvando,
  onSalvar,
  onCancelar,
}: {
  sorteio?: Sorteio | null;
  criticosBloqueados?: boolean;
  salvando: boolean;
  onSalvar: (dados: DadosSorteio) => void;
  onCancelar: () => void;
}) {
  const [valores, setValores] = useState<ValoresSorteio>(() => valoresIniciais(sorteio));
  const [erros, setErros] = useState<Record<string, string>>({});

  const set = (campo: keyof ValoresSorteio) => (valor: string) =>
    setValores((v) => ({ ...v, [campo]: valor }));

  function enviar() {
    const centavos = centavosDeTexto(valores.valor_por_cupom);
    const limite = valores.quantidade_maxima_cupons.trim();
    const candidato = {
      nome: valores.nome,
      numero_sorteio: Number(valores.numero_sorteio),
      descricao: valores.descricao,
      data_inicio: paraIso(valores.data_inicio) ?? "",
      data_fim: paraIso(valores.data_fim) ?? "",
      data_sorteio: paraIso(valores.data_sorteio) ?? "",
      valor_por_cupom_centavos: centavos ?? 0,
      quantidade_maxima_cupons: limite ? Number(limite) : null,
    };

    const resultado = esquemaSorteio.safeParse(candidato);
    if (!resultado.success) {
      const mapa: Record<string, string> = {};
      for (const issue of resultado.error.issues) {
        const chave = String(issue.path[0] ?? "geral");
        if (!mapa[chave]) mapa[chave] = issue.message;
      }
      setErros(mapa);
      return;
    }
    setErros({});
    onSalvar(resultado.data);
  }

  const erro = (campo: string) =>
    erros[campo] ? <p className="mt-1 text-xs text-destructive">{erros[campo]}</p> : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sorteio ? "Editar sorteio" : "Novo sorteio"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticosBloqueados && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{MENSAGEM_BLOQUEIO_CRITICO}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={valores.nome}
              onChange={(e) => set("nome")(e.target.value)}
              placeholder="Ex.: Sorteio de Natal"
            />
            {erro("nome")}
          </div>

          <div>
            <Label htmlFor="numero">Número *</Label>
            <Input
              id="numero"
              type="number"
              min={1}
              value={valores.numero_sorteio}
              onChange={(e) => set("numero_sorteio")(e.target.value)}
              disabled={criticosBloqueados}
            />
            {erro("numero_sorteio")}
          </div>

          <div>
            <Label htmlFor="valor">Valor por cupom (R$) *</Label>
            <Input
              id="valor"
              inputMode="decimal"
              placeholder="20,00"
              value={valores.valor_por_cupom}
              onChange={(e) => set("valor_por_cupom")(e.target.value)}
              disabled={criticosBloqueados}
            />
            {erro("valor_por_cupom_centavos")}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              rows={3}
              value={valores.descricao}
              onChange={(e) => set("descricao")(e.target.value)}
            />
            {erro("descricao")}
          </div>

          <div>
            <Label htmlFor="inicio">Data de início *</Label>
            <Input
              id="inicio"
              type="datetime-local"
              value={valores.data_inicio}
              onChange={(e) => set("data_inicio")(e.target.value)}
              disabled={criticosBloqueados}
            />
            {erro("data_inicio")}
          </div>

          <div>
            <Label htmlFor="fim">Data de fim *</Label>
            <Input
              id="fim"
              type="datetime-local"
              value={valores.data_fim}
              onChange={(e) => set("data_fim")(e.target.value)}
              disabled={criticosBloqueados}
            />
            {erro("data_fim")}
          </div>

          <div>
            <Label htmlFor="dataSorteio">Data do sorteio *</Label>
            <Input
              id="dataSorteio"
              type="datetime-local"
              value={valores.data_sorteio}
              onChange={(e) => set("data_sorteio")(e.target.value)}
            />
            {erro("data_sorteio")}
          </div>

          <div>
            <Label htmlFor="limite">Limite máximo de cupons</Label>
            <Input
              id="limite"
              type="number"
              min={1}
              placeholder="Sem limite"
              value={valores.quantidade_maxima_cupons}
              onChange={(e) => set("quantidade_maxima_cupons")(e.target.value)}
            />
            {erro("quantidade_maxima_cupons")}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={enviar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
