import {
  Activity,
  Bot,
  MessageCircle,
  Monitor,
  Printer,
  Settings,
  Sparkles,
  Store,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapeia o nome do ícone guardado em `agentes.icone` para um componente.
 * Nomes desconhecidos caem em `Bot`, evitando quebrar a tela.
 */
const MAPA: Record<string, LucideIcon> = {
  Bot,
  MessageCircle,
  Activity,
  Monitor,
  MonitorCog: Monitor,
  Printer,
  Settings,
  Sparkles,
  Store,
  Users,
  Wrench,
  Zap,
};

export function iconeAgente(nome: string | null | undefined): LucideIcon {
  if (!nome) return Bot;
  return MAPA[nome] ?? Bot;
}

export const OPCOES_ICONE = [
  "Bot",
  "MessageCircle",
  "Activity",
  "Monitor",
  "Printer",
  "Settings",
  "Sparkles",
  "Store",
  "Users",
  "Wrench",
  "Zap",
];
