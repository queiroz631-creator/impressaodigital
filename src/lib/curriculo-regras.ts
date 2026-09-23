/**
 * Preenchimento de currículo por regras — sem IA e sem rede.
 *
 * Reconhece três famílias de informação no texto já extraído do arquivo:
 * 1) formatos fixos: CPF, telefone, e-mail, CEP, data de nascimento;
 * 2) palavras known: estado civil, escolaridade, categoria da CNH;
 * 3) rótulos e títulos: "Bairro:", "Cidade:", bloco abaixo de
 *    "Experiência profissional", "Cursos" e "Habilidades".
 *
 * Devolve exatamente a mesma estrutura que a IA devolve, então o resto do
 * fluxo (mesclagem, resumo, gravação) não muda. O que a regra não tem
 * certeza vai para `confiancaBaixa`, exibido como "precisa ser verificada".
 */

import {
  CATEGORIAS_HABILITACAO,
  ESCOLARIDADES,
  ESTADOS_CIVIS,
  capitalizarTexto,
  cpfValido,
  formatarTelefone,
  somenteNumeros,
} from "@/lib/curriculo";
import type { CurriculoImportado } from "@/lib/curriculo-import-tipos";

/* ------------------------------------------------------------------ */
/* Utilidades de texto                                                 */
/* ------------------------------------------------------------------ */

