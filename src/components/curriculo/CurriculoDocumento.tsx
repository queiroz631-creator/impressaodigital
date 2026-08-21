import { forwardRef } from "react";
import {
  enderecoCompleto,
  formacaoFinal,
  formatarTelefone,
  informacoesAdicionais,
  objetivoFinal,
  type CurriculoCompleto,
} from "@/lib/curriculo";
import { dataBR } from "@/lib/format";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="cv-secao rounded bg-navy px-3 py-1.5 text-[11pt] font-bold uppercase tracking-wide text-navy-foreground">
        {titulo}
      </h2>
      <div className="mt-2 space-y-1 text-[10.5pt] leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

/** Currículo renderizado no padrão A4 (sem CPF). */
export const CurriculoDocumento = forwardRef<HTMLDivElement, { dados: CurriculoCompleto }>(
  function CurriculoDocumento({ dados }, ref) {
    const c = dados.curriculo;
    const telefones = [
      c.telefone_principal ? formatarTelefone(c.telefone_principal) : "",
      ...dados.telefones.map((t) => formatarTelefone(t.telefone)),
    ].filter(Boolean);

    const pessoais = [
      c.data_nascimento ? `Nascimento: ${dataBR(c.data_nascimento)}` : "",
      c.estado_civil ?? "",
      enderecoCompleto(c),
    ].filter(Boolean);

    const objetivo = objetivoFinal(c);
    const formacao = formacaoFinal(c);
    const adicionais = informacoesAdicionais(c);

    return (
      <div ref={ref} className="mx-auto w-full max-w-[210mm] bg-white p-8 text-foreground shadow-sm">
        <header className="border-b-2 border-navy pb-3">
          <p className="text-[12pt] font-bold uppercase tracking-widest text-navy">Currículo Vitae</p>
          <h1 className="mt-1 text-[18pt] font-bold uppercase leading-tight text-navy">
            {c.nome_completo || "Currículo"}
          </h1>
          {telefones.length > 0 && (
            <p className="mt-1 text-[10.5pt]">{telefones.join("  •  ")}</p>
          )}
          {c.email && <p className="text-[10.5pt]">{c.email}</p>}
        </header>

        {pessoais.length > 0 && (
          <Secao titulo="Dados pessoais">
            {pessoais.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
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

        {(formacao || dados.formacoes.length > 0) && (
          <Secao titulo="Formação">
            {formacao && <p>{formacao}</p>}
            {dados.formacoes.map((f, i) => (
              <p key={i}>
                {[f.nome_curso, f.instituicao, f.ano].filter(Boolean).join(" — ")}
              </p>
            ))}
          </Secao>
        )}

        {dados.cursos.length > 0 && (
          <Secao titulo="Cursos complementares">
            <ul className="list-disc pl-5">
              {dados.cursos.map((curso, i) => (
                <li key={i}>
                  {[curso.nome_curso, curso.instituicao, curso.ano].filter(Boolean).join(" — ")}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {dados.experiencias.length > 0 && (
          <Secao titulo="Experiência profissional">
            {dados.experiencias.map((exp, i) => (
              <div key={i} className="mb-2">
                {exp.empresa && <p className="cv-empresa font-bold text-navy">{exp.empresa}</p>}
                {exp.cargo && <p className="font-medium">{exp.cargo}</p>}
                {exp.periodo && (
                  <p className="text-[9.5pt] text-muted-foreground">Período: {exp.periodo}</p>
                )}
                {exp.atividades && <p className="mt-0.5">{exp.atividades}</p>}
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

        {objetivo && (
          <Secao titulo="Objetivo">
            <p>{objetivo}</p>
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
