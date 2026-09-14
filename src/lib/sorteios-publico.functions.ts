/**
 * Funções server-side do portal público de Sorteios (Etapa 3).
 *
 * Não usam autenticação de usuário do painel: o participante é identificado
 * por CPF + telefone e mantido em sessão HttpOnly. Todas retornam
 * `Resultado<T>` com mensagens amigáveis — nunca SQL, IDs ou stack traces.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ErroPortal,
  admin,
  auditarPortal,
  carregarSessao,
  criarSessaoParticipante,
  etapaAposIdentificacao,
  garantirParticipacao,
  limitarTentativas,
  mascararCpf,
  obterSorteioAtivo,
  obterTermosAtual,
  periodoAberto,
  revogarSessaoAtual,
  telefoneConfere,
  type SorteioRow,
} from "./sorteios-publico.server";
import { EVENTOS_AUDITORIA } from "@/modules/sorteios/types";
import {
  normalizarCpf,
  validarCpf,
  validarDataNascimento,
  validarNomeCompleto,
} from "@/modules/sorteios/validations/cliente";

export type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string; mensagem: string };

async function executar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    if (e instanceof ErroPortal) return { ok: false, codigo: e.codigo, mensagem: e.message };
    console.error("[sorteios-publico]", e);
    return {
      ok: false,
      codigo: "ERRO",
      mensagem: "Não foi possível concluir agora. Tente novamente.",
    };
  }
}

const esquemaCpf = z.object({ cpf: z.string().trim().min(1) });
const esquemaTelefone = esquemaCpf.extend({
  telefone: z.string().trim().min(8),
  lembrar: z.boolean().default(false),
});
const esquemaCadastro = esquemaTelefone.extend({
  nome: z.string().trim().max(200).default(""),
  data_nascimento: z.string().trim().max(10).default(""),
});
const esquemaNota = z.object({
  numero: z
    .string()
    .trim()
    .regex(/^[\dA-Za-z-]{3,60}$/, "Informe o número da nota (mínimo 3 caracteres)."),
  valor_centavos: z
    .number({ message: "Informe o valor da nota" })
    .int()
    .positive("Informe um valor maior que zero")
    .max(100000000, "Valor acima do permitido."),
});

function dadosPublicosSorteio(s: SorteioRow) {
  return {
    numero_sorteio: s.numero_sorteio,
    nome: s.nome,
    descricao: s.descricao,
    data_inicio: s.data_inicio,
    data_fim: s.data_fim,
    data_sorteio: s.data_sorteio,
    valor_por_cupom_centavos: s.valor_por_cupom_centavos,
    quantidade_maxima_cupons: s.quantidade_maxima_cupons,
    status: s.status,
  };
}

/** Dados públicos do sorteio ATIVO (ou mensagem de indisponibilidade). */
export const obterSorteioAtivoPublico = createServerFn({ method: "GET" }).handler(async () =>
  executar(async () => {
    const sorteio = await obterSorteioAtivo();
    return { sorteio: dadosPublicosSorteio(sorteio) };
  }),
);

/** Etapa 1 do acesso: valida o CPF e a disponibilidade do sorteio. */
export const iniciarAcessoPublico = createServerFn({ method: "POST" })
  .inputValidator((data) => esquemaCpf.parse(data))
  .handler(async ({ data }) =>
    executar(async () => {
      await limitarTentativas("cpf");
      const cpf = normalizarCpf(data.cpf);
      const valido = validarCpf(cpf);
      if (!valido.ok) throw new ErroPortal("VALIDACAO", valido.erro ?? "CPF inválido.");

      const sorteio = await obterSorteioAtivo();
      const periodo = periodoAberto(sorteio);
      if (!periodo.aberto) throw new ErroPortal("PERIODO", periodo.mensagem ?? "Indisponível.");
      return { sorteio: dadosPublicosSorteio(sorteio) };
    }),
  );

type EtapaAcesso =
  | { etapa: "cadastro" }
  | { etapa: "completar"; faltantes: ("nome" | "data_nascimento")[] }
  | { etapa: "termos" }
  | { etapa: "painel" };

