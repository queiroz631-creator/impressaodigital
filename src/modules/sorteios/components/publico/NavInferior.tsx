import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Home, Receipt, Ticket, Info, LogOut } from "lucide-react";
import { toast } from "sonner";
import { sairPortalParticipante } from "@/lib/sorteios-publico.functions";
import { cn } from "@/lib/utils";

const ITENS = [
  { to: "/sorteios-publico/painel", rotulo: "Início", Icone: Home },
  { to: "/sorteios-publico/notas", rotulo: "Notas", Icone: Receipt },
  { to: "/sorteios-publico/cupons", rotulo: "Cupons", Icone: Ticket },
  { to: "/sorteios-publico/informacoes", rotulo: "Info", Icone: Info },
] as const;

/** Navegação fixa na parte inferior (padrão mobile) das telas do participante. */
export function NavInferior() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const sair = useServerFn(sairPortalParticipante);

  async function aoSair() {
    const resultado = await sair({});
    if (!resultado.ok) toast.error(resultado.mensagem);
    navigate({ to: "/sorteios-publico" });
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {ITENS.map(({ to, rotulo, Icone }) => {
          const ativo = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                ativo ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icone className="h-5 w-5" />
              {rotulo}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => void aoSair()}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </nav>
  );
}
