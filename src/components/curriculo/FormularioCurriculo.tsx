import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CATEGORIAS_HABILITACAO,
  ESCOLARIDADES,
  ESTADOS_CIVIS,
  capitalizarTexto,
  escolaridadeTemCurso,
  escolaridadeTemPos,
  formatarTelefone,
  type CurriculoCompleto,
  type CursoItem,
  type ExperienciaItem,
  type FormacaoItem,
  type HabilidadeItem,
  type PayloadEtapa,
} from "@/lib/curriculo";
import { dataBR } from "@/lib/format";

export interface PropsFormularioCurriculo {
  dados: CurriculoCompleto;
  catalogoHabilidades: { id: string; descricao: string }[];
  objetivosSugeridos: { id: string; texto: string }[];
  modo: "admin" | "publico";
  salvar: (payload: PayloadEtapa) => Promise<void>;
  criarHabilidade?: (descricao: string) => Promise<{ id: string; descricao: string } | null>;
  onFinalizado?: () => void;
}

const TITULOS = [
  "Dados pessoais",
  "Documentação",
  "Escolaridade",
  "Cursos complementares",
  "Experiência profissional",
  "Objetivo",
  "Habilidades",
  "Revisão",
];

export function FormularioCurriculo({
  dados,
  catalogoHabilidades,
  objetivosSugeridos,
  modo,
  salvar,
  criarHabilidade,
  onFinalizado,
}: PropsFormularioCurriculo) {
  const c = dados.curriculo;
  const totalEtapas = modo === "admin" ? 8 : 7;

  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Etapa 1
  const [nome, setNome] = useState(c.nome_completo ?? "");
  const [telefone, setTelefone] = useState(formatarTelefone(c.telefone_principal ?? ""));
  const [telefones, setTelefones] = useState<string[]>(
    dados.telefones.map((t) => formatarTelefone(t.telefone)),
  );
  const [nascimento, setNascimento] = useState(c.data_nascimento ?? "");
  const [estadoCivil, setEstadoCivil] = useState(c.estado_civil ?? "");
  const [email, setEmail] = useState(c.email ?? "");
  const [endereco, setEndereco] = useState(c.endereco ?? "");
  const [bairro, setBairro] = useState(c.bairro ?? "");
  const [cidade, setCidade] = useState(c.cidade ?? "");
  const [uf, setUf] = useState(c.uf ?? "");
  const [cep, setCep] = useState(c.cep ?? "");

  // Etapa 2
  const [documentacao, setDocumentacao] = useState<string>(
    c.documentacao_completa === null || c.documentacao_completa === undefined
      ? ""
      : c.documentacao_completa
        ? "sim"
        : "nao",
  );
  const [habilitacao, setHabilitacao] = useState(c.habilitacao);
  const [categoria, setCategoria] = useState(c.categoria_habilitacao ?? "");

  // Etapa 3
  const [escolaridade, setEscolaridade] = useState(c.escolaridade ?? "");
  const [cursoSuperior, setCursoSuperior] = useState(c.curso_superior ?? "");
  const [posGraduacaoNome, setPosGraduacaoNome] = useState(c.pos_graduacao_nome ?? "");
  const [formacoes, setFormacoes] = useState<FormacaoItem[]>(dados.formacoes);

  // Etapa 4
  const [cursos, setCursos] = useState<CursoItem[]>(dados.cursos);

  // Etapa 5
  const [experiencias, setExperiencias] = useState<ExperienciaItem[]>(dados.experiencias);

  // Etapa 6
  const [objetivoTipo, setObjetivoTipo] = useState(c.objetivo_tipo || "nao_informar");
  const [objetivoTexto, setObjetivoTexto] = useState(c.objetivo_texto ?? "");

  // Etapa 7
  const [habilidades, setHabilidades] = useState<HabilidadeItem[]>(dados.habilidades);
  const [catalogo, setCatalogo] = useState(catalogoHabilidades);
  const [novaHabilidade, setNovaHabilidade] = useState("");

  // Etapa 8
  const [exibirData, setExibirData] = useState(c.exibir_data_atualizacao);

  const marcada = (descricao: string) =>
    habilidades.some((h) => h.descricao.toLowerCase() === descricao.toLowerCase());

  const alternarHabilidade = (item: { id: string | null; descricao: string }) => {
    setHabilidades((atual) =>
      marcada(item.descricao)
        ? atual.filter((h) => h.descricao.toLowerCase() !== item.descricao.toLowerCase())
        : [...atual, { habilidade_id: item.id, descricao: item.descricao }],
    );
  };

  const payloadDaEtapa = (n: number): PayloadEtapa => {
    switch (n) {
      case 1:
        return {
          campos: {
            nome_completo: capitalizarTexto(nome),
            telefone_principal: telefone.trim(),
            data_nascimento: nascimento || null,
            estado_civil: estadoCivil || null,
            email: email.trim() || null,
            endereco: capitalizarTexto(endereco) || null,
            bairro: capitalizarTexto(bairro) || null,
            cidade: capitalizarTexto(cidade) || null,
            uf: uf.toUpperCase() || null,
            cep: cep.trim() || null,
          },
          telefones: telefones.filter((t) => t.trim()).map((t) => ({ telefone: t.trim() })),
        };
      case 2:
        return {
          campos: {
            documentacao_completa: documentacao === "" ? null : documentacao === "sim",
            habilitacao,
            categoria_habilitacao: habilitacao ? categoria || null : null,
          },
        };
      case 3:
        return {
          campos: {
            escolaridade: escolaridade || null,
            curso_superior: escolaridadeTemCurso(escolaridade) ? capitalizarTexto(cursoSuperior) || null : null,
            pos_graduacao_nome: escolaridadeTemPos(escolaridade) ? capitalizarTexto(posGraduacaoNome) || null : null,
          },
          formacoes: formacoes.map((f) => ({
            nome_curso: capitalizarTexto(f.nome_curso),
            instituicao: capitalizarTexto(f.instituicao ?? "") || null,
            ano: f.ano?.trim() || null,
          })),
        };
      case 4:
        return {
          cursos: cursos.map((cur) => ({
            nome_curso: capitalizarTexto(cur.nome_curso),
            instituicao: capitalizarTexto(cur.instituicao ?? "") || null,
            ano: cur.ano?.trim() || null,
          })),
        };
      case 5:
        return {
          experiencias: experiencias.map((exp) => ({
            empresa: capitalizarTexto(exp.empresa ?? "") || null,
            cargo: capitalizarTexto(exp.cargo ?? "") || null,
            periodo: exp.periodo?.trim() || null,
            atividades: exp.atividades?.trim() || null,
          })),
        };
      case 6:
        return {
          campos: {
            objetivo_tipo: objetivoTipo as "sugerido" | "personalizado" | "nao_informar",
            objetivo_texto: objetivoTipo === "nao_informar" ? null : objetivoTexto.trim() || null,
          },
        };
      case 7:
        return { habilidades };
      default:
        return { campos: { exibir_data_atualizacao: exibirData } };
    }
  };

  const validarEtapa = (n: number) => {
    if (n === 1) {
      if (!nome.trim()) return "Informe o nome completo.";
      if (telefone.replace(/\D/g, "").length < 10) return "Informe um telefone válido.";
    }
    if (n === 2 && habilitacao && !categoria) return "Selecione a categoria da habilitação.";
    if (n === 6 && objetivoTipo !== "nao_informar" && !objetivoTexto.trim())
      return "Informe o objetivo ou escolha “Não informar”.";
    return null;
  };

  const gravar = async (n: number, extra?: PayloadEtapa) => {
    const erro = validarEtapa(n);
    if (erro) {
      toast.error(erro);
      return false;
    }
    setSalvando(true);
    try {
      await salvar({ ...payloadDaEtapa(n), ...extra });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const avancar = async () => {
    if (!(await gravar(etapa))) return;
    if (etapa < totalEtapas) setEtapa(etapa + 1);
  };

  const concluir = async () => {
    const ok = await gravar(modo === "admin" ? 8 : 7, {
      campos: { exibir_data_atualizacao: exibirData },
      finalizar: true,
    });
    if (ok) {
      toast.success("Currículo salvo com sucesso.");
      onFinalizado?.();
    }
  };

  const progresso = useMemo(() => Math.round((etapa / totalEtapas) * 100), [etapa, totalEtapas]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm font-medium">
          <span>
            Etapa {etapa} de {totalEtapas} — {TITULOS[etapa - 1]}
          </span>
          <span className="text-muted-foreground">{progresso}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {etapa === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tel">Telefone principal *</Label>
                  <Input
                    id="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nasc">Data de nascimento</Label>
                  <Input
                    id="nasc"
                    type="date"
                    value={nascimento}
                    onChange={(e) => setNascimento(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Estado civil</Label>
                  <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_CIVIS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="uf">UF</Label>
                  <Input
                    id="uf"
                    value={uf}
                    onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="EX"
                    className="max-w-[80px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Telefones adicionais</Label>
                {telefones.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={t}
                      onChange={(e) =>
                        setTelefones((a) =>
                          a.map((v, j) => (j === i ? formatarTelefone(e.target.value) : v)),
                        )
                      }
                      placeholder="(00) 00000-0000"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTelefones((a) => a.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="default" size="sm" onClick={() => setTelefones((a) => [...a, ""])}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar telefone
                </Button>
              </div>
            </>
          )}

          {etapa === 2 && (
            <>
              <div>
                <Label>Possui documentação completa?</Label>
                <RadioGroup value={documentacao} onValueChange={setDocumentacao} className="mt-2 flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="sim" /> Sim
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="nao" /> Não
                  </label>
                </RadioGroup>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={habilitacao} onCheckedChange={setHabilitacao} id="hab" />
                <Label htmlFor="hab">Possui habilitação</Label>
              </div>
              {habilitacao && (
                <div className="max-w-[200px]">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_HABILITACAO.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {etapa === 3 && (
            <>
              <div>
                <Label>Escolaridade</Label>
                <Select value={escolaridade} onValueChange={setEscolaridade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCOLARIDADES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {escolaridadeTemCurso(escolaridade) && !escolaridadeTemPos(escolaridade) && (
                <div>
                  <Label htmlFor="curso">Curso superior</Label>
                  <Input
                    id="curso"
                    value={cursoSuperior}
                    onChange={(e) => setCursoSuperior(e.target.value)}
                    placeholder="Ex.: Administração"
                  />
                </div>
              )}
              {escolaridadeTemPos(escolaridade) && (
                <div>
                  <Label htmlFor="pos">Nome da pós-graduação</Label>
                  <Input
                    id="pos"
                    value={posGraduacaoNome}
                    onChange={(e) => setPosGraduacaoNome(e.target.value)}
                    placeholder="Ex.: MBA em Gestão Empresarial"
                  />
                </div>
              )}
              {escolaridadeTemCurso(escolaridade) && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Outras graduações (opcional)</Label>
                  {listaFormacoes.map((f, i) => (
                    <div
                      key={i}
                      className={`space-y-2 rounded-lg border p-3 ${
                        (f.nivel ?? "").trim() ? "border-primary/40 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label>Escolaridade</Label>
                          <Select
                            value={f.nivel ?? ""}
                            onValueChange={(v) => atualizarFormacao(i, { nivel: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {NIVEIS_FORMACAO.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {i < formacoes.length && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setFormacoes((a) => a.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {(f.nivel ?? "").trim() && (
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_100px]">
                          <div>
                            <Label>Nome do curso</Label>
                            <Input
                              value={f.nome_curso}
                              onChange={(e) => atualizarFormacao(i, { nome_curso: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Instituição</Label>
                            <Input
                              value={f.instituicao ?? ""}
                              onChange={(e) => atualizarFormacao(i, { instituicao: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Ano</Label>
                            <Input
                              value={f.ano ?? ""}
                              onChange={(e) => atualizarFormacao(i, { ano: e.target.value })}
                              placeholder="2024"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {etapa === 4 && (
            <div className="space-y-3">
              {cursos.map((curso, i) => (
                <div
                  key={i}
                  className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_100px_auto] ${
                    curso.nome_curso.trim() ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <div>
                    <Label>Curso *</Label>
                    <Input
                      value={curso.nome_curso}
                      onChange={(e) =>
                        setCursos((a) =>
                          a.map((v, j) => (j === i ? { ...v, nome_curso: e.target.value } : v)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Instituição</Label>
                    <Input
                      value={curso.instituicao ?? ""}
                      onChange={(e) =>
                        setCursos((a) =>
                          a.map((v, j) => (j === i ? { ...v, instituicao: e.target.value } : v)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label>Ano</Label>
                    <Input
                      value={curso.ano ?? ""}
                      onChange={(e) =>
                        setCursos((a) =>
                          a.map((v, j) => (j === i ? { ...v, ano: e.target.value } : v)),
                        )
                      }
                      placeholder="2024"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="self-end"
                    onClick={() => setCursos((a) => a.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="default"
                size="sm"
                onClick={() => setCursos((a) => [...a, { nome_curso: "", instituicao: "", ano: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar curso
              </Button>
              {cursos.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum curso informado.</p>
              )}
            </div>
          )}

          {etapa === 5 && (
            <div className="space-y-3">
              {experiencias.map((exp, i) => (
                <div
                  key={i}
                  className={`space-y-2 rounded-lg border p-3 ${
                    exp.empresa?.trim() ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <Label>Empresa</Label>
                      <Input
                        value={exp.empresa ?? ""}
                        onChange={(e) =>
                          setExperiencias((a) =>
                            a.map((v, j) => (j === i ? { ...v, empresa: e.target.value } : v)),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Cargo</Label>
                      <Input
                        value={exp.cargo ?? ""}
                        onChange={(e) =>
                          setExperiencias((a) =>
                            a.map((v, j) => (j === i ? { ...v, cargo: e.target.value } : v)),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Período</Label>
                      <Input
                        value={exp.periodo ?? ""}
                        placeholder="Ex.: 01/2022 a 05/2024 ou 2 anos"
                        onChange={(e) =>
                          setExperiencias((a) =>
                            a.map((v, j) => (j === i ? { ...v, periodo: e.target.value } : v)),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Atividades</Label>
                    <Textarea
                      rows={3}
                      value={exp.atividades ?? ""}
                      onChange={(e) =>
                        setExperiencias((a) =>
                          a.map((v, j) => (j === i ? { ...v, atividades: e.target.value } : v)),
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExperiencias((a) => a.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remover
                  </Button>
                </div>
              ))}
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  setExperiencias((a) => [
                    ...a,
                    { empresa: "", cargo: "", periodo: "", atividades: "" },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar experiência
              </Button>
              {experiencias.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma experiência informada.</p>
              )}
            </div>
          )}

          {etapa === 6 && (
            <>
              <RadioGroup value={objetivoTipo} onValueChange={setObjetivoTipo} className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="sugerido" /> Escolher objetivo sugerido
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="personalizado" /> Escrever objetivo personalizado
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="nao_informar" /> Não informar
                </label>
              </RadioGroup>

              {objetivoTipo === "sugerido" && (
                <div className="space-y-2">
                  {objetivosSugeridos.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setObjetivoTexto(o.texto)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                        objetivoTexto === o.texto ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                    >
                      {o.texto}
                    </button>
                  ))}
                </div>
              )}

              {objetivoTipo === "personalizado" && (
                <Textarea
                  rows={4}
                  value={objetivoTexto}
                  onChange={(e) => setObjetivoTexto(e.target.value)}
                  placeholder="Descreva o objetivo profissional"
                />
              )}
            </>
          )}

          {etapa === 7 && (
            <div className="space-y-3">
              {catalogo.map((h) => (
                <label key={h.id} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={marcada(h.descricao)}
                    onCheckedChange={() => alternarHabilidade({ id: h.id, descricao: h.descricao })}
                  />
                  <span>{h.descricao}</span>
                </label>
              ))}

              {habilidades
                .filter((h) => !catalogo.some((c2) => c2.descricao.toLowerCase() === h.descricao.toLowerCase()))
                .map((h, i) => (
                  <label key={`extra-${i}`} className="flex items-start gap-3 text-sm">
                    <Checkbox checked onCheckedChange={() => alternarHabilidade({ id: null, descricao: h.descricao })} />
                    <span>{h.descricao}</span>
                  </label>
                ))}

              <div className="flex gap-2 pt-2">
                <Input
                  value={novaHabilidade}
                  onChange={(e) => setNovaHabilidade(e.target.value)}
                  placeholder="Nova habilidade"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const texto = novaHabilidade.trim();
                    if (!texto) return;
                    if (marcada(texto)) {
                      setNovaHabilidade("");
                      return;
                    }
                    let id: string | null = null;
                    if (criarHabilidade) {
                      const criada = await criarHabilidade(texto);
                      if (criada) {
                        id = criada.id;
                        setCatalogo((a) =>
                          a.some((x) => x.id === criada.id) ? a : [...a, criada],
                        );
                      }
                    }
                    setHabilidades((a) => [...a, { habilidade_id: id, descricao: texto }]);
                    setNovaHabilidade("");
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>
          )}

          {etapa === 8 && (
            <div className="space-y-4 text-sm">
              <ResumoLinha titulo="Dados pessoais" etapa={1} ir={setEtapa}>
                <p>{nome || "-"}</p>
                <p className="text-muted-foreground">
                  {[telefone, ...telefones].filter(Boolean).join(" • ")}
                </p>
                <p className="text-muted-foreground">{email || "-"}</p>
                <p className="text-muted-foreground">
                  {[nascimento ? dataBR(nascimento) : "", estadoCivil].filter(Boolean).join(" • ") || "-"}
                </p>
                {(endereco || bairro || cidade || cep) && (
                  <p className="text-muted-foreground">
                    {[endereco, bairro, cidade, uf, cep].filter(Boolean).join(" • ")}
                  </p>
                )}
              </ResumoLinha>

              <ResumoLinha titulo="Documentação" etapa={2} ir={setEtapa}>
                <p>
                  {documentacao === "" ? "Não informado" : documentacao === "sim" ? "Documentação completa" : "Documentação incompleta"}
                </p>
                <p className="text-muted-foreground">
                  {habilitacao ? `Habilitação categoria ${categoria || "-"}` : "Sem habilitação"}
                </p>
              </ResumoLinha>

              <ResumoLinha titulo="Escolaridade" etapa={3} ir={setEtapa}>
                <p>{escolaridade || "-"}</p>
                {escolaridadeTemPos(escolaridade) && posGraduacaoNome && (
                  <p className="text-muted-foreground">{posGraduacaoNome}</p>
                )}
                {escolaridadeTemCurso(escolaridade) && !escolaridadeTemPos(escolaridade) && cursoSuperior && (
                  <p className="text-muted-foreground">{cursoSuperior}</p>
                )}
                {formacoes.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {formacoes.map((f, i) => (
                      <p key={i} className="text-muted-foreground">
                        {f.nome_curso}
                        {f.instituicao ? ` — ${f.instituicao}` : ""}
                        {f.ano ? ` (${f.ano})` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </ResumoLinha>

              <ResumoLinha titulo="Cursos complementares" etapa={4} ir={setEtapa}>
                {cursos.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum</p>
                ) : (
                  cursos.map((x, i) => (
                    <p key={i}>
                      {x.nome_curso}
                      {x.instituicao ? ` — ${x.instituicao}` : ""}
                      {x.ano ? ` (${x.ano})` : ""}
                    </p>
                  ))
                )}
              </ResumoLinha>

              <ResumoLinha titulo="Experiência profissional" etapa={5} ir={setEtapa}>
                {experiencias.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma</p>
                ) : (
                  experiencias.map((x, i) => (
                    <p key={i}>{[x.empresa, x.cargo, x.periodo].filter(Boolean).join(" — ")}</p>
                  ))
                )}
              </ResumoLinha>

              <ResumoLinha titulo="Objetivo" etapa={6} ir={setEtapa}>
                <p>{objetivoTipo === "nao_informar" ? "Não informado" : objetivoTexto || "-"}</p>
              </ResumoLinha>

              <ResumoLinha titulo="Habilidades" etapa={7} ir={setEtapa}>
                {habilidades.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma</p>
                ) : (
                  habilidades.map((h, i) => <p key={i}>{h.descricao}</p>)
                )}
              </ResumoLinha>

              <div className="flex items-center gap-3 border-t pt-4">
                <Switch id="exibir-data" checked={exibirData} onCheckedChange={setExibirData} />
                <Label htmlFor="exibir-data">Exibir data da última atualização no currículo</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setEtapa((e) => Math.max(1, e - 1))}
          disabled={etapa === 1 || salvando}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>

        {origemRevisao && etapa < totalEtapas ? (
          <Button onClick={voltarParaRevisao} disabled={salvando}>
            <Save className="mr-1 h-4 w-4" /> Salvar e voltar à revisão
          </Button>
        ) : etapa < totalEtapas ? (
          <Button onClick={avancar} disabled={salvando}>
            Avançar <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={concluir} disabled={salvando}>
            <Save className="mr-1 h-4 w-4" /> Salvar currículo
          </Button>
        )}
      </div>
    </div>
  );
}

function ResumoLinha({
  titulo,
  etapa,
  ir,
  children,
}: {
  titulo: string;
  etapa: number;
  ir: (n: number) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-semibold">{titulo}</p>
        <Button variant="ghost" size="sm" onClick={() => ir(etapa)}>
          Editar
        </Button>
      </div>
      {children}
    </div>
  );
}