/** Etapa 2 do acesso: confere o telefone com o cadastro e inicia a sessão. */
export const verificarTelefonePublico = createServerFn({ method: "POST" })
  .inputValidator((data) => esquemaTelefone.parse(data))
  .handler(async ({ data }) =>
    executar(async (): Promise<EtapaAcesso> => {
      await limitarTentativas("telefone");
      const cpf = normalizarCpf(data.cpf);
      if (!cpf || !validarCpf(cpf).ok) throw new ErroPortal("VALIDACAO", "CPF inválido.");

      const sorteio = await obterSorteioAtivo();
      const periodo = periodoAberto(sorteio);
      if (!periodo.aberto) throw new ErroPortal("PERIODO", periodo.mensagem ?? "Indisponível.");

      const supabase = await admin();
      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("cpf", cpf)
        .maybeSingle();

      if (!cliente) return { etapa: "cadastro" };

      if (!telefoneConfere(data.telefone, cliente.telefone, cliente.telefone_normalizado)) {
        throw new ErroPortal(
          "DADOS_NAO_CONFEREM",
          "Os dados informados não correspondem ao cadastro. Confira o CPF e o telefone.",
        );
      }

      const faltantes: ("nome" | "data_nascimento")[] = [];
      if (!cliente.nome?.trim()) faltantes.push("nome");
      if (!cliente.data_nascimento) faltantes.push("data_nascimento");
      if (faltantes.length > 0) return { etapa: "completar", faltantes };

      const participante = await garantirParticipacao(supabase, sorteio.id, cliente.id);
      await criarSessaoParticipante({
        participante_id: participante.id,
        cliente_id: cliente.id,
        sorteio_id: sorteio.id,
        lembrar: data.lembrar,
      });
      await auditarPortal({
        sorteio_id: sorteio.id,
        participante_id: participante.id,
        cliente_id: cliente.id,
        evento: EVENTOS_AUDITORIA.portalEntrada,
        detalhe: { cpf: mascararCpf(cpf) },
      });
      const etapa = await etapaAposIdentificacao(supabase, sorteio, participante);
      return { etapa };
    }),
  );

