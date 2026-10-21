import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import AgentesPainel from "@/modules/agentes/AgentesPainel";

export const Route = createFileRoute("/agentes/")({
  component: () => <AgentesPainel />,
});