import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ehHoje } from "@/lib/format";
import type {
  Sorteio,
  SorteioCupom,
  SorteioNota,
  SorteioParticipante,
  SorteioPremio,
  SorteioTermos,
  StatusCupom,
  StatusNota,
} from "../types";

/**
 * Consultas de leitura do módulo Sorteios.
 * Todas passam pelas políticas de acesso do banco (RLS) do usuário atual.
 */

const CAMPOS_SORTEIO =
  "id, nome, descricao, numero_sorteio, status, data_inicio, data_fim, data_sorteio, valor_por_cupom_centavos, quantidade_maxima_cupons, valor_minimo_nota_centavos, criado_por, criado_em, atualizado_em, encerrado_em, encerrado_por, conferencia_encerramento";


type Contagens = { participantes: number; notas: number; cupons: number };

async function contar(
  tabela: "sorteio_participantes" | "sorteio_notas",
  sorteioId: string,
) {
  const { count, error } = await supabase
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .eq("sorteio_id", sorteioId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Cupons cancelados não valem mais: não entram na contagem exibida. */
async function contarCuponsValidos(sorteioId: string) {
  const { count, error } = await supabase
    .from("sorteio_cupons")
    .select("id", { count: "exact", head: true })
    .eq("sorteio_id", sorteioId)
    .neq("status", "CANCELADO");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function contagensDe(sorteioId: string): Promise<Contagens> {
  const [participantes, notas, cupons] = await Promise.all([
    contar("sorteio_participantes", sorteioId),
    contar("sorteio_notas", sorteioId),
    contarCuponsValidos(sorteioId),
  ]);
  return { participantes, notas, cupons };
}

export type SorteioComContagens = Sorteio & Contagens;

export function useListaSorteios() {
  return useQuery<SorteioComContagens[]>({
    queryKey: ["sorteios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteios")
        .select(CAMPOS_SORTEIO)
        .order("numero_sorteio", { ascending: false });
      if (error) throw new Error(error.message);
      const lista = (data ?? []) as Sorteio[];
      return Promise.all(lista.map(async (s) => ({ ...s, ...(await contagensDe(s.id)) })));
    },
  });
}

export function useSorteio(id: string) {
  return useQuery<SorteioComContagens>({
    queryKey: ["sorteio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteios")
        .select(CAMPOS_SORTEIO)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Sorteio não encontrado.");
      const sorteio = data as Sorteio;
      return { ...sorteio, ...(await contagensDe(sorteio.id)) };
    },
  });
}

/** Indicadores do painel do sorteio, todos calculados no banco. */
export function useIndicadoresSorteio(
  id: string,
  modo: "HOJE" | "TODOS" = "TODOS",
  participantes: "CONCORREM" | "TODOS" = "CONCORREM",
) {
  return useQuery({
    queryKey: ["sorteio-indicadores", id, modo, participantes],
    queryFn: async () => {
      const [
        { data: notas, error: erroNotas },
        { data: cupons, error: erroCupons },
        { data: participacoes, error: erroSaldo },
        premios,
        ganhadores,
      ] = await Promise.all([
        supabase
          .from("sorteio_notas")
          .select("status, valor_centavos, cupons_processado_em, cadastrado_em, participante_id")
          .eq("sorteio_id", id),
        supabase
          .from("sorteio_cupons")
          .select("status, gerado_em, participante_id")
          .eq("sorteio_id", id),
        supabase
          .from("sorteio_participantes")
          .select("id, saldo_centavos, criado_em, concorre_sorteio")
          .eq("sorteio_id", id),
        supabase
          .from("sorteio_premios")
          .select("id", { count: "exact", head: true })
          .eq("sorteio_id", id)
          .eq("ativo", true),
        supabase
          .from("sorteio_ganhadores")
          .select("id", { count: "exact", head: true })
          .eq("sorteio_id", id),
      ]);
      if (erroNotas) throw new Error(erroNotas.message);
      if (erroCupons) throw new Error(erroCupons.message);
      if (erroSaldo) throw new Error(erroSaldo.message);

      // No modo HOJE, participantes, notas e cupons consideram só o dia de hoje
      // (fuso do navegador). Saldo, prêmios e ganhadores são sempre totais.
      const soHoje = modo === "HOJE";
      const apenasConcorrentes = participantes === "CONCORREM";
      const participantesElegiveis = new Set(
        (participacoes ?? []).filter((p) => p.concorre_sorteio).map((p) => p.id),
      );
      const participanteVisivel = (participanteId: string) =>
        !apenasConcorrentes || participantesElegiveis.has(participanteId);
      const notasVisiveis = (notas ?? []).filter(
        (n) => participanteVisivel(n.participante_id) && (!soHoje || ehHoje(n.cadastrado_em)),
      );
      const cuponsVisiveis = (cupons ?? []).filter(
        (c) => participanteVisivel(c.participante_id) && (!soHoje || ehHoje(c.gerado_em)),
      );
      const participantesVisiveis = (participacoes ?? []).filter(
        (p) => participanteVisivel(p.id) && (!soHoje || ehHoje(p.criado_em)),
      );

      const porStatusNota = { PENDENTE: 0, VALIDA: 0, INVALIDA: 0, CANCELADA: 0 };
      let valorValidoCentavos = 0;
      let notasAguardandoCupons = 0;
      for (const n of notasVisiveis) {
        porStatusNota[n.status as StatusNota] += 1;
        if (n.status === "VALIDA") {
          valorValidoCentavos += n.valor_centavos ?? 0;
          if (!n.cupons_processado_em) notasAguardandoCupons += 1;
        }
      }

      const porStatusCupom = { ATIVO: 0, CANCELADO: 0, UTILIZADO: 0 };
      for (const c of cuponsVisiveis) porStatusCupom[c.status as StatusCupom] += 1;

      let saldoCentavos = 0;
      for (const p of participacoes ?? []) {
        if (participanteVisivel(p.id)) saldoCentavos += p.saldo_centavos ?? 0;
      }

      return {
        participantes: participantesVisiveis.length,
        notas: notasVisiveis.length,
        cupons: cuponsVisiveis.filter((c) => c.status !== "CANCELADO").length,
        porStatusNota,
        porStatusCupom,
        valorValidoCentavos,
        saldoCentavos,
        notasAguardandoCupons,
        premiosAtivos: premios.count ?? 0,
        ganhadores: ganhadores.count ?? 0,
      };
    },
  });
}

export function useTermosSorteio(id: string) {
  return useQuery<SorteioTermos[]>({
    queryKey: ["sorteio-termos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_termos")
        .select("*")
        .eq("sorteio_id", id)
        .order("versao", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as SorteioTermos[];
    },
  });
}

export function usePremiosSorteio(id: string) {
  return useQuery<SorteioPremio[]>({
    queryKey: ["sorteio-premios", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_premios")
        .select("*")
        .eq("sorteio_id", id)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as SorteioPremio[];
    },
  });
}

export type ParticipanteListado = SorteioParticipante & {
  nome: string;
  cpf: string | null;
  telefone: string | null;
  notas: number;
  cupons: number;
};

export function useParticipantesSorteio(id: string) {
  return useQuery<ParticipanteListado[]>({
    queryKey: ["sorteio-participantes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_participantes")
        .select("*, clientes:cliente_id (nome, cpf, telefone)")
        .eq("sorteio_id", id)
        .order("criado_em", { ascending: false });
      if (error) throw new Error(error.message);

      const lista = (data ?? []) as unknown as (SorteioParticipante & {
        clientes: { nome: string | null; cpf: string | null; telefone: string | null } | null;
      })[];

      return Promise.all(
        lista.map(async (p) => {
          const [notas, cupons] = await Promise.all([
            supabase
              .from("sorteio_notas")
              .select("id", { count: "exact", head: true })
              .eq("participante_id", p.id),
            supabase
              .from("sorteio_cupons")
              .select("id", { count: "exact", head: true })
              .eq("participante_id", p.id)
              .neq("status", "CANCELADO"),
          ]);
          return {
            ...p,
            nome: p.clientes?.nome ?? "—",
            cpf: p.clientes?.cpf ?? null,
            telefone: p.clientes?.telefone ?? null,
            notas: notas.count ?? 0,
            cupons: cupons.count ?? 0,
          };
        }),
      );
    },
  });
}

