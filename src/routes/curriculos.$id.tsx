import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Copy, FileDown, Link2, MessageCircle, Pencil, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { CurriculoDocumento } from "@/components/curriculo/CurriculoDocumento";
import { FormularioCurriculo } from "@/components/curriculo/FormularioCurriculo";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  formatarCpf,
  formatarTelefone,
  type CurriculoCompleto,
  type PayloadEtapa,
} from "@/lib/curriculo";
import { baixarCurriculoPdf, curriculoPdfBase64, imprimirCurriculo, nomeArquivoCurriculo } from "@/lib/curriculo-pdf";
import { enviarCurriculoWhatsapp, gerarLinkCurriculo } from "@/lib/curriculo.functions";
import { dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/curriculos/$id")({
  head: () => ({
    meta: [
      { title: "Currículo do cliente | Impressão Digital" },
      { name: "description", content: "Preencha, imprima e envie o currículo do cliente." },
      { property: "og:title", content: "Currículo do cliente" },
      { property: "og:description", content: "Preencha, imprima e envie o currículo do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <DetalheCurriculo />
    </AppLayout>
  ),
});

const CAMPOS =
  "id, cliente_id, status, nome_completo, cpf, telefone_principal, data_nascimento, estado_civil, email, documentacao_completa, habilitacao, categoria_habilitacao, escolaridade, curso_superior, pos_graduacao_nome, endereco, bairro, cidade, uf, cep, objetivo_tipo, objetivo_texto, exibir_data_atualizacao, created_at, updated_at, completed_at";

function DetalheCurriculo() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const documentoRef = useRef<HTMLDivElement>(null);

  const [modoEdicao, setModoEdicao] = useState(false);
  const [linkGerado, setLinkGerado] = useState<{ url: string; expiraEm: string } | null>(null);
  const [whatsAberto, setWhatsAberto] = useState(false);
  const [telefoneEnvio, setTelefoneEnvio] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const gerarLink = useServerFn(gerarLinkCurriculo);
  const enviarWhats = useServerFn(enviarCurriculoWhatsapp);

  const { data, isLoading } = useQuery({
    queryKey: ["curriculo", id],
    queryFn: async (): Promise<CurriculoCompleto & { catalogo: { id: string; descricao: string }[]; objetivos: { id: string; texto: string }[] }> => {
      const [c, tel, cur, form, exp, hab, cat, obj] = await Promise.all([
        supabase.from("curriculos").select(CAMPOS).eq("id", id).maybeSingle(),
        supabase.from("curriculo_telefones").select("telefone").eq("curriculo_id", id).order("ordem"),
        supabase.from("curriculo_cursos").select("nome_curso, instituicao, ano").eq("curriculo_id", id).order("ordem"),
        supabase.from("curriculo_formacoes").select("nome_curso, instituicao, ano, nivel").eq("curriculo_id", id).order("ordem"),
        supabase
          .from("curriculo_experiencias")
          .select("empresa, cargo, periodo, atividades")
          .eq("curriculo_id", id)
          .order("ordem"),
        supabase.from("curriculo_habilidades").select("habilidade_id, descricao").eq("curriculo_id", id).order("ordem"),
        supabase.from("habilidades_curriculo").select("id, descricao").eq("ativo", true).order("ordem"),
        supabase.from("objetivos_curriculo").select("id, texto").eq("ativo", true).order("ordem"),
      ]);

      if (c.error) throw c.error;
      if (!c.data) throw new Error("Currículo não encontrado.");

      return {
        curriculo: c.data as CurriculoCompleto["curriculo"],
        telefones: tel.data ?? [],
        cursos: cur.data ?? [],
        formacoes: form.data ?? [],
        experiencias: exp.data ?? [],
        habilidades: hab.data ?? [],
        catalogo: cat.data ?? [],
        objetivos: obj.data ?? [],
      };
    },
  });

  const salvarEtapa = async (payload: PayloadEtapa) => {
    if (payload.campos && Object.keys(payload.campos).length > 0) {
      const { error } = await supabase.from("curriculos").update(payload.campos).eq("id", id);
      if (error) throw new Error(error.message);
    }

    const trocar = async (
      tabela:
        | "curriculo_telefones"
        | "curriculo_cursos"
        | "curriculo_formacoes"
        | "curriculo_experiencias"
        | "curriculo_habilidades",
      linhas: Record<string, unknown>[],
    ) => {
      await supabase.from(tabela).delete().eq("curriculo_id", id);
      if (linhas.length) {
        const { error } = await supabase
          .from(tabela)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(linhas.map((l, i) => ({ ...l, curriculo_id: id, ordem: i })) as any);
        if (error) throw new Error(error.message);
      }
    };

    if (payload.telefones) {
      await trocar(
        "curriculo_telefones",
        payload.telefones.filter((t) => t.telefone.trim()).map((t) => ({ telefone: t.telefone.trim() })),
      );
    }
    if (payload.cursos) {
      await trocar(
        "curriculo_cursos",
        payload.cursos
          .filter((c) => c.nome_curso.trim())
          .map((c) => ({
            nome_curso: c.nome_curso.trim(),
            instituicao: c.instituicao?.trim() || null,
            ano: c.ano?.trim() || null,
          })),
      );
    }
    if (payload.formacoes) {
      await trocar(
        "curriculo_formacoes",
        payload.formacoes
          .filter((f) => f.nome_curso.trim() || (f.nivel ?? "").trim())
          .map((f) => ({
            nome_curso: f.nome_curso.trim(),
            instituicao: f.instituicao?.trim() || null,
            ano: f.ano?.trim() || null,
            nivel: f.nivel?.trim() || null,
          })),
      );
    }

    if (payload.experiencias) {
      await trocar(
        "curriculo_experiencias",
        payload.experiencias
          .filter((e) => (e.empresa ?? "").trim() || (e.cargo ?? "").trim())
          .map((e) => ({
            empresa: e.empresa?.trim() || null,
            cargo: e.cargo?.trim() || null,
            periodo: e.periodo?.trim() || null,
            atividades: e.atividades?.trim() || null,
          })),
      );
    }
    if (payload.habilidades) {
      await trocar(
        "curriculo_habilidades",
        payload.habilidades
          .filter((h) => h.descricao.trim())
          .map((h) => ({ habilidade_id: h.habilidade_id ?? null, descricao: h.descricao.trim() })),
      );
    }
    if (payload.finalizar) {
      await supabase
        .from("curriculos")
        .update({ status: "completo", completed_at: new Date().toISOString() })
        .eq("id", id);
    }

    await queryClient.invalidateQueries({ queryKey: ["curriculo", id] });
    await queryClient.invalidateQueries({ queryKey: ["curriculos"] });
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const dados: CurriculoCompleto = {
    curriculo: data.curriculo,
    telefones: data.telefones,
    cursos: data.cursos,
    formacoes: data.formacoes,
    experiencias: data.experiencias,
    habilidades: data.habilidades,
  };

  const enviarPorWhatsapp = async () => {
    setEnviando(true);
    try {
      const base64 = curriculoPdfBase64(dados);
      await enviarWhats({
        data: {
          curriculoId: id,
          telefone: telefoneEnvio,
          mensagem,
          pdfBase64: base64,
          nomeArquivo: nomeArquivoCurriculo(data.curriculo.nome_completo),
        },
      });
      toast.success("Currículo enviado pelo WhatsApp.");
      setWhatsAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/curriculos" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-xl font-bold">{data.curriculo.nome_completo || "Currículo"}</h1>
        <Badge variant={data.curriculo.status === "completo" ? "default" : "secondary"}>
          {data.curriculo.status === "completo" ? "Completo" : "Rascunho"}
        </Badge>
        <span className="text-xs text-muted-foreground">CPF {formatarCpf(data.curriculo.cpf)}</span>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant={modoEdicao ? "default" : "outline"} size="sm" onClick={() => setModoEdicao((v) => !v)}>
            <Pencil className="mr-1 h-4 w-4" /> {modoEdicao ? "Ver currículo" : "Editar"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => imprimirCurriculo(documentoRef.current)}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => baixarCurriculoPdf(dados)}>
            <FileDown className="mr-1 h-4 w-4" /> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTelefoneEnvio(data.curriculo.telefone_principal || "");
              setMensagem(`Olá! Segue o currículo de ${data.curriculo.nome_completo}.`);
              if (!data.curriculo.telefone_principal) {
                toast.error("Este cliente não possui telefone cadastrado.");
                return;
              }
              setWhatsAberto(true);
            }}
          >
            <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const r = await gerarLink({ data: { curriculoId: id } });
                const url = urlPublica(r.url);
                setLinkGerado({ url, expiraEm: r.expiraEm });
                await navigator.clipboard?.writeText(url).catch(() => undefined);
                toast.success("Link gerado e copiado.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Não foi possível gerar o link.");
              }
            }}
          >
            <Link2 className="mr-1 h-4 w-4" /> Gerar link
          </Button>
        </div>
      </div>

      {linkGerado && (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <span className="font-medium">Link válido até {dataHoraBR(linkGerado.expiraEm)}</span>
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{linkGerado.url}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(linkGerado.url);
                toast.success("Link copiado.");
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copiar
            </Button>
          </CardContent>
        </Card>
      )}

      {modoEdicao ? (
        <FormularioCurriculo
          dados={dados}
          catalogoHabilidades={data.catalogo}
          objetivosSugeridos={data.objetivos}
          modo="admin"
          salvar={salvarEtapa}
          criarHabilidade={async (descricao) => {
            const { data: existente } = await supabase
              .from("habilidades_curriculo")
              .select("id, descricao")
              .ilike("descricao", descricao.trim())
              .maybeSingle();
            if (existente) return existente;
            const { data: nova, error } = await supabase
              .from("habilidades_curriculo")
              .insert({ descricao: descricao.trim(), ordem: 99 })
              .select("id, descricao")
              .single();
            if (error) return null;
            return nova;
          }}
          onFinalizado={() => setModoEdicao(false)}
        />
      ) : (
        <CurriculoDocumento ref={documentoRef} dados={dados} />
      )}

      <Dialog open={whatsAberto} onOpenChange={setWhatsAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar currículo pelo WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="w-tel">Telefone</Label>
              <Input
                id="w-tel"
                value={telefoneEnvio}
                onChange={(e) => setTelefoneEnvio(formatarTelefone(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="w-msg">Mensagem</Label>
              <Textarea id="w-msg" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              O currículo será enviado em PDF para o número informado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={enviarPorWhatsapp} disabled={enviando}>
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