function semAcento(v: string) {
  return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Minúsculas e sem acento, podendo mudar o tamanho da string. */
function chave(v: string) {
  return semAcento(v).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Como `chave`, mas um caractere por caractere — permite fatiar a original. */
function chavePar(v: string) {
  return Array.from(v)
    .map((c) => {
      const d = c.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      return d.length === 1 ? d.toLowerCase() : c.toLowerCase();
    })
    .join("");
}

/** "nome_completo" e "Nome completo" viram a mesma chave (deduplicação). */
function chaveUnica(v: string) {
  return chave(v).replace(/[^a-z0-9]/g, "");
}

function preenchido(v: string | null | undefined) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Linhas despojad as, com no máximo uma linha em branco consecutiva. */
function prepararLinhas(texto: string): string[] {
  const brutas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const saida: string[] = [];
  for (const l of brutas) {
    if (!l) {
      if (saida.length && saida[saida.length - 1] !== "") saida.push("");
      continue;
    }
    saida.push(l);
  }
  return saida;
}

/**
 * Encontra as ocorrências de `re` cuja validação passou, devolvendo os
 * valores e o texto com essas ocorrências cobertas por "§" (mesmo tamanho),
 * para que a próxima busca não as confunda com outro dado.
 */
function capturar(
  texto: string,
  re: RegExp,
  valido: (m: string) => boolean,
): { vals: string[]; restante: string } {
  const vals: string[] = [];
  const partes: string[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(new RegExp(re.source, "g"))) {
    const ini = m.index ?? 0;
    if (!valido(m[0])) continue;
    vals.push(m[0]);
    partes.push(texto.slice(ultimo, ini), "§".repeat(m[0].length));
    ultimo = ini + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return { vals, restante: partes.join("") };
}

/* ------------------------------------------------------------------ */
/* Títulos de seção                                                    */
/* ------------------------------------------------------------------ */

type Secao = "experiencias" | "cursos" | "habilidades" | "formacoes" | "objetivo";

const TITULOS: Record<Secao, string[]> = {
  experiencias: [
    "experiencia profissional",
    "experiencias profissionais",
    "historico profissional",
    "experiencia de trabalho",
    "trajetoria profissional",
    "atuacao profissional",
    "experiencia anterior",
    "experiencia",
  ],
  cursos: [
    "cursos complementares",
    "cursos e qualificacoes",
    "cursos extracurriculares",
    "qualificacoes profissionais",
    "cursos realizados",
    "cursos",
    "qualificacoes",
  ],
  habilidades: [
    "habilidades tecnicas",
    "habilidades e competencias",
    "competencias tecnicas",
    "conhecimentos especificos",
    "conhecimentos",
    "habilidades pessoais",
    "habilidades",
    "competencias",
    "skills",
  ],
  formacoes: [
    "formacao academica",
    "formacao escolar",
    "formacao educacional",
    "formacao profissional",
    "formacao",
    "educacao",
    "escolaridade",
    "instrucao",
  ],
  objetivo: ["objetivo profissional", "objetivo", "pretensao", "finalidade"],
};

const TODOS_TITULOS = Object.values(TITULOS).flat();

/** Linha curta, sem pontuação final e sem marcador de lista, parecendo título. */
function ehTitulo(linha: string, titulos: string[]) {
  if (!linha || linha.length > 45) return false;
  if (/^[-•*\u2022]/.test(linha) || /[.,;]$/.test(linha)) return false;
  const k = chave(linha).replace(/[:\-.]+$/g, "").trim();
  if (!k) return false;
  const podeSerTitulo =
    /^[\dA-ZÀ-Ú\s&]+$/.test(linha) || linha.includes(":") || k.split(" ").length <= 4;
  if (!podeSerTitulo) return false;
  return titulos.some((t) => k === t || k.startsWith(`${t} `));
}

function blocoDaSecao(linhas: string[], secao: Secao): string[] {
  const inicio = linhas.findIndex((l) => ehTitulo(l, TITULOS[secao]));
  if (inicio < 0) return [];
  const saida: string[] = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (ehTitulo(l, TODOS_TITULOS)) break;
    saida.push(l);
    if (saida.length > 200) break;
  }
  while (saida.length && !saida[saida.length - 1]) saida.pop();
  return saida;
}

/* ------------------------------------------------------------------ */
/* Formatos fixos                                                      */
/* ------------------------------------------------------------------ */

const RE_CPF = /\b\d{3}\.\d{3}\.\d{3}-?\d{2}\b|\b\d{11}\b/g;
const RE_TELEFONE = /\(\d{2}\)\s*\d{4,5}-?\d{4}\b|\b\d{2}[\s.\-]\d{4,5}-?\d{4}\b/g;
const RE_DATA = /\b\d{2}[\/\-.]\d{2}[\/\-.]\d{4}\b/g;
const RE_CEP = /\b\d{5}-?\d{3}\b/g;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

const DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "41", "42", "43", "44", "45", "46", "47", "48",
  "49", "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87", "88",
  "89", "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

function telefoneValido(bruto: string) {
  const n = somenteNumeros(bruto);
  if (n.length !== 10 && n.length !== 11) return false;
  if (!DDDS.has(n.slice(0, 2))) return false;
  if (/^(\d)\1+$/.test(n)) return false;
  if (n.length === 11 && n[2] !== "9") return false;
  return true;
}

function dataPlausivel(bruto: string) {
  const n = somenteNumeros(bruto);
  if (n.length !== 8) return false;
  const d = Number(n.slice(0, 2));
  const m = Number(n.slice(2, 4));
  const a = Number(n.slice(4));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (a < 1900 || a > new Date().getFullYear()) return false;
  return true;
}

/** Data de nascimento: DD/MM/AAAA plausível, com preferência pela linha rotulada. */
function acharNascimento(
  linhas: string[],
  k: string[],
  restante: string,
  verificar: Set<string>,
): string {
  const paraData = (bruto: string) => {
    const n = somenteNumeros(bruto);
    return `${n.slice(4)}-${n.slice(2, 4)}-${n.slice(0, 2)}`;
  };
  const idadeSuficiente = (iso: string) => {
    const ano = Number(iso.slice(0, 4));
    return ano > 1900 && ano <= new Date().getFullYear() - 14;
  };

  for (let i = 0; i < k.length; i++) {
    if (!/nasc|nascimento|data de nac/.test(k[i])) continue;
    const alvo = [linhas[i], linhas[i + 1] ?? "", linhas[i + 2] ?? ""].join(" ");
    const m = RE_DATA.exec(alvo);
    if (m && dataPlausivel(m[0])) {
      const iso = paraData(m[0]);
      if (idadeSuficiente(iso)) return iso;
    }
  }

  for (const m of restante.matchAll(new RegExp(RE_DATA.source, "g"))) {
    if (!m[0] || !dataPlausivel(m[0])) continue;
    const iso = paraData(m[0]);
    if (idadeSuficiente(iso)) {
      verificar.add("Data de nascimento");
      return iso;
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Palavras conhecidas                                                 */
/* ------------------------------------------------------------------ */

const CIVIS: [RegExp, string][] = [
  [/uniao\s+estavel/, "União estável"],
  [/divorciad/, "Divorciado(a)"],
  [/solteir/, "Solteiro(a)"],
  [/casad/, "Casado(a)"],
  [/viuv/, "Viúvo(a)"],
];

function acharEstadoCivil(texto: string): string {
  const t = chave(texto);
  for (const [re, valor] of CIVIS) if (re.test(t)) return valor;
  return "";
}

const NIVEIS: [RegExp, string][] = [
  [/(ensino\s+)?(medio|médio)\b|2[º°]?\s*grau|segundo\s*grau/, "Ensino Médio"],
  [/fundamental|1[º°]?\s*grau|primeiro\s*grau/, "Ensino Fundamental"],
  [/superior|gradua(?:cao|ção)|faculdade|universidade/, "Ensino Superior"],
];

/** Escolaridade dentro da lista do sistema, ou "" quando não identificada. */
function acharEscolaridade(texto: string): string {
  const t = chave(texto);

  if (/pos[\s\-]?graduac|especializa(?:cao|ção)|mestrado|doutorado/.test(t))
    return "Pós-graduação";

  let nivel = "";
  let melhor = Infinity;
  for (const [re, base] of NIVEIS) {
    const m = re.exec(t);
    if (m && m.index < melhor) {
      melhor = m.index;
      nivel = base;
    }
  }
  if (!nivel) return "";

  // "incompleto" contém "completo": precisa ser testado antes.
  const janela = t.slice(melhor, melhor + 90);
  const situacao = /incomplet|trancad|abandonad|parcial/.test(janela)
    ? "Incompleto"
    : /cursando|em\s+andamento|em\s+curso|cursando/.test(janela)
      ? "Cursando"
      : /complet|conclu|formato|formado|colacao/.test(janela)
        ? "Completo"
        : "";
  if (!situacao) return "";

  const candidato = `${nivel} ${situacao}`;
  return ESCOLARIDADES.includes(candidato) ? candidato : "";
}

/** Categoria da CNH reconhecida no texto ("" quando não há). */
function acharCategoriaCnh(texto: string): string {
  const t = chave(texto);
  const re = /(?:categoria|cnh|habilita(?:cao|ção))[^a-z0-9]{0,12}?\b(a|b|c|d|e|ab|ac|ad|ae)\b/g;
  for (const m of t.matchAll(new RegExp(re.source, "g"))) {
    const c = (m[1] ?? "").toUpperCase();
    if (CATEGORIAS_HABILITACAO.includes(c)) return c;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Rótulos                                                             */
/* ------------------------------------------------------------------ */

/**
 * Valor escrito depois de um rótulo no início da linha ("Bairro: Centro"),
 * ou na linha seguinte quando a linha do rótulo está vazia.
 */
function valorPorRotulo(linhas: string[], k: string[], nomes: string[]): string {
  for (let i = 0; i < k.length; i++) {
    const linha = k[i];
    if (!linha) continue;
    for (const n of nomes) {
      if (!linha.startsWith(n)) continue;
      const resto = linha.slice(n.length);
      if (resto && !/^[:\-\u2013\u2014\s/.]/.test(resto)) continue;
      const corte = n.length;
      const original = (linhas[i] ?? "").slice(corte).replace(/^[:\-\u2013\u2014\s/.]+/, "");
      if (original.trim()) return original.trim();
      for (let j = i + 1; j <= Math.min(i + 2, linhas.length - 1); j++) {
        if (linhas[j] && !ehTitulo(linhas[j], TODOS_TITULOS)) return linhas[j].trim();
      }
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Nome                                                                */
/* ------------------------------------------------------------------ */

const PALAVRAS_NAO_NOME =
  /^(?:curr(?:i|í)culo|resumo|dados|objetivo|experiencia|formacao|curso|habilidade|competencia|endereco|bairro|cidade|estado|telefone|contato|email|e-mail|cpf|rg|cnh|nascimento|solteiro|casado|brasil|brasileiro|brasileira|vaga|area|perfil|apresentacao|sobre|informacoes|profissional|atual|pretencao|remuneracao|disponibilidade)/;

function pareceNome(linha: string): boolean {
  const k = chave(linha);
  if (!k || k.length > 60) return false;
  if (/[0-9@]/.test(linha)) return false;
  if (/[:;]/.test(linha)) return false;
  const partes = linha.trim().split(/\s+/);
  if (partes.length < 2 || partes.length > 6) return false;
  if (!/^[A-Za-zÀ-ÿ'.\s-]+$/.test(linha)) return false;
  if (PALAVRAS_NAO_NOME.test(k)) return false;
  return partes.every((p) => /[A-Za-zÀ-ÿ]/.test(p));
}

function acharNome(linhas: string[], k: string[], verificar: Set<string>): string {
  const rotulado = valorPorRotulo(linhas, k, ["nome completo", "nome", "nome do candidato"]);
  if (rotulado && pareceNome(rotulado)) return capitalizarTexto(rotulado);

  let vistas = 0;
  for (const l of linhas) {
    if (!l) continue;
    vistas += 1;
    if (vistas > 18) break;
    if (pareceNome(l)) {
      verificar.add("Nome completo");
      return capitalizarTexto(l);
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Blocos: experiências, cursos, habilidades                          */
/* ------------------------------------------------------------------ */

const RE_PERIODOS =
  /(\d{1,2}\/\d{2,4}|\d{4})\s*(?:a|ao|-|–|—|até|to)\s*(\d{1,2}\/\d{2,4}|\d{4}|atual|atualmente|dias|hoje)/i;

function dividirBlocos(linhas: string[]): string[][] {
  const blocos: string[][] = [];
  let atual: string[] = [];
  for (const l of linhas) {
    if (!l) {
      if (atual.length) {
        blocos.push(atual);
        atual = [];
      }
      continue;
    }
    atual.push(l);
  }
  if (atual.length) blocos.push(atual);

  // Documento sem linhas em branco: separa por linha de período novo.
  if (blocos.length <= 1 && atual.length > 4) {
    const porPeriodo: string[][] = [];
    let grupo: string[] = [];
    for (const l of atual) {
      if (RE_PERIODOS.test(l) && grupo.length && grupo.some((g) => RE_PERIODOS.test(g))) {
        porPeriodo.push(grupo);
        grupo = [];
      }
      grupo.push(l);
    }
    if (grupo.length) porPeriodo.push(grupo);
    if (porPeriodo.length > 1) return porPeriodo;
  }
  return blocos;
}

function experienciaDoBloco(b: string[]): CurriculoImportado["experiencias"][number] {
  let periodo = "";
  const resto: string[] = [];
  for (const l of b) {
    const m = RE_PERIODOS.exec(l);
    if (!periodo && m && m[0].length >= l.length - 6) {
      periodo = m[0].trim();
      continue;
    }
    resto.push(l);
  }

  let empresa = "";
  let cargo = "";
  const primeiro = resto[0] ?? "";
  const cortado = primeiro.split(/\s+(?:[-–—|])\s+/);
  if (cortado.length >= 2) {
    empresa = cortado[0].trim();
    cargo = cortado.slice(1).join(" ").trim();
  } else if (resto.length >= 2) {
    empresa = primeiro.trim();
    cargo = resto[1].trim();
  } else {
    empresa = primeiro.trim();
  }

  const atividades = resto.slice(cortado.length >= 2 ? 1 : 2).join(" ").trim();
  return {
    empresa: capitalizarTexto(empresa).slice(0, 200),
    cargo: capitalizarTexto(cargo).slice(0, 200),
    periodo: periodo.slice(0, 120),
    atividades: atividades.replace(/\s+/g, " ").slice(0, 2000),
  };
}

function linhaDoCurso(l: string): CurriculoImportado["cursos"][number] {
  const ano = (l.match(/\b(19|20)\d{2}\b/) ?? [""])[0];
  const partes = l.split(/\s+(?:[-–—|])\s+/);
  const semAno = (t: string) => t.replace(/\b(19|20)\d{2}\b/, "").replace(/\s{2,}/g, " ").trim();
  if (partes.length >= 2) {
    return {
      nome_curso: capitalizarTexto(semAno(partes[0])).slice(0, 200),
      instituicao: capitalizarTexto(semAno(partes.slice(1).join(" "))).slice(0, 200),
      ano,
    };
  }
  return {
    nome_curso: capitalizarTexto(semAno(l)).slice(0, 200),
    instituicao: "",
    ano,
  };
}

function limparItemLista(l: string): string {
  return l.replace(/^[-•*\u2022•\s]+/, "").replace(/[;.,]+$/, "").trim();
}

/* ------------------------------------------------------------------ */
/* Função principal                                                    */
/* ------------------------------------------------------------------ */

export function extrairPorRegras(texto: string): CurriculoImportado {
  const linhas = prepararLinhas(texto);
  const k = linhas.map(chavePar);
  const verificar = new Set<string>();

  const cpf = capturar(texto, RE_CPF, (m) => cpfValido(somenteNumeros(m)));
  const tel = capturar(restanteDe(cpf.restante), RE_TELEFONE, telefoneValido);
  const nasc = acharNascimento(linhas, k, tel.restante, verificar);
  const dat = capturar(tel.restante, RE_DATA, dataPlausivel);
  const cep = capturar(dat.restante, RE_CEP, () => true);

  const emails = texto.match(new RegExp(RE_EMAIL.source, "g")) ?? [];
  const email = (emails[0] ?? "").toLowerCase();

  // Telefone principal: o de uma linha que menciona celular/WhatsApp/contato.
  const telefones = [...new Set(tel.vals.map((t) => formatarTelefone(t)))];
  let telefonePrincipal = telefones[0] ?? "";
  for (let i = 0; i < linhas.length; i++) {
    if (!/celular|whatsapp|zap|cel\b|contato|principal|telefone/.test(k[i])) continue;
    const daLinha = [...(linhas[i].match(new RegExp(RE_TELEFONE.source, "g")) ?? [])]
      .filter(telefoneValido)
      .map((t) => formatarTelefone(t));
    if (daLinha.length) {
      telefonePrincipal = daLinha[0];
      break;
    }
  }

  const escolaridade = acharEscolaridade(texto);
  const categoria = acharCategoriaCnh(texto);
  const estadoCivil = acharEstadoCivil(texto);

  const endereco = valorPorRotulo(linhas, k, [
    "endereco",
    "rua",
    "logradouro",
    "alameda",
    "avenida",
    "av",
    "travessa",
    "praca",
    "rodovia",
  ]);
  const numero = valorPorRotulo(linhas, k, ["numero", "nº", "n", "num"]);
  const bairro = valorPorRotulo(linhas, k, ["bairro", "setor"]);
  const cidade = valorPorRotulo(linhas, k, ["cidade", "municipio", "localidade"]);
  const uf = valorPorRotulo(linhas, k, ["uf", "estado"]).match(/^[A-Za-z]{2}/)?.[0].toUpperCase() ?? "";
  const objetivo = valorPorRotulo(linhas, k, ["objetivo", "pretensao", "finalidade"]);
  const cursoSuperior = valorPorRotulo(linhas, k, ["curso superior", "graduacao"]);
  const posNome = valorPorRotulo(linhas, k, [
    "pos-graduacao",
    "pos graduacao",
    "especializacao",
    "mestrado",
    "doutorado",
  ]);

  // "Londrina - PR" / "Londrina/PR" quando cidade e UF não vieram rotuladas.
  let cidadeFinal = capitalizarTexto(cidade).slice(0, 120);
  let ufFinal = uf;
  if (!cidadeFinal || !ufFinal) {
    for (const l of linhas) {
      const m = /([A-ZÀ-Ú][a-zà-ú]{2,})\s*[/\-–]\s*([A-Z]{2})\b/.exec(l);
      if (m && !ehTitulo(l, TODOS_TITULOS)) {
        if (!cidadeFinal) cidadeFinal = capitalizarTexto(m[1]).slice(0, 120);
        if (!ufFinal) ufFinal = m[2];
        verificar.add("Cidade");
        break;
      }
    }
  }

  const blocoExp = blocoDaSecao(linhas, "experiencias");
  const experiencias = dividirBlocos(blocoExp)
    .map(experienciaDoBloco)
    .filter((e) => e.empresa || e.cargo);
  if (experiencias.some((e) => !e.cargo)) verificar.add("Experiência profissional");

  const blocoCur = blocoDaSecao(linhas, "cursos").filter((l) => l);
  const cursos = blocoCur
    .map((l) => linhaDoCurso(limparItemLista(l)))
    .filter((c) => c.nome_curso.length > 3)
    .slice(0, 30);

  const blocoFor = blocoDaSecao(linhas, "formacoes").filter((l) => l);
  const formacoes = blocoFor
    .map((l) => ({ ...linhaDoCurso(limparItemLista(l)), nivel: acharEscolaridade(l) }))
    .filter((f) => f.nome_curso.length > 3)
    .slice(0, 30);

  const blocoHab = blocoDaSecao(linhas, "habilidades").filter((l) => l);
  const habilidades = blocoHab
    .flatMap((l) => {
      const limpo = limparItemLista(l);
      if (!limpo) return [];
      return limpo.includes(",") && limpo.split(",").length > 2
        ? limpo.split(",").map((p) => p.trim())
        : [limpo];
    })
    .map((h) => h.replace(/\s+/g, " ").trim())
    .filter((h) => h.length > 2 && h.length <= 60)
    .slice(0, 40);

  const documentacao = /documenta(?:cao|ção)\s+incompleta/.test(chave(texto))
    ? false
    : /documenta(?:cao|ção)\s+completa/.test(chave(texto))
      ? true
      : null;

  return {
    campos: {
      nome_completo: acharNome(linhas, k, verificar),
      telefone_principal: telefonePrincipal,
      data_nascimento: nasc,
      estado_civil: estadoCivil,
      email,
      endereco: capitalizarTexto(endereco).slice(0, 200),
      numero: numero.slice(0, 20),
      bairro: capitalizarTexto(bairro).slice(0, 120),
      cidade: cidadeFinal,
      uf: ufFinal,
      cep: cep.vals[0]?.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") ?? "",
      documentacao_completa: documentacao,
      habilitacao: Boolean(categoria) || /cnh|habilita(?:cao|ção)\s+(?:sim|ativa)/.test(chave(texto)),
      categoria_habilitacao: categoria,
      escolaridade,
      curso_superior: capitalizarTexto(cursoSuperior).slice(0, 160),
      pos_graduacao_nome: capitalizarTexto(posNome).slice(0, 200),
      objetivo_texto: objetivo.replace(/\s+/g, " ").slice(0, 1000),
    },
    cpf: cpf.vals.length ? somenteNumeros(cpf.vals[0]) : "",
    telefones,
    cursos,
    formacoes,
    experiencias,
    habilidades,
    confiancaBaixa: [...verificar],
  };
}

/** O próprio texto de entrada é o "restante" inicial. */
function restanteDe(texto: string) {
  return texto;
}

export { chaveUnica };
