import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientePortalFotos = {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  dataNascimento: string | null;
  primeiroAcesso: string | null;
  ultimoAcesso: string | null;
  albuns: number;
};

/** Lista os clientes que já entraram ou criaram álbuns pelo portal do FOTO EXPRESS. Somente equipe autorizada. */
export const listarClientesPortalFotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: permitido, error: erroPermissao } = await context.supabase.rpc("pode_foto_express", { _chave: "foto_express.visualizar" });
    if (erroPermissao || !permitido) throw new Error("Você não tem permissão para ver os clientes do portal.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [sessoes, trabalhos] = await Promise.all([
      supabaseAdmin.from("foto_express_portal_sessoes").select("cliente_id, criado_em, usado_em").limit(10000),
      supabaseAdmin.from("foto_express_trabalhos").select("cliente_id, criado_em").eq("origem_portal", true).not("cliente_id", "is", null).limit(10000),
    ]);
    if (sessoes.error) throw new Error(sessoes.error.message);
    if (trabalhos.error) throw new Error(trabalhos.error.message);
    const mapa = new Map<string, { primeiro: string | null; ultimo: string | null; albuns: number }>();
    const menor = (a: string | null, b: string) => (!a || b < a ? b : a);
    const maior = (a: string | null, b: string) => (!a || b > a ? b : a);
    for (const s of sessoes.data ?? []) {
      const atual = mapa.get(s.cliente_id) ?? { primeiro: null, ultimo: null, albuns: 0 };
      atual.primeiro = menor(atual.primeiro, s.criado_em);
      atual.ultimo = maior(atual.ultimo, s.usado_em ?? s.criado_em);
      mapa.set(s.cliente_id, atual);
    }
    for (const t of trabalhos.data ?? []) {
      if (!t.cliente_id) continue;
      const atual = mapa.get(t.cliente_id) ?? { primeiro: null, ultimo: null, albuns: 0 };
      atual.albuns += 1;
      atual.primeiro = menor(atual.primeiro, t.criado_em);
      mapa.set(t.cliente_id, atual);
    }
    const ids = [...mapa.keys()];
    if (!ids.length) return [] as ClientePortalFotos[];
    const clientes: ClientePortalFotos[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabaseAdmin.from("clientes").select("id, nome, telefone, cpf, data_nascimento").in("id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const c of data ?? []) {
        const info = mapa.get(c.id)!;
        clientes.push({ id: c.id, nome: c.nome ?? "", telefone: c.telefone ?? "", cpf: c.cpf ?? "", dataNascimento: c.data_nascimento, primeiroAcesso: info.primeiro, ultimoAcesso: info.ultimo, albuns: info.albuns });
      }
    }
    return clientes.sort((a, b) => (b.ultimoAcesso ?? b.primeiroAcesso ?? "").localeCompare(a.ultimoAcesso ?? a.primeiroAcesso ?? ""));
  });
