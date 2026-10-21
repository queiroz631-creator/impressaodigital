/**
 * Banco falso em memória para testes do WhatsApp (sem Supabase).
 * Imita só o que o webhook usa: encadeamento select/eq/gte/order/limit,
 * insert/update/delete, `maybeSingle` (erro se houver mais de uma linha),
 * índices únicos e `rpc` configurável.
 */

export type Linha = Record<string, unknown>;

interface Erro {
  code: string;
  message: string;
}

const PADROES: Record<string, () => Linha> = {
  whatsapp_conversas: () => ({
    status: "automatico",
    etapa: "inicio",
    total_mensagens: 0,
    nao_lidas: 0,
    atendimento_numero: 1,
    nome_manual: false,
    bot_pendente: false,
    cliente_id: null,
    data_finalizacao: null,
    chat_lid: null,
    ultima_mensagem: null,
    ultima_mensagem_em: null,
    nome_contato: null,
    agente_processando: false,
    agente_processando_em: null,
  }),
  whatsapp_mensagens: () => ({ apagada: false, editada: false, texto_original: null }),
};

/** Índices únicos (ignoram linhas com valor nulo em alguma coluna). */
const UNICAS: Record<string, string[][]> = {
  whatsapp_mensagens: [["whatsapp_message_id"]],
  whatsapp_conversas: [["telefone", "conexao_id"]],
  // Uma configuração de bot por conexão (migração 20261020020000).
  whatsapp_config: [["conexao_id"]],
};

export class BancoFalso {
  tabelas: Record<string, Linha[]> = {};
  /**
   * Simula a janela de corrida: as próximas N leituras (`maybeSingle`) da
   * tabela devolvem "nada encontrado" mesmo existindo a linha. Os índices
   * únicos continuam valendo nas gravações.
   */
  leiturasCegas: Record<string, number> = {};
  /** Colunas que "não existem" por tabela: um select que as cite devolve erro 42703. */
  colunasInexistentes: Record<string, string[]> = {};
  /** Faz qualquer acesso à tabela lançar este erro (simula falha inesperada). */
  lancarEm: Record<string, string> = {};
  /** Respostas de RPC por nome (padrão: sucesso sem dados). */
  rpcRespostas: Record<string, (args: Record<string, unknown>) => { data: unknown; error: { code?: string; message: string } | null }> = {};
  chamadasRpc: Array<{ nome: string; args: Record<string, unknown> }> = [];
  errosRpc: Record<string, { message: string }> = {};
  private seq = 0;

  tabela(nome: string): Linha[] {
    return (this.tabelas[nome] ??= []);
  }

  semear(nome: string, linhas: Linha[]): void {
    for (const l of linhas) {
      this.tabela(nome).push({ ...(PADROES[nome]?.() ?? {}), id: `${nome}-semente-${++this.seq}`, ...l });
    }
  }

  proximoId(nome: string): string {
    return `${nome}-${++this.seq}`;
  }

  from(nome: string): ConsultaFalsa {
    return new ConsultaFalsa(this, nome);
  }

  async rpc(nome: string, args: Record<string, unknown> = {}) {
    this.chamadasRpc.push({ nome, args });
    const custom = this.rpcRespostas[nome];
    if (custom) return custom(args);
    const erro = this.errosRpc[nome];
    return { data: null, error: erro ?? null };
  }
}

type Operacao = "select" | "insert" | "update" | "delete";

export class ConsultaFalsa implements PromiseLike<{ data: unknown; error: Erro | null }> {
  private op: Operacao = "select";
  private filtros: Array<(l: Linha) => boolean> = [];
  private valores: Linha | null = null;
  private limite: number | null = null;
  private ordem: { coluna: string; asc: boolean } | null = null;
  private colunasSelecionadas = "";

  constructor(
    private readonly banco: BancoFalso,
    private readonly nome: string,
  ) {}

  select(colunas?: string, _opcoes?: unknown): this {
    if (this.op === "select") this.colunasSelecionadas = colunas ?? "";
    return this;
  }

