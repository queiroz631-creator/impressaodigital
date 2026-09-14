import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  "id, nome, descricao, numero_sorteio, status, data_inicio, data_fim, data_sorteio, valor_por_cupom_centavos, quantidade_maxima_cupons, criado_por, criado_em, atualizado_em";

type Contagens = { participantes: number; notas: number; cupons: number };

async function contar(
  tabela: "sorteio_participantes" | "sorteio_notas" | "sorteio_cupons",
  sorteioId: string,
) {
  const { count, error } = await supabase
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .eq("sorteio_id", sorteioId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function contagensDe(sorteioId: string): Promise<Contagens> {
  const [participantes, notas, cupons] = await Promise.all([
    contar("sorteio_participantes", sorteioId),
    contar("sorteio_notas", sorteioId),
    contar("sorteio_cupons", sorteioId),
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
export function useIndicadoresSorteio(id: string) {
  return useQuery({
    queryKey: ["sorteio-indicadores", id],
    queryFn: async () => {
      const contagens = await contagensDe(id);

      const [
        { data: notas, error: erroNotas },
        { data: cupons, error: erroCupons },
        premios,
        ganhadores,
      ] = await Promise.all([
        supabase.from("sorteio_notas").select("status, valor_centavos").eq("sorteio_id", id),
        supabase.from("sorteio_cupons").select("status").eq("sorteio_id", id),
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

      const porStatusNota = { PENDENTE: 0, VALIDA: 0, INVALIDA: 0, CANCELADA: 0 };
      let valorValidoCentavos = 0;
      for (const n of notas ?? []) {
        porStatusNota[n.status as StatusNota] += 1;
        if (n.status === "VALIDA") valorValidoCentavos += n.valor_centavos ?? 0;
      }

      const porStatusCupom = { ATIVO: 0, CANCELADO: 0, UTILIZADO: 0 };
      for (const c of cupons ?? []) porStatusCupom[c.status as StatusCupom] += 1;

      return {
        ...contagens,
        porStatusNota,
        porStatusCupom,
        valorValidoCentavos,
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
              .eq("participante_id", p.id),
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

export type CupomListado = SorteioCupom & { participanteNome: string; notaNumero: string };

export function useCuponsSorteio(id: string) {
  return useQuery<CupomListado[]>({
    queryKey: ["sorteio-cupons", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_cupons")
        .select(
          "*, sorteio_participantes:participante_id (clientes:cliente_id (nome)), sorteio_notas:nota_id (numero)",
        )
        .eq("sorteio_id", id)
        .order("gerado_em", { ascending: false });
      if (error) throw new Error(error.message);
      const lista = (data ?? []) as unknown as (SorteioCupom & {
        sorteio_participantes: { clientes: { nome: string | null } | null } | null;
        sorteio_notas: { numero: string | null } | null;
      })[];
      return lista.map((c) => ({
        ...c,
        participanteNome: c.sorteio_participantes?.clientes?.nome ?? "—",
        notaNumero: c.sorteio_notas?.numero ?? "—",
      }));
    },
  });
}