export type NotaListada = SorteioNota & { participanteNome: string };

export function useNotasSorteio(id: string) {
  return useQuery<NotaListada[]>({
    queryKey: ["sorteio-notas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_notas")
        .select("*, sorteio_participantes:participante_id (clientes:cliente_id (nome))")
        .eq("sorteio_id", id)
        .order("cadastrado_em", { ascending: false });
      if (error) throw new Error(error.message);
      const lista = (data ?? []) as unknown as (SorteioNota & {
        sorteio_participantes: { clientes: { nome: string | null } | null } | null;
      })[];
      return lista.map((n) => ({
        ...n,
        participanteNome: n.sorteio_participantes?.clientes?.nome ?? "—",
      }));
    },
  });
}

export type CupomListado = SorteioCupom & {
  participanteNome: string;
  participanteCpf: string | null;
  notaNumero: string;
  notaValorCentavos: number | null;
  notaStatus: StatusNota | null;
};

export function useCuponsSorteio(id: string) {
  return useQuery<CupomListado[]>({
    queryKey: ["sorteio-cupons", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_cupons")
        .select(
          "*, sorteio_participantes:participante_id (clientes:cliente_id (nome, cpf)), sorteio_notas:nota_id (numero, valor_centavos, status)",
        )
        .eq("sorteio_id", id)
        .order("gerado_em", { ascending: false });
      if (error) throw new Error(error.message);
      const lista = (data ?? []) as unknown as (SorteioCupom & {
        sorteio_participantes: {
          clientes: { nome: string | null; cpf: string | null } | null;
        } | null;
        sorteio_notas: {
          numero: string | null;
          valor_centavos: number | null;
          status: string | null;
        } | null;
      })[];
      return lista.map((c) => ({
        ...c,
        participanteNome: c.sorteio_participantes?.clientes?.nome ?? "—",
        participanteCpf: c.sorteio_participantes?.clientes?.cpf ?? null,
        notaNumero: c.sorteio_notas?.numero ?? "—",
        notaValorCentavos: c.sorteio_notas?.valor_centavos ?? null,
        notaStatus: (c.sorteio_notas?.status as StatusNota | undefined) ?? null,
      }));
    },
  });
}