/** Etapa 3: cadastro novo ou complemento dos dados faltantes. */
export const concluirCadastroPublico = createServerFn({ method: "POST" })
  .inputValidator((data) => esquemaCadastro.parse(data))
  .handler(async ({ data }) =>
    executar(async (): Promise<EtapaAcesso> => {
      await limitarTentativas("cadastro");
      const cpf = normalizarCpf(data.cpf);
      if (!cpf || !validarCpf(cpf).ok) throw new ErroPortal("VALIDACAO", "CPF inválido.");

      const sorteio = await obterSorteioAtivo();
      const periodo = periodoAberto(sorteio);
      if (!periodo.aberto) throw new ErroPortal("PERIODO", periodo.mensagem ?? "Indisponível.");

      const supabase = await admin();
      const { data: existente } = await supabase
        .from("clientes")
        .select("*")
        .eq("cpf", cpf)
        .maybeSingle();

      let clienteId: string;
      let participante;
      let novoCliente = false;

      if (existente) {
        // Completa apenas o que está vazio; nunca sobrescreve dados preenchidos.
        if (!telefoneConfere(data.telefone, existente.telefone, existente.telefone_normalizado)) {
          throw new ErroPortal(
            "DADOS_NAO_CONFEREM",
            "Os dados informados não correspondem ao cadastro. Confira o CPF e o telefone.",
          );
        }
        const atualizacao: { nome?: string; data_nascimento?: string } = {};
        if (!existente.nome?.trim()) {
          const nome = data.nome.replace(/\s+/g, " ").trim();
          const v = validarNomeCompleto(nome);
          if (!v.ok) throw new ErroPortal("VALIDACAO", v.erro ?? "Nome inválido.");
          atualizacao.nome = nome;
        }
        if (!existente.data_nascimento) {
          const v = validarDataNascimento(data.data_nascimento);
          if (!v.ok) throw new ErroPortal("VALIDACAO", v.erro ?? "Data inválida.");
          atualizacao.data_nascimento = data.data_nascimento;
        }
        if (Object.keys(atualizacao).length > 0) {
          const { error } = await supabase
            .from("clientes")
            .update(atualizacao)
            .eq("id", existente.id);
          if (error) {
            throw new ErroPortal("ERRO", "Não foi possível salvar seus dados. Tente novamente.");
          }
        }
        clienteId = existente.id;
        participante = await garantirParticipacao(supabase, sorteio.id, clienteId);
      } else {
        const nome = data.nome.replace(/\s+/g, " ").trim();
        const vNome = validarNomeCompleto(nome);
        if (!vNome.ok) throw new ErroPortal("VALIDACAO", vNome.erro ?? "Nome inválido.");
        const vNascimento = validarDataNascimento(data.data_nascimento);
        if (!vNascimento.ok) {
          throw new ErroPortal("VALIDACAO", vNascimento.erro ?? "Data inválida.");
        }

        const telefoneDigitos = (data.telefone ?? "").replace(/\D/g, "");
        // Cliente + participação numa única transação no banco.
        const { data: participanteId, error } = await supabase.rpc(
          "sorteio_portal_criar_participacao",
          {
            _nome: nome,
            _telefone: telefoneDigitos,
            _telefone_normalizado: telefoneDigitos,
            _cpf: cpf!,
            _data_nascimento: data.data_nascimento,
            _sorteio_id: sorteio.id,
          },
        );
        if (error || !participanteId) {
          throw new ErroPortal("ERRO", "Não foi possível concluir seu cadastro. Tente novamente.");
        }
        novoCliente = true;
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id")
          .eq("cpf", cpf)
          .single();
        clienteId = cliente!.id;
        participante = await garantirParticipacao(supabase, sorteio.id, clienteId);
      }

      if (novoCliente) {
        await auditarPortal({
          sorteio_id: sorteio.id,
          participante_id: participante.id,
          cliente_id: clienteId,
          evento: EVENTOS_AUDITORIA.participanteCriado,
          detalhe: { cpf: mascararCpf(cpf) },
        });
      }
      await criarSessaoParticipante({
        participante_id: participante.id,
        cliente_id: clienteId,
        sorteio_id: sorteio.id,
        lembrar: data.lembrar,
      });
      await auditarPortal({
        sorteio_id: sorteio.id,
        participante_id: participante.id,
        cliente_id: clienteId,
        evento: EVENTOS_AUDITORIA.portalEntrada,
        detalhe: { cpf: mascararCpf(cpf) },
      });
      const etapa = await etapaAposIdentificacao(supabase, sorteio, participante);
      return { etapa };
    }),
  );

/** Contexto da sessão: usado pelo layout privado para liberar as telas. */
export const obterContextoParticipante = createServerFn({ method: "GET" }).handler(async () =>
  executar(async () => {
    const { participante, sorteio } = await carregarSessao();
    const supabase = await admin();
    const termos = await obterTermosAtual(supabase, sorteio.id);
    const precisaAceitarTermos = termos
      ? participante.aceite_termos_versao !== termos.versao || !participante.aceite_termos_em
      : false;
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", participante.cliente_id)
      .maybeSingle();
    return {
      nome: cliente?.nome?.trim() || "Participante",
      saldo_centavos: participante.saldo_centavos,
      sorteio: dadosPublicosSorteio(sorteio),
      precisaAceitarTermos,
      acoesBloqueadas: !periodoAberto(sorteio).aberto,
    };
  }),
);

