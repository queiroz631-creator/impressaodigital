import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sairFotos } from "@/lib/foto-express-portal.functions";

export function LayoutPortalFotos({ children, autenticado = false }: { children: ReactNode; autenticado?: boolean }) {
  const navigate = useNavigate(); const qc = useQueryClient(); const sair = useServerFn(sairFotos);
  async function encerrar() { await sair({}); qc.clear(); void navigate({ to: "/fotos" }); }
  return <div className="tema-portal-fotos min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to={autenticado ? "/fotos/trabalhos" : "/fotos"} className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Camera className="h-5 w-5" /></span><span><strong className="block font-serif text-lg leading-none">Impressão Digital</strong><small className="text-muted-foreground">Portal de Fotos</small></span></Link>
        {autenticado && <Button variant="ghost" size="icon" onClick={() => void encerrar()} aria-label="Sair" title="Sair"><LogOut className="h-5 w-5" /></Button>}
      </div>
    </header>
    {children}
  </div>;
}