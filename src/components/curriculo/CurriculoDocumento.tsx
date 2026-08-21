import { forwardRef } from "react";
import {
  formacaoFinal,
  formatarTelefone,
  informacoesAdicionais,
  objetivoFinal,
  type CurriculoCompleto,
} from "@/lib/curriculo";
import { dataBR } from "@/lib/format";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="border-b-2 border-navy pb-1 text-[11pt] font-bold uppercase tracking-wide text-navy">
        {titulo}
      </h2>
      <div className="mt-2 space-y-1 text-[10.5pt] leading-relaxed">{children}</div>
    </section>
  );
}

/** Currículo renderizado no padrão A4 (sem CPF). */
export const CurriculoDocumento = forwardRef<HTMLDivElement, { dados: CurriculoCompleto }>(
  function CurriculoDocumento({ dados }, ref) {
    const c = dados.curriculo;
    const contatos = [
      c.telefone_principal ? formatarTelefone(c.telefone_principal) : "",
      ...dados.telefones.map((t) => formatarTelefone(t.telefone)),
      c.email ?? "",
    ].filter(Boolean);

    const pessoais = [
      c.data_nascimento ? `Nascimento: ${dataBR(c.data_nascimento)}` : "",
      c.estado_civil ?? "",
    ].filter(Boolean);

    const objetivo = objetivoFinal(c);
    const formacao = formacaoFinal(c);
    const adicionais = informacoesAdicionais(c);

    return (
      <div ref={ref} className="mx-auto w-full max-w-[210mm] bg-white p-8 text-foreground shadow-sm">
        <header>
          <h1 className="text-[20pt] font-bold uppercase leading-tight text-navy">
            {c.nome_completo || "Currículo"}
          </h1>
          {contatos.length > 0 && (
            <p className="mt-1 text-[10.5pt]">{contatos.join("  •  ")}</p>
          )}
          {pessoais.length > 0 && (
            <p className="text-[10.5pt] text-muted-foreground">{pessoais.join("  •  ")}</p>
          )}
        </header>

        {objetivo && <Secao titulo="Objetivo"><p>{objetivo}</p></Secao>}

        {formacao && <Secao titulo="Formação"><p>{formacao}</p></Secao>}

        {dados.cursos.length > 0 && (
          <Secao titulo="Cursos complementares">
            <ul className="list-disc pl-5">
              {dados.cursos.map((curso, i) => (
                <li key={i}>
                  {curso.nome_curso}
                  {curso.instituicao ? ` — ${curso.instituicao}` : ""}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {dados.experiencias.length > 0 && (
          <Secao titulo="Experiência profissional">
            {dados.experiencias.map((exp, i) => (
              <div key={i} className="mb-2">
                <p className="font-semibold">{[exp.empresa, exp.cargo].filter(Boolean).join(" — ")}</p>
                {exp.periodo && <p className="text-[9.5pt] text-muted-foreground">Período: {exp.periodo}</p>}
                {exp.atividades && <p>{exp.atividades}</p>}
              </div>
            ))}
          </Secao>
        )}

        {dados.habilidades.length > 0 && (
          <Secao titulo="Habilidades">
            <ul className="list-disc pl-5">
              {dados.habilidades.map((h, i) => (
                <li key={i}>{h.descricao}</li>
              ))}
            </ul>
          </Secao>
        )}

        {adicionais.length > 0 && (
          <Secao titulo="Informações adicionais">
            <ul className="list-disc pl-5">
              {adicionais.map((linha, i) => (
                <li key={i}>{linha}</li>
              ))}
            </ul>
          </Secao>
        )}

        {c.exibir_data_atualizacao && (
          <p className="mt-6 text-[9pt] italic text-muted-foreground">
            Atualizado em {dataBR(c.updated_at)}
          </p>
        )}
      </div>
    );
  },
);