/** Aceite da versão atual dos termos (nunca sobrescreve o aceite da mesma versão). */
export const aceitarTermosSorteio = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ versao: z.number().int().positive(), aceito: z.literal(true) }).parse(data),
  )
  .handler(async ({ data }) =>
    executar(async () => {
      const { participante, sorteio } = await carregarSessao();
      const supabase = await admin();
      const termos = await obterTermosAtual(supabase, sorteio.id);
      if (!termos || termos.versao !== data.versao) {
        throw new ErroPortal("VALIDACAO", "A versão dos termos não confere. Recarregue a página.");
      }
      if (participante.aceite_termos_versao !== termos.versao || !participante.aceite_termos_em) {
        const { error } = await supabase
          .from("sorteio_participantes")
          .update({
            aceite_termos_em: new Date().toISOString(),
            aceite_termos_versao: termos.versao,
          })
          .eq("id", participante.id);
        if (error) throw new ErroPortal("ERRO", "Não foi possível registrar o aceite.");
        await auditarPortal({
          sorteio_id: sorteio.id,
          participante_id: participante.id,
          cliente_id: participante.cliente_id,
          evento: EVENTOS_AUDITORIA.termosAceitos,
          detalhe: { versao: termos.versao },
        });
      }
      return { aceito: true };
    }),
  );

/** Painel: resumo do participante autenticado. */
export const obterPainelParticipante = createServerFn({ method: "GET" }).handler(async () =>
  executar(async () => {
    const { participante, sorteio } = await carregarSessao();
    const supabase = await admin();
    const contar = async (tabela: "sorteio_notas" | "sorteio_cupons", status?: string[]) => {
      let q = supabase
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("participante_id", participante.id);
      if (status) q = q.in("status", status);
      const { count } = await q;
      return count ?? 0;
    };
    return {
      saldo_centavos: participante.saldo_centavos,
      total_notas: await contar("sorteio_notas"),
      notas_pendentes: await contar("sorteio_notas", ["PENDENTE"]),
      total_cupons: await contar("sorteio_cupons", ["ATIVO"]),
      sorteio: dadosPublicosSorteio(sorteio),
      acoesBloqueadas: !periodoAberto(sorteio).aberto,
    };
  }),
);

/** Registro de nota: sempre PENDENTE, vínculo decidido pelo servidor. */
export const registrarNotaParticipante = createServerFn({ method: "POST" })
  .inputValidator((data) => esquemaNota.parse(data))
  .handler(async ({ data }) =>
    executar(async () => {
      await limitarTentativas("nota");
      const { participante, sorteio } = await carregarSessao();
      const periodo = periodoAberto(sorteio);
      if (!periodo.aberto) throw new ErroPortal("PERIODO", periodo.mensagem ?? "Indisponível.");

      const supabase = await admin();
      const { data: nota, error } = await supabase
        .from("sorteio_notas")
        .insert({
          sorteio_id: sorteio.id,
          participante_id: participante.id,
          numero: data.numero,
          valor_centavos: data.valor_centavos,
          status: "PENDENTE",
          cupons_gerados: 0,
          saldo_gerado_centavos: 0,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new ErroPortal("DUPLICADA", "Esta nota já foi registrada neste sorteio.");
        }
        throw new ErroPortal("ERRO", "Não foi possível registrar a nota. Tente novamente.");
      }
      await auditarPortal({
        sorteio_id: sorteio.id,
        participante_id: participante.id,
        cliente_id: participante.cliente_id,
        nota_id: nota.id,
        evento: EVENTOS_AUDITORIA.notaCadastrada,
        detalhe: { valor_centavos: data.valor_centavos },
      });
      return { registrada: true };
    }),
  );

/** Notas do participante autenticado (somente as dele). */
export const listarMinhasNotas = createServerFn({ method: "GET" }).handler(async () =>
  executar(async () => {
    const { participante } = await carregarSessao();
    const supabase = await admin();
    const { data } = await supabase
      .from("sorteio_notas")
      .select("id, numero, valor_centavos, status, motivo_invalidez, cadastrado_em")
      .eq("participante_id", participante.id)
      .order("cadastrado_em", { ascending: false })
      .limit(100);
    return { notas: data ?? [] };
  }),
);

