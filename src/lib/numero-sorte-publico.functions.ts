import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizarNomePessoa } from "@/lib/nome-pessoa";
import { validarCpf, validarNomeCompleto, normalizarCpf } from "@/modules/sorteios/validations/cliente";

export type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string; mensagem: string };

async function executar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  const { ErroPublico } = await import("./numero-sorte-publico.server");
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    if (e instanceof ErroPublico) return { ok: false, codigo: e.codigo, mensagem: e.message };
    console.error("[numero-sorte-publico]", e);
    return { ok: false, codigo: "ERRO", mensagem: "Não foi possível concluir agora. Tente novamente." };
  }
}

const numeroCampanha = z.object({ numero: z.coerce.number().int().positive().max(999_999_999) });

async function carregarCampanha(numero: number) {
  const { admin, ErroPublico } = await import("./numero-sorte-publico.server");
  const supabase = await admin();
  const { data } = await supabase
    .from("numero_sorte_campanhas")
    .select("id, numero, nome, descricao, banner_path, inicio_em, fim_em, regulamento, condicoes, situacao")
    .eq("numero", numero)
    .maybeSingle();
  if (!data || data.situacao === "rascunho")
    throw new ErroPublico("NAO_ENCONTRADA", "Campanha não encontrada.");
  return data;
}

function aberta(c: { situacao: string; inicio_em: string | null; fim_em: string | null }) {
  const agora = Date.now();
  if (c.situacao !== "ativa") return false;
  if (c.inicio_em && agora < new Date(c.inicio_em).getTime()) return false;
  if (c.fim_em && agora > new Date(c.fim_em).getTime()) return false;
  return true;
}

/**
 * Prêmio do cliente da sessão (titular já verificado por CPF + telefone).
 * Emite o comprovante na primeira vez; depois devolve sempre o mesmo.
 */
async function premioDoCliente(campanhaId: string, clienteId: string) {
  const { admin, urlAssinada } = await import("./numero-sorte-publico.server");
  const supabase = await admin();
  await supabase.rpc("numero_sorte_vencer_premiacoes");
  const { data } = await supabase
    .from("numero_sorte_premiacoes")
    .select("id, situacao, reservado_em, prazo_em, numero_sorte_premios(nome, descricao, imagem_path, condicoes_retirada, local_retirada, instrucoes), numero_sorte_numeros(codigo), numero_sorte_campanhas(nome), clientes(nome)")
    .eq("campanha_id", campanhaId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!data) return null;
  const p = data.numero_sorte_premios;
  let comprovante: { token: string; codigo: string } | null = null;
  if (data.situacao !== "cancelado") {
    const { data: c, error } = await supabase.rpc("numero_sorte_emitir_comprovante", { _premiacao_id: data.id });
    if (error) console.error("[numero-sorte] comprovante", error);
    else comprovante = c as { token: string; codigo: string };
  }
  return {
    nome: p?.nome ?? "",
    descricao: p?.descricao ?? "",
    imagem: await urlAssinada(p?.imagem_path ?? null),
    condicoes: p?.condicoes_retirada ?? "",
    local: p?.local_retirada ?? "",
    instrucoes: p?.instrucoes ?? "",
    numero: data.numero_sorte_numeros?.codigo ?? "",
    campanha: data.numero_sorte_campanhas?.nome ?? "",
    cliente: data.clientes?.nome ?? "",
    situacao: data.situacao,
    reservado_em: data.reservado_em,
    prazo_em: data.prazo_em,
    token: comprovante?.token ?? null,
    codigoRetirada: comprovante?.codigo ?? null,
  };
}

export const obterCampanhaPublica = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => numeroCampanha.parse(d))
  .handler(({ data }) =>
    executar(async () => {
      const { urlAssinada, clienteDaSessao, admin } = await import("./numero-sorte-publico.server");
      const c = await carregarCampanha(data.numero);
      const clienteId = await clienteDaSessao(c.id);
      let participante: { primeiroNome: string } | null = null;
      if (clienteId) {
        const supabase = await admin();
        const { data: cli } = await supabase.from("clientes").select("nome").eq("id", clienteId).maybeSingle();
        participante = { primeiroNome: (cli?.nome ?? "").split(" ")[0] ?? "" };
      }
      return {
        numero: c.numero,
        nome: c.nome,
        descricao: c.descricao,
        regulamento: c.regulamento,
        condicoes: c.condicoes,
        inicio_em: c.inicio_em,
        fim_em: c.fim_em,
        situacao: c.situacao,
        aberta: aberta(c),
        banner: await urlAssinada(c.banner_path),
        participante,
        premio: clienteId ? await premioDoCliente(c.id, clienteId) : null,
      };
    }),
  );

const identificacao = z.object({
  numero: z.coerce.number().int().positive(),
  nome: z.string().trim().max(120).default(""),
  cpf: z.string().trim().max(20),
  telefone: z.string().trim().max(25),
  aceiteRegulamento: z.literal(true),
  aceiteMarketing: z.boolean(),
});

