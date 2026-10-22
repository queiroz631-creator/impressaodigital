import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  consultarNumeroSorte,
  identificarParticipante,
  obterCampanhaPublica,
  sairNumeroSorte,
} from "@/lib/numero-sorte-publico.functions";
import { CampoTelefone } from "@/modules/sorteios/components/publico/CamposPublico";
import { formatarCpf } from "@/modules/sorteios/validations/cliente";
import { dataBR, dataHoraBR } from "@/lib/format";

type Premio = {
  nome: string; descricao: string; imagem: string | null; condicoes: string; local: string;
  instrucoes: string; numero: string; prazo_em: string;
};

export function PaginaPublicaNumeroSorte({ numero }: { numero: string }) {
  const obter = useServerFn(obterCampanhaPublica);
  const qc = useQueryClient();
  const chave = ["ns-publico", numero];
  const { data, isLoading } = useQuery({ queryKey: chave, queryFn: () => obter({ data: { numero } }) });
  const recarregar = () => qc.invalidateQueries({ queryKey: chave });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!data?.ok) {
    return (
      <Moldura>
        <Card><CardContent className="p-8 text-center text-muted-foreground">{data?.mensagem ?? "Campanha não encontrada."}</CardContent></Card>
      </Moldura>
    );
  }
  const c = data.dados;
  const aviso =
    c.situacao === "programada" || (!c.aberta && c.situacao === "ativa" && c.inicio_em && new Date(c.inicio_em) > new Date())
      ? "Esta campanha ainda não começou. Volte a partir do início."
      : c.situacao === "suspensa"
        ? "Esta campanha está pausada temporariamente."
        : !c.aberta
          ? "Esta campanha foi encerrada. Obrigado pela participação!"
          : null;

  return (
    <Moldura>
      {c.banner && <img src={c.banner} alt={c.nome} className="w-full rounded-xl object-cover" />}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{c.nome}</h1>
        {c.descricao && <p className="whitespace-pre-line text-muted-foreground">{c.descricao}</p>}
        <p className="text-sm text-muted-foreground">
          {c.inicio_em ? dataBR(c.inicio_em) : "—"} até {c.fim_em ? dataBR(c.fim_em) : "—"}
        </p>
      </div>

      {c.premio ? (
        <ResultadoPremiado premio={c.premio} jaGanhou />
      ) : aviso ? (
        <Card><CardContent className="p-6 text-center font-medium">{aviso}</CardContent></Card>
      ) : c.participante ? (
        <Consulta numero={numero} nome={c.participante.primeiroNome} aoMudar={recarregar} />
      ) : (
        <Identificacao numero={numero} aoEntrar={recarregar} />
      )}

      {c.condicoes && (
        <Card><CardContent className="space-y-1 p-4 text-sm">
          <p className="font-semibold">Como participar</p>
          <p className="whitespace-pre-line text-muted-foreground">{c.condicoes}</p>
        </CardContent></Card>
      )}
      {c.regulamento && (
        <details className="rounded-lg border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Regulamento</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{c.regulamento}</p>
        </details>
      )}
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <div className="flex items-center gap-2 text-primary"><Ticket className="h-6 w-6" /><span className="font-bold">Nº da Sorte</span></div>
        {children}
      </div>
    </div>
  );
}

function Identificacao({ numero, aoEntrar }: { numero: string; aoEntrar: () => void }) {
  const identificar = useServerFn(identificarParticipante);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [regulamento, setRegulamento] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro("");
    if (!regulamento) return setErro("Para participar, aceite o regulamento.");
    setEnviando(true);
    try {
      const r = await identificar({
        data: { numero, nome, cpf, telefone, aceiteRegulamento: true, aceiteMarketing: marketing },
      });
      if (!r.ok) return setErro(r.mensagem);
      aoEntrar();
    } catch {
      setErro("Confira os dados informados e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <p className="font-semibold">Informe seus dados para participar</p>
      <div className="space-y-1"><Label>Nome completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>
      <div className="space-y-1"><Label>CPF</Label><Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} /></div>
      <CampoTelefone valor={telefone} aoMudar={setTelefone} />
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={regulamento} onCheckedChange={(v) => setRegulamento(v === true)} />Li e aceito o regulamento da campanha.</label>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} />Aceito receber novidades e promoções (opcional).</label>
      <p className="text-xs text-muted-foreground">Seus dados são usados apenas para controlar sua participação e a entrega do prêmio, e não são exibidos nesta página.</p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button className="h-12 w-full text-base" disabled={enviando} onClick={() => void enviar()}>
        {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Continuar
      </Button>
    </CardContent></Card>
  );
}

