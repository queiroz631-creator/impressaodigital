import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginaPrivada } from "@/modules/sorteios/components/publico/PaginaPrivada";
import { obterInformacoesPublicasSorteio } from "@/lib/sorteios-publico.functions";
import { brl, dataBR } from "@/lib/format";

const META_PRIVADA = [
  { title: "Informações do sorteio | Portal de Sorteios" },
  { name: "robots", content: "noindex, nofollow" },
];

export const Route = createFileRoute("/sorteios-publico/informacoes")({
  component: InformacoesPortal,
  head: () => ({ meta: META_PRIVADA }),
});

const SECOES = [
  { chave: "regras", titulo: "Regras" },
  { chave: "como_participar", titulo: "Como participar" },
  { chave: "validade", titulo: "Validade" },
  { chave: "como_sera_realizado", titulo: "Como será realizado" },
  { chave: "informacoes", titulo: "Informações" },
  { chave: "premios", titulo: "Prêmios" },
  { chave: "outras_condicoes", titulo: "Outras condições" },
] as const;

const SITUACAO: Record<string, string> = {
  ATIVO: "Participação aberta",
  ENCERRADO: "Participação encerrada",
  CANCELADO: "Sorteio cancelado",
  SORTEADO: "Sorteio realizado",
};

function InformacoesPortal() {
  const infoFn = useServerFn(obterInformacoesPublicasSorteio);
  const info = useQuery({
    queryKey: ["portal-informacoes"],
    queryFn: () => infoFn({}),
    retry: false,
  });

  return (
    <PaginaPrivada titulo="Informações do sorteio">
      {() =>
        !info.data ? (
          <Skeleton className="h-48 w-full" />
        ) : !info.data.ok ? (
          <p className="text-sm text-muted-foreground">{info.data.mensagem}</p>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-1 text-sm">
                <p className="font-semibold text-foreground">
                  Sorteio nº {info.data.dados.sorteio.numero_sorteio} — {info.data.dados.sorteio.nome}
                </p>
                {info.data.dados.sorteio.descricao && (
                  <p className="text-muted-foreground whitespace-pre-line">
                    {info.data.dados.sorteio.descricao}
                  </p>
                )}
                <p className="text-muted-foreground">
                  Situação: {SITUACAO[info.data.dados.sorteio.status] ?? info.data.dados.sorteio.status}
                </p>
                <p className="text-muted-foreground">
                  Período: {dataBR(info.data.dados.sorteio.data_inicio)} a{" "}
                  {dataBR(info.data.dados.sorteio.data_fim)}
                </p>
                <p className="text-muted-foreground">
                  Data do sorteio: {dataBR(info.data.dados.sorteio.data_sorteio)}
                </p>
                <p className="text-muted-foreground">
                  Valor por cupom: {brl(info.data.dados.sorteio.valor_por_cupom_centavos / 100)}
                </p>
              </CardContent>
            </Card>

            {info.data.dados.premios.length > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="font-semibold">Prêmios</h2>
                  {info.data.dados.premios.map((premio) => (
                    <div key={premio.id}>
                      <p className="text-sm font-medium">
                        {premio.nome}
                        {premio.quantidade > 1 ? ` (${premio.quantidade})` : ""}
                      </p>
                      {premio.descricao && (
                        <p className="text-sm text-muted-foreground">{premio.descricao}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {info.data.dados.termos && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="font-semibold">
                    {info.data.dados.termos.titulo || "Termos e condições"}
                  </h2>
                  {SECOES.map(({ chave, titulo }) => {
                    const texto = (info.data!.dados.termos as unknown as Record<string, string | null>)[
                      chave
                    ];
                    if (!texto?.trim()) return null;
                    return (
                      <section key={chave}>
                        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">
                          {texto}
                        </p>
                      </section>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )
      }
    </PaginaPrivada>
  );
}
