import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { usePermissoes } from "@/hooks/usePermissoes";
import { modulosVisiveis } from "@/lib/modulos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-impressao.png";

export function AppLayout({
  children,
  permissao,
}: {
  children: ReactNode;
  /** Chave exigida para ver esta página. Sem ela, o conteúdo não é renderizado. */
  permissao?: string;
}) {
  const { user, loading } = useAuth();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const { pode, carregando: carregandoPermissoes } = usePermissoes(user?.id);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const pendentes = useConversasPendentes(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => setAberto(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const grupos = modulosVisiveis(pode);

  const linkClasse = (ativo: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      ativo
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      <Link to="/dashboard" className={linkClasse(pathname === "/dashboard")}>
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        <span className="flex-1">Dashboard</span>
      </Link>

      {grupos.map((grupo) => {
        const expandido = gruposAbertos[grupo.id] === true;
        return (
          <div key={grupo.id} className="flex flex-col">
            <button
              type="button"
              aria-expanded={expandido}
              onClick={() => setGruposAbertos((prev) => ({ ...prev, [grupo.id]: !expandido }))}
              className="flex items-center justify-between px-3 pb-1 pt-4 text-left text-xs font-bold uppercase tracking-wider text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground focus:outline-none"
            >
              {grupo.nome}
              {expandido ? (
                <ChevronUp className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0" />
              )}
            </button>
            {expandido && (
              <div className="flex flex-col gap-1">
                {grupo.itens.map((item) => (
                  <Link
                    key={item.id}
                    to={item.rota as never}
                    className={linkClasse(pathname === item.rota)}
                  >
                    <item.icone className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.nome}</span>
                    {item.badgeNaoLidas && pendentes > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                        {pendentes}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth" });
        }}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sair
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* MENU LATERAL FIXO */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
        <SidebarHeader />

        {nav}

        <div className="mt-auto border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
          <p className="truncate">{user.email}</p>
          <p className="mt-1">{isAdmin ? "Administrador" : "Usuário"}</p>
        </div>
      </aside>

      {/* MENU MOBILE */}
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/60"
            onClick={() => setAberto(false)}
            aria-hidden
          />

          <aside className="relative flex h-full w-64 flex-col bg-sidebar">
            <SidebarHeader />
            {nav}
          </aside>
        </div>
      )}

      {/* CONTEÚDO */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="flex items-center gap-3 bg-navy px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAberto((v) => !v)}
            className="text-navy-foreground hover:bg-sidebar-accent"
            aria-label="Abrir menu"
          >
            {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <span className="text-sm font-semibold text-navy-foreground">Impressão Digital</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {permissao && carregandoPermissoes ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : permissao && !pode(permissao) ? (
            <AcessoNegado />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

/** Conversas com mensagens não lidas, exibidas como contador no menu. */
function useConversasPendentes(habilitado: boolean) {
  const { data } = useQuery({
    queryKey: ["whatsapp-nao-lidas"],
    enabled: habilitado,
    refetchInterval: 20000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("whatsapp_conversas")
        .select("id", { count: "exact", head: true })
        .gt("nao_lidas", 0)
        .neq("status", "finalizado");
      if (error) throw error;
      return count ?? 0;
    },
  });
  return data ?? 0;
}

function SidebarHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <img src={logo} alt="Logo Impressão Digital" width={40} height={40} className="h-10 w-10" />
      <div className="leading-tight">
        <p className="text-sm font-bold text-sidebar-primary-foreground">IMPRESSÃO</p>
        <p className="text-xs tracking-widest text-sidebar-foreground/70">DIGITAL</p>
      </div>
    </div>
  );
}

export function PageHeader({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div
      className="mb-6 rounded-2xl px-5 py-6 text-navy-foreground shadow-card sm:px-8"
      style={{ backgroundImage: "var(--gradient-header)" }}
    >
      <div className="flex items-center gap-4">
        <img
          src={logo}
          alt=""
          width={56}
          height={56}
          className="hidden h-14 w-14 sm:block"
          loading="lazy"
        />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-navy-foreground/80">{subtitulo}</p>}
        </div>
      </div>
    </div>
  );
}