/** Correção de nota INVÁLIDA: volta para PENDENTE. CANCELADA é só consulta. */
export const corrigirMinhaNota = createServerFn({ method: "POST" })
  .inputValidator((data) => esquemaNota.extend({ nota_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) =>
    executar(async () => {
      const { participante, sorteio } = await carregarSessao();
      const periodo = periodoAberto(sorteio);
      if (!periodo.aberto) throw new ErroPortal("PERIODO", periodo.mensagem ?? "Indisponível.");

      const supabase = await admin();
      const { data: nota } = await supabase
        .from("sorteio_notas")
        .select("id, status, numero, valor_centavos")
        .eq("id", data.nota_id)
        .eq("participante_id", participante.id)
        .maybeSingle();
      if (!nota) throw new ErroPortal("NAO_ENCONTRADA", "Nota não encontrada.");
      if (nota.status !== "INVALIDA") {
        throw new ErroPortal("VALIDACAO", "Somente notas inválidas podem ser corrigidas.");
      }

      const { error } = await supabase
        .from("sorteio_notas")
        .update({
          numero: data.numero,
          valor_centavos: data.valor_centavos,
          status: "PENDENTE",
          motivo_invalidez: null,
          invalidado_em: null,
        })
        .eq("id", nota.id)
        .eq("participante_id", participante.id)
        .eq("status", "INVALIDA");
      if (error) {
        if (error.code === "23505") {
          throw new ErroPortal("DUPLICADA", "Esta nota já foi registrada neste sorteio.");
        }
        throw new ErroPortal("ERRO", "Não foi possível corrigir a nota. Tente novamente.");
      }
      await auditarPortal({
        sorteio_id: sorteio.id,
        participante_id: participante.id,
        cliente_id: participante.cliente_id,
        nota_id: nota.id,
        evento: EVENTOS_AUDITORIA.notaAlterada,
        detalhe: { motivo: "correcao_pelo_participante" },
      });
      return { corrigida: true };
    }),
  );

/** Cupons do participante autenticado (somente consulta). */
export const listarMeusCupons = createServerFn({ method: "GET" }).handler(async () =>
  executar(async () => {
    const { participante } = await carregarSessao();
    const supabase = await admin();
    const { data } = await supabase
      .from("sorteio_cupons")
      .select("id, numero, status, valor_base_centavos, gerado_em")
      .eq("participante_id", participante.id)
      .order("gerado_em", { ascending: false })
      .limit(200);
    return { cupons: data ?? [] };
  }),
);

/** Informações públicas do sorteio da sessão + termos atuais + prêmios ativos. */
export const obterInformacoesPublicasSorteio = createServerFn({ method: "GET" }).handler(async () =>
  executar(async () => {
    const { sorteio } = await carregarSessao();
    const supabase = await admin();
    const termos = await obterTermosAtual(supabase, sorteio.id);
    const { data: premios } = await supabase
      .from("sorteio_premios")
      .select("id, nome, descricao, quantidade, ordem")
      .eq("sorteio_id", sorteio.id)
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    return {
      sorteio: dadosPublicosSorteio(sorteio),
      termos: termos
        ? {
            versao: termos.versao,
            titulo: termos.titulo,
            regras: termos.regras,
            como_participar: termos.como_participar,
            validade: termos.validade,
            como_sera_realizado: termos.como_sera_realizado,
            informacoes: termos.informacoes,
            premios: termos.premios,
            outras_condicoes: termos.outras_condicoes,
            publicado_em: termos.publicado_em,
          }
        : null,
      premios: premios ?? [],
    };
  }),
);

/** Encerra a sessão: revoga no servidor e remove os cookies. */
export const sairPortalParticipante = createServerFn({ method: "POST" }).handler(async () =>
  executar(async () => {
    const contexto = await revogarSessaoAtual();
    if (contexto) {
      await auditarPortal({
        sorteio_id: contexto.sorteio.id,
        participante_id: contexto.participante.id,
        cliente_id: contexto.participante.cliente_id,
        evento: EVENTOS_AUDITORIA.portalSaida,
        detalhe: {},
      });
    }
    return { saiu: true };
  }),
);