/** Primeiro passo do acesso (igual ao FOTO EXPRESS): reconhece o CPF já cadastrado. */
export const iniciarAcessoNumeroSorte = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ numero: z.coerce.number().int().positive(), cpf: z.string().trim().max(20) }).parse(d))
  .handler(({ data }) =>
    executar(async () => {
      const s = await import("./numero-sorte-publico.server");
      await s.limitarIp("identificar_cpf", 15);
      const c = await carregarCampanha(data.numero);
      if (!aberta(c)) throw new s.ErroPublico("FECHADA", "Esta campanha não está recebendo participações agora.");
      const cpf = normalizarCpf(data.cpf);
      if (!cpf || !validarCpf(cpf).ok) throw new s.ErroPublico("CPF", "CPF inválido.");
      const supabase = await s.admin();
      const { data: cli } = await supabase.from("clientes").select("nome,telefone,telefone_normalizado").eq("cpf", cpf).maybeSingle();
      const tel = s.normalizarTelefone(cli?.telefone_normalizado || cli?.telefone || "");
      const nome = cli?.nome?.trim() || null;
      return { encontrado: !!cli, nome, pedeNome: !nome, telefoneFinal: tel.length >= 4 ? tel.slice(-4) : null };
    }),
  );

export const identificarParticipante = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => identificacao.parse(d))
  .handler(({ data }) =>
    executar(async () => {
      const s = await import("./numero-sorte-publico.server");
      await s.limitarIp("identificar", 10);
      const c = await carregarCampanha(data.numero);
      if (!aberta(c)) throw new s.ErroPublico("FECHADA", "Esta campanha não está recebendo participações agora.");
      const vCpf = validarCpf(data.cpf);
      if (!vCpf.ok) throw new s.ErroPublico("CPF", vCpf.erro!);
      const { data: existente } = await (await s.admin()).from("clientes").select("nome").eq("cpf", normalizarCpf(data.cpf)!).maybeSingle();
      if (existente?.nome?.trim()) data.nome = existente.nome.trim();
      const vNome = validarNomeCompleto(data.nome);
      if (!vNome.ok) throw new s.ErroPublico("NOME", vNome.erro!);
      const tel = s.normalizarTelefone(data.telefone);
      if (tel.length < 10) throw new s.ErroPublico("TELEFONE", "Informe o telefone com DDD.");

      const supabase = await s.admin();
      const { data: clienteId, error } = await supabase.rpc("numero_sorte_identificar_cliente", {
        _nome: normalizarNomePessoa(data.nome),
        _cpf: normalizarCpf(data.cpf)!,
        _telefone: tel,
        _telefone_normalizado: tel,
      });
      if (error || !clienteId) {
        if (error?.message.includes("DADOS_NAO_CONFEREM"))
          throw new s.ErroPublico("DADOS", "Os dados informados não correspondem ao cadastro. Confira o CPF e o telefone.");
        if (error?.message.includes("CPF_INVALIDO")) throw new s.ErroPublico("CPF", "CPF inválido.");
        console.error("[numero-sorte] identificar", error);
        throw new s.ErroPublico("ERRO", "Não foi possível concluir seu cadastro. Tente novamente.");
      }
      await supabase.from("numero_sorte_participacoes").upsert(
        { campanha_id: c.id, cliente_id: clienteId, aceite_marketing: data.aceiteMarketing, ip_hash: s.ipHash() },
        { onConflict: "campanha_id,cliente_id", ignoreDuplicates: true },
      );
      await s.criarSessao(c.id, clienteId);
      return { ok: true };
    }),
  );

const consulta = z.object({
  numero: z.coerce.number().int().positive(),
  codigo: z.string().trim().max(20),
});

export const consultarNumeroSorte = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => consulta.parse(d))
  .handler(({ data }) =>
    executar(async () => {
      const s = await import("./numero-sorte-publico.server");
      await s.limitarIp("consultar", 30);
      const c = await carregarCampanha(data.numero);
      const clienteId = await s.clienteDaSessao(c.id);
      if (!clienteId) throw new s.ErroPublico("SESSAO", "Sua sessão expirou. Informe seus dados novamente.");
      const codigo = data.codigo.replace(/\D/g, "");
      const supabase = await s.admin();
      const { data: r, error } = await supabase.rpc("numero_sorte_consultar", {
        _campanha_id: c.id,
        _cliente_id: clienteId,
        _codigo: codigo,
        _ip_hash: s.ipHash(),
      });
      if (error) {
        console.error("[numero-sorte] consultar", error);
        throw new s.ErroPublico("ERRO", "Não foi possível consultar agora. Tente novamente.");
      }
      const res = r as { resultado: string; restantes?: number };
      const premio =
        res.resultado === "premiado" || res.resultado === "ja_premiado"
          ? await premioDoCliente(c.id, clienteId)
          : null;
      return { resultado: res.resultado, restantes: res.restantes ?? null, premio };
    }),
  );

export const sairNumeroSorte = createServerFn({ method: "POST" }).handler(async () => {
  const { encerrarSessao } = await import("./numero-sorte-publico.server");
  encerrarSessao();
  return { ok: true };
});