function Consulta({ numero, nome, aoMudar }: { numero: string; nome: string; aoMudar: () => void }) {
  const consultar = useServerFn(consultarNumeroSorte);
  const sair = useServerFn(sairNumeroSorte);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "info"; texto: string } | null>(null);
  const [premio, setPremio] = useState<Premio | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setMsg(null);
    if (codigo.length < 6) return setMsg({ tipo: "erro", texto: "Digite o número completo." });
    setEnviando(true);
    try {
      const r = await consultar({ data: { numero, codigo } });
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: r.mensagem });
        if (r.codigo === "SESSAO") aoMudar();
        return;
      }
      const { resultado, restantes } = r.dados;
      const resto = restantes != null && restantes >= 0 ? ` Você ainda pode consultar ${restantes} número(s).` : "";
      if (resultado === "premiado" || resultado === "ja_premiado") {
        if (r.dados.premio) setPremio(r.dados.premio);
        else aoMudar();
      } else if (resultado === "nao_premiado") {
        setMsg({ tipo: "info", texto: `Que pena! Seu número não foi contemplado nesta campanha.${resto}` });
        setCodigo("");
      } else if (resultado === "invalido") {
        setMsg({ tipo: "erro", texto: `Este número não pertence a esta campanha.${resto}` });
      } else if (resultado === "limite") {
        setMsg({ tipo: "erro", texto: "Você atingiu o limite de consultas desta campanha." });
      } else if (resultado === "limite_tempo") {
        setMsg({ tipo: "erro", texto: "Muitas consultas seguidas. Aguarde alguns minutos." });
      } else {
        setMsg({ tipo: "erro", texto: "Esta campanha não está recebendo participações agora." });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (premio) return <ResultadoPremiado premio={premio} />;

  return (
    <Card><CardContent className="space-y-4 pt-6">
      <p className="font-semibold">Olá{nome ? `, ${nome}` : ""}! Digite seu número da sorte</p>
      <Input
        inputMode="numeric"
        className="h-14 text-center text-2xl tracking-widest"
        value={codigo}
        maxLength={15}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && void enviar()}
      />
      {msg && <p className={msg.tipo === "erro" ? "text-sm text-destructive" : "text-center font-medium"}>{msg.texto}</p>}
      <Button className="h-12 w-full text-base" disabled={enviando} onClick={() => void enviar()}>
        {enviando && <Loader2 className="h-5 w-5 animate-spin" />} Consultar
      </Button>
      <button type="button" className="w-full text-sm text-muted-foreground underline"
        onClick={() => void sair().then(aoMudar)}>Não sou eu</button>
    </CardContent></Card>
  );
}

function ResultadoPremiado({ premio, jaGanhou }: { premio: Premio; jaGanhou?: boolean }) {
  return (
    <Card className="border-primary"><CardContent className="space-y-3 pt-6 text-center">
      <Gift className="mx-auto h-10 w-10 text-primary" />
      {jaGanhou ? (
        <p className="font-semibold">Você já foi contemplado nesta campanha e não poderá participar novamente.</p>
      ) : (
        <p className="text-2xl font-bold text-primary">Parabéns! Você ganhou!</p>
      )}
      {premio.imagem && <img src={premio.imagem} alt={premio.nome} className="mx-auto max-h-56 rounded-lg object-contain" />}
      <p className="text-xl font-semibold">{premio.nome}</p>
      {premio.descricao && <p className="whitespace-pre-line text-muted-foreground">{premio.descricao}</p>}
      <div className="space-y-1 text-left text-sm">
        <p><span className="font-medium">Número:</span> {premio.numero}</p>
        {premio.condicoes && <p><span className="font-medium">Condições:</span> {premio.condicoes}</p>}
        {premio.instrucoes && <p><span className="font-medium">Instruções:</span> {premio.instrucoes}</p>}
        <p><span className="font-medium">Retirar até:</span> {dataHoraBR(premio.prazo_em)}</p>
        {premio.local && <p><span className="font-medium">Local:</span> {premio.local}</p>}
      </div>
      <p className="rounded-md bg-muted p-3 text-sm font-medium">
        Guarde esta informação! Seu comprovante de retirada será disponibilizado após a confirmação da premiação.
      </p>
    </CardContent></Card>
  );
}
