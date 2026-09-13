import {
  Bot,
  Cable,
  DollarSign,
  FileText,
  FileUser,
  Gift,
  Megaphone,
  MessageCircle,
  Printer,
  Settings,
  Sparkles,
  Store,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Registro central de módulos do sistema.
 *
 * Apenas DEFINIÇÃO estrutural — nenhuma lógica de negócio depende deste
 * arquivo. Futuramente, este registro será ligado ao sistema de
 * usuários/perfis através das chaves de permissão (`modulo.<id>` no módulo
 * e `<item>.visualizar` em cada item) e poderá alimentar dashboards e
 * módulos públicos (acesso "publico", ex.: catálogo/sorteios em subdomínio).
 */

export type TipoAcessoModulo = "administrativo" | "publico";

export interface ItemModulo {
  /** Identificador estável do item (usado nas chaves de permissão). */
  id: string;
  nome: string;
  descricao: string;
  icone: LucideIcon;
  ordem: number;
  /** Itens inativos são planejados e não aparecem no menu. */
  ativo: boolean;
  /** Rota principal (caminho de URL, ex.: "/orcamentos"); null enquanto a página ainda não existe. */
  rota: string | null;
  /** Chave de permissão futura do item (ex.: "calculadora.visualizar"). */
  permissao: string;
  /** Exibe contador de conversas com mensagens não lidas. */
  badgeNaoLidas?: boolean;
}

export interface Modulo {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  /** "administrativo" = painel interno; "publico" = site/app público futuro. */
  acesso: TipoAcessoModulo;
  /** Chave de permissão futura do módulo (ex.: "modulo.operacao"). */
  permissao: string;
  itens: ItemModulo[];
}

export const MODULOS: Modulo[] = [
  {
    id: "operacao",
    nome: "Operação",
    descricao: "Ferramentas operacionais do dia a dia",
    ordem: 1,
    ativo: true,
    acesso: "administrativo",
    permissao: "modulo.operacao",
    itens: [
      {
        id: "calculadora",
        nome: "Calculadora",
        descricao: "Orçamento rápido de impressões",
        icone: Printer,
        ordem: 1,
        ativo: true,
        rota: "/",
        permissao: "calculadora.visualizar",
      },
      {
        id: "orcamentos",
        nome: "Orçamentos",
        descricao: "Pedidos e orçamentos salvos",
        icone: FileText,
        ordem: 2,
        ativo: true,
        rota: "/orcamentos",
        permissao: "orcamentos.visualizar",
      },
      {
        id: "clientes",
        nome: "Clientes",
        descricao: "Cadastro e histórico de clientes",
        icone: Users,
        ordem: 3,
        ativo: true,
        rota: "/clientes",
        permissao: "clientes.visualizar",
      },
      {
        id: "curriculos",
        nome: "Currículo Vitae",
        descricao: "Currículos gerados e links públicos",
        icone: FileUser,
        ordem: 4,
        ativo: true,
        rota: "/curriculos",
        permissao: "curriculos.visualizar",
      },
      {
        id: "precos",
        nome: "Configurar Preços",
        descricao: "Tabela de preços e faixas",
        icone: DollarSign,
        ordem: 5,
        ativo: true,
        rota: "/precos",
        permissao: "precos.visualizar",
      },
    ],
  },
  {
    id: "comunicacao",
    nome: "Comunicação",
    descricao: "Atendimento e automação de mensagens",
    ordem: 2,
    ativo: true,
    acesso: "administrativo",
    permissao: "modulo.comunicacao",
    itens: [
      {
        id: "whatsapp",
        nome: "WhatsApp",
        descricao: "Conversas e atendimentos",
        icone: MessageCircle,
        ordem: 1,
        ativo: true,
        rota: "/whatsapp",
        permissao: "whatsapp.visualizar",
        badgeNaoLidas: true,
      },
      {
        id: "mensagens-rapidas",
        nome: "Mensagens Rápidas",
        descricao: "Respostas prontas com /",
        icone: Zap,
        ordem: 2,
        ativo: true,
        rota: "/mensagens-rapidas",
        permissao: "mensagens_rapidas.visualizar",
      },
      {
        id: "bot",
        nome: "Configurar Bot",
        descricao: "Fluxos e respostas automáticas",
        icone: Bot,
        ordem: 3,
        ativo: true,
        rota: "/bot",
        permissao: "bot.visualizar",
      },
      {
        id: "conexoes",
        nome: "Conexões",
        descricao: "Instâncias de WhatsApp conectadas",
        icone: Cable,
        ordem: 4,
        ativo: false,
        rota: null,
        permissao: "conexoes.visualizar",
      },
    ],
  },
  {
    id: "marketing",
    nome: "Marketing",
    descricao: "Vitrine pública e campanhas",
    ordem: 3,
    ativo: true,
    acesso: "administrativo",
    permissao: "modulo.marketing",
    itens: [
      {
        id: "catalogo",
        nome: "Catálogo",
        descricao: "Catálogo público de produtos e serviços",
        icone: Store,
        ordem: 1,
        ativo: false,
        rota: null,
        permissao: "catalogo.visualizar",
      },
      {
        id: "sorteios",
        nome: "Sorteios",
        descricao: "Campanhas de sorteio com página pública",
        icone: Gift,
        ordem: 2,
        ativo: false,
        rota: null,
        permissao: "sorteios.visualizar",
      },
      {
        id: "promocoes",
        nome: "Promoções",
        descricao: "Ofertas e campanhas promocionais",
        icone: Megaphone,
        ordem: 3,
        ativo: false,
        rota: null,
        permissao: "promocoes.visualizar",
      },
    ],
  },
  {
    id: "administracao",
    nome: "Administração",
    descricao: "Gestão do sistema",
    ordem: 4,
    ativo: true,
    acesso: "administrativo",
    permissao: "modulo.administracao",
    itens: [
      {
        id: "usuarios",
        nome: "Usuários",
        descricao: "Atendentes, perfis e permissões",
        icone: UsersRound,
        ordem: 1,
        ativo: false,
        rota: null,
        permissao: "usuarios.visualizar",
      },
      {
        id: "configuracoes",
        nome: "Configurações",
        descricao: "Dados da loja e preferências",
        icone: Settings,
        ordem: 2,
        ativo: true,
        rota: "/configuracoes",
        permissao: "configuracoes.visualizar",
      },
      {
        id: "melhorias",
        nome: "Melhorias",
        descricao: "Lista de melhorias do sistema",
        icone: Sparkles,
        ordem: 3,
        ativo: true,
        rota: "/melhorias",
        permissao: "melhorias.visualizar",
      },
    ],
  },
];

/** Módulos ativos com itens ativos, prontos para o menu. */
export function modulosVisiveis(pode: (permissao?: string) => boolean) {
  return MODULOS.filter((m) => m.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((m) => ({
      ...m,
      itens: m.itens
        .filter((i) => i.ativo && i.rota && pode(i.permissao))
        .sort((a, b) => a.ordem - b.ordem),
    }))
    .filter((m) => m.itens.length > 0);
}