  insert(valores: Linha): this {
    this.op = "insert";
    this.valores = valores;
    return this;
  }

  update(valores: Linha): this {
    this.op = "update";
    this.valores = valores;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  eq(coluna: string, valor: unknown): this {
    this.filtros.push((l) => l[coluna] === valor);
    return this;
  }

  gte(coluna: string, valor: unknown): this {
    this.filtros.push((l) => String(l[coluna] ?? "") >= String(valor));
    return this;
  }

  order(coluna: string, opcoes?: { ascending?: boolean }): this {
    this.ordem = { coluna, asc: opcoes?.ascending !== false };
    return this;
  }

  limit(n: number): this {
    this.limite = n;
    return this;
  }

  private casadas(): Linha[] {
    let linhas = this.banco.tabela(this.nome).filter((l) => this.filtros.every((f) => f(l)));
    if (this.ordem) {
      const { coluna, asc } = this.ordem;
      linhas = [...linhas].sort((a, b) => {
        const x = a[coluna] as number | string;
        const y = b[coluna] as number | string;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    return this.limite === null ? linhas : linhas.slice(0, this.limite);
  }

  private executar(): { linhas: Linha[]; error: Erro | null } {
    const falha = this.banco.lancarEm[this.nome];
    if (falha) throw new Error(falha);

    if (this.op === "select") {
      const ausentes = this.banco.colunasInexistentes[this.nome] ?? [];
      const citadas = this.colunasSelecionadas.split(",").map((c) => c.trim());
      if (ausentes.some((c) => citadas.includes(c))) {
        return { linhas: [], error: { code: "42703", message: `column ${this.nome}.${ausentes[0]} does not exist` } };
      }
    }

    if (this.op === "insert") {
      // O PostgREST aceita uma linha ou uma lista de linhas no mesmo insert.
      const entradas = (Array.isArray(this.valores) ? this.valores : [this.valores]) as Linha[];
      const inseridas: Linha[] = [];
      for (const entrada of entradas) {
        const nova: Linha = { ...(PADROES[this.nome]?.() ?? {}), ...entrada, id: this.banco.proximoId(this.nome) };
        for (const colunas of UNICAS[this.nome] ?? []) {
          const valores = colunas.map((c) => nova[c]);
          if (valores.some((v) => v === null || v === undefined)) continue;
          const duplicada = this.banco
            .tabela(this.nome)
            .some((l) => colunas.every((c, i) => l[c] === valores[i]));
          if (duplicada) {
            return {
              linhas: [],
              error: { code: "23505", message: `duplicate key value violates unique constraint (${colunas.join(",")})` },
            };
          }
        }
        this.banco.tabela(this.nome).push(nova);
        inseridas.push(nova);
      }
      return { linhas: inseridas, error: null };
    }

    if (this.op === "update") {
      const alvo = this.casadas();
      for (const l of alvo) Object.assign(l, this.valores);
      return { linhas: alvo, error: null };
    }

    if (this.op === "delete") {
      const alvo = new Set(this.casadas());
      this.banco.tabelas[this.nome] = this.banco.tabela(this.nome).filter((l) => !alvo.has(l));
      return { linhas: [...alvo], error: null };
    }

    return { linhas: this.casadas(), error: null };
  }

  async maybeSingle(): Promise<{ data: Linha | null; error: Erro | null }> {
    if (this.op === "select" && (this.banco.leiturasCegas[this.nome] ?? 0) > 0) {
      this.banco.leiturasCegas[this.nome]! -= 1;
      return { data: null, error: null };
    }
    const { linhas, error } = this.executar();
    if (error) return { data: null, error };
    if (linhas.length > 1) {
      return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple rows returned" } };
    }
    return { data: linhas[0] ?? null, error: null };
  }

  then<R1 = { data: unknown; error: Erro | null }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: Erro | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const { linhas, error } = this.executar();
    return Promise.resolve({ data: linhas, error }).then(onfulfilled, onrejected);
  }
}
