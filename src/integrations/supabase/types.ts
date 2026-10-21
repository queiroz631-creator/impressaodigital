export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      acabamentos: {
        Row: {
          ativo: boolean;
          cobranca: string;
          created_at: string;
          faixas: NonNullable<Json>;
          id: string;
          mostrar_nao_incluso: boolean;
          mostrar_no_orcamento: boolean;
          nome: string;
          ordem: number;
          paginas_bloco: number;
          tipo_impressao: string;
          updated_at: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          cobranca?: string;
          created_at?: string;
          faixas?: NonNullable<Json>;
          id?: string;
          mostrar_nao_incluso?: boolean;
          mostrar_no_orcamento?: boolean;
          nome: string;
          ordem?: number;
          paginas_bloco?: number;
          tipo_impressao?: string;
          updated_at?: string;
          valor?: number;
        };
        Update: {
          ativo?: boolean;
          cobranca?: string;
          created_at?: string;
          faixas?: NonNullable<Json>;
          id?: string;
          mostrar_nao_incluso?: boolean;
          mostrar_no_orcamento?: boolean;
          nome?: string;
          ordem?: number;
          paginas_bloco?: number;
          tipo_impressao?: string;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [];
      };
      agente_aprovacoes: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          decidido_em: string | null;
          decidido_por: string | null;
          execucao_id: string;
          expira_em: string | null;
          id: string;
          motivo: string | null;
          parametros: NonNullable<Json>;
          parametros_hash: string;
          passo_id: string | null;
          solicitado_em: string;
          solicitado_por: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          decidido_em?: string | null;
          decidido_por?: string | null;
          execucao_id: string;
          expira_em?: string | null;
          id?: string;
          motivo?: string | null;
          parametros?: NonNullable<Json>;
          parametros_hash: string;
          passo_id?: string | null;
          solicitado_em?: string;
          solicitado_por?: string | null;
          status?: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          decidido_em?: string | null;
          decidido_por?: string | null;
          execucao_id?: string;
          expira_em?: string | null;
          id?: string;
          motivo?: string | null;
          parametros?: NonNullable<Json>;
          parametros_hash?: string;
          passo_id?: string | null;
          solicitado_em?: string;
          solicitado_por?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agente_aprovacoes_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_aprovacoes_passo_id_fkey";
            columns: ["passo_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucao_passos";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_auditoria: {
        Row: {
          acao: string;
          agente_id: string | null;
          criado_em: string;
          dados: NonNullable<Json>;
          entidade: string | null;
          entidade_id: string | null;
          execucao_id: string | null;
          id: string;
          ip: string | null;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          agente_id?: string | null;
          criado_em?: string;
          dados?: NonNullable<Json>;
          entidade?: string | null;
          entidade_id?: string | null;
          execucao_id?: string | null;
          id?: string;
          ip?: string | null;
          usuario_id?: string | null;
        };
        Update: {
          acao?: string;
          agente_id?: string | null;
          criado_em?: string;
          dados?: NonNullable<Json>;
          entidade?: string | null;
          entidade_id?: string | null;
          execucao_id?: string | null;
          id?: string;
          ip?: string | null;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agente_auditoria_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_auditoria_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_alertas: {
        Row: {
          atualizado_em: string;
          chave_dedup: string;
          criado_em: string;
          dados: NonNullable<Json>;
          descricao: string | null;
          id: string;
          origem: string;
          reconhecido_em: string | null;
          reconhecido_por: string | null;
          referencia_id: string | null;
          referencia_tipo: string | null;
          resolvido_em: string | null;
          severidade: string;
          status: string;
          tipo: string;
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          chave_dedup: string;
          criado_em?: string;
          dados?: NonNullable<Json>;
          descricao?: string | null;
          id?: string;
          origem: string;
          reconhecido_em?: string | null;
          reconhecido_por?: string | null;
          referencia_id?: string | null;
          referencia_tipo?: string | null;
          resolvido_em?: string | null;
          severidade: string;
          status?: string;
          tipo: string;
          titulo: string;
        };
        Update: {
          atualizado_em?: string;
          chave_dedup?: string;
          criado_em?: string;
          dados?: NonNullable<Json>;
          descricao?: string | null;
          id?: string;
          origem?: string;
          reconhecido_em?: string | null;
          reconhecido_por?: string | null;
          referencia_id?: string | null;
          referencia_tipo?: string | null;
          resolvido_em?: string | null;
          severidade?: string;
          status?: string;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [];
      };
      agente_automacoes: {
        Row: {
          acao: NonNullable<Json>;
          agente_id: string;
          ativo: boolean;
          atualizado_em: string;
          condicoes: NonNullable<Json>;
          criado_em: string;
          criado_por: string | null;
          cron: string | null;
          descricao: string | null;
          desativar_apos_falhas: number;
          dias_semana: number[];
          evento: string | null;
          executar_em: string | null;
          falhas_consecutivas: number;
          ferramentas_permitidas: string[];
          frequencia: string | null;
          fuso: string;
          hora_local: string | null;
          id: string;
          intervalo_minutos: number | null;
          max_tentativas: number;
          nome: string;
          proxima_execucao_em: string | null;
          tipo_gatilho: string;
          tolerancia_minutos: number;
          ultima_execucao_em: string | null;
          ultimo_erro: string | null;
          ultimo_status: string | null;
        };
        ComputedFields: never;
        Insert: {
          acao?: NonNullable<Json>;
          agente_id: string;
          ativo?: boolean;
          atualizado_em?: string;
          condicoes?: NonNullable<Json>;
          criado_em?: string;
          criado_por?: string | null;
          cron?: string | null;
          descricao?: string | null;
          desativar_apos_falhas?: number;
          dias_semana?: number[];
          evento?: string | null;
          executar_em?: string | null;
          falhas_consecutivas?: number;
          ferramentas_permitidas?: string[];
          frequencia?: string | null;
          fuso?: string;
          hora_local?: string | null;
          id?: string;
          intervalo_minutos?: number | null;
          max_tentativas?: number;
          nome: string;
          proxima_execucao_em?: string | null;
          tipo_gatilho: string;
          tolerancia_minutos?: number;
          ultima_execucao_em?: string | null;
          ultimo_erro?: string | null;
          ultimo_status?: string | null;
        };
        Update: {
          acao?: NonNullable<Json>;
          agente_id?: string;
          ativo?: boolean;
          atualizado_em?: string;
          condicoes?: NonNullable<Json>;
          criado_em?: string;
          criado_por?: string | null;
          cron?: string | null;
          descricao?: string | null;
          desativar_apos_falhas?: number;
          dias_semana?: number[];
          evento?: string | null;
          executar_em?: string | null;
          falhas_consecutivas?: number;
          ferramentas_permitidas?: string[];
          frequencia?: string | null;
          fuso?: string;
          hora_local?: string | null;
          id?: string;
          intervalo_minutos?: number | null;
          max_tentativas?: number;
          nome?: string;
          proxima_execucao_em?: string | null;
          tipo_gatilho?: string;
          tolerancia_minutos?: number;
          ultima_execucao_em?: string | null;
          ultimo_erro?: string | null;
          ultimo_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agente_automacoes_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_comandos_locais: {
        Row: {
          atualizado_em: string;
          concluido_em: string | null;
          criado_em: string;
          dispositivo_id: string;
          entregue_em: string | null;
          erro: string | null;
          execucao_id: string | null;
          expira_em: string | null;
          id: string;
          idempotency_key: string | null;
          passo_id: string | null;
          payload: NonNullable<Json>;
          requer_confirmacao: boolean;
          resultado: Json | null;
          sensivel: boolean;
          status: string;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          concluido_em?: string | null;
          criado_em?: string;
          dispositivo_id: string;
          entregue_em?: string | null;
          erro?: string | null;
          execucao_id?: string | null;
          expira_em?: string | null;
          id?: string;
          idempotency_key?: string | null;
          passo_id?: string | null;
          payload?: NonNullable<Json>;
          requer_confirmacao?: boolean;
          resultado?: Json | null;
          sensivel?: boolean;
          status?: string;
          tipo: string;
        };
        Update: {
          atualizado_em?: string;
          concluido_em?: string | null;
          criado_em?: string;
          dispositivo_id?: string;
          entregue_em?: string | null;
          erro?: string | null;
          execucao_id?: string | null;
          expira_em?: string | null;
          id?: string;
          idempotency_key?: string | null;
          passo_id?: string | null;
          payload?: NonNullable<Json>;
          requer_confirmacao?: boolean;
          resultado?: Json | null;
          sensivel?: boolean;
          status?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agente_comandos_locais_dispositivo_id_fkey";
            columns: ["dispositivo_id"];
            isOneToOne: false;
            referencedRelation: "agente_dispositivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_comandos_locais_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_comandos_locais_passo_id_fkey";
            columns: ["passo_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucao_passos";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_dispositivos: {
        Row: {
          agente_id: string | null;
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          id: string;
          nome: string;
          token_hash: string;
          ultimo_ping: string | null;
          versao: string | null;
        };
        ComputedFields: never;
        Insert: {
          agente_id?: string | null;
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          token_hash: string;
          ultimo_ping?: string | null;
          versao?: string | null;
        };
        Update: {
          agente_id?: string | null;
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          token_hash?: string;
          ultimo_ping?: string | null;
          versao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agente_dispositivos_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_execucao_passos: {
        Row: {
          atualizado_em: string;
          concluido_em: string | null;
          criado_em: string;
          descricao: string;
          erro: string | null;
          execucao_id: string;
          ferramenta_id: string | null;
          id: string;
          iniciado_em: string | null;
          ordem: number;
          parametros: NonNullable<Json>;
          parametros_hash: string | null;
          resultado: Json | null;
          status: string;
          tentativas: number;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          concluido_em?: string | null;
          criado_em?: string;
          descricao?: string;
          erro?: string | null;
          execucao_id: string;
          ferramenta_id?: string | null;
          id?: string;
          iniciado_em?: string | null;
          ordem: number;
          parametros?: NonNullable<Json>;
          parametros_hash?: string | null;
          resultado?: Json | null;
          status?: string;
          tentativas?: number;
          tipo: string;
        };
        Update: {
          atualizado_em?: string;
          concluido_em?: string | null;
          criado_em?: string;
          descricao?: string;
          erro?: string | null;
          execucao_id?: string;
          ferramenta_id?: string | null;
          id?: string;
          iniciado_em?: string | null;
          ordem?: number;
          parametros?: NonNullable<Json>;
          parametros_hash?: string | null;
          resultado?: Json | null;
          status?: string;
          tentativas?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agente_execucao_passos_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_execucao_passos_ferramenta_id_fkey";
            columns: ["ferramenta_id"];
            isOneToOne: false;
            referencedRelation: "agente_ferramentas";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_execucoes: {
        Row: {
          agente_id: string;
          atualizado_em: string;
          concluido_em: string | null;
          conversa_id: string | null;
          criado_em: string;
          custo_estimado: number | null;
          entrada: NonNullable<Json>;
          erro: string | null;
          id: string;
          idempotency_key: string | null;
          iniciado_em: string | null;
          modelo_usado: string | null;
          origem: string;
          parent_execucao_id: string | null;
          profundidade: number;
          saida: Json | null;
          status: string;
          tokens_entrada: number;
          tokens_saida: number;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          agente_id: string;
          atualizado_em?: string;
          concluido_em?: string | null;
          conversa_id?: string | null;
          criado_em?: string;
          custo_estimado?: number | null;
          entrada?: NonNullable<Json>;
          erro?: string | null;
          id?: string;
          idempotency_key?: string | null;
          iniciado_em?: string | null;
          modelo_usado?: string | null;
          origem?: string;
          parent_execucao_id?: string | null;
          profundidade?: number;
          saida?: Json | null;
          status?: string;
          tokens_entrada?: number;
          tokens_saida?: number;
          usuario_id?: string | null;
        };
        Update: {
          agente_id?: string;
          atualizado_em?: string;
          concluido_em?: string | null;
          conversa_id?: string | null;
          criado_em?: string;
          custo_estimado?: number | null;
          entrada?: NonNullable<Json>;
          erro?: string | null;
          id?: string;
          idempotency_key?: string | null;
          iniciado_em?: string | null;
          modelo_usado?: string | null;
          origem?: string;
          parent_execucao_id?: string | null;
          profundidade?: number;
          saida?: Json | null;
          status?: string;
          tokens_entrada?: number;
          tokens_saida?: number;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agente_execucoes_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_execucoes_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conversas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_execucoes_parent_execucao_id_fkey";
            columns: ["parent_execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_ferramenta_vinculos: {
        Row: {
          agente_id: string;
          ativo: boolean;
          atualizado_em: string;
          config: NonNullable<Json>;
          criado_em: string;
          ferramenta_id: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          agente_id: string;
          ativo?: boolean;
          atualizado_em?: string;
          config?: NonNullable<Json>;
          criado_em?: string;
          ferramenta_id: string;
          id?: string;
        };
        Update: {
          agente_id?: string;
          ativo?: boolean;
          atualizado_em?: string;
          config?: NonNullable<Json>;
          criado_em?: string;
          ferramenta_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agente_ferramenta_vinculos_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_ferramenta_vinculos_ferramenta_id_fkey";
            columns: ["ferramenta_id"];
            isOneToOne: false;
            referencedRelation: "agente_ferramentas";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_ferramentas: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          categoria: string;
          chave: string;
          criado_em: string;
          descricao: string;
          efeito_externo: boolean;
          id: string;
          idempotente: boolean;
          nome: string;
          parametros_schema: NonNullable<Json>;
          resultado_schema: NonNullable<Json>;
          risco: string;
          sensivel: boolean;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string;
          chave: string;
          criado_em?: string;
          descricao?: string;
          efeito_externo?: boolean;
          id?: string;
          idempotente?: boolean;
          nome: string;
          parametros_schema?: NonNullable<Json>;
          resultado_schema?: NonNullable<Json>;
          risco?: string;
          sensivel?: boolean;
          tipo?: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string;
          chave?: string;
          criado_em?: string;
          descricao?: string;
          efeito_externo?: boolean;
          id?: string;
          idempotente?: boolean;
          nome?: string;
          parametros_schema?: NonNullable<Json>;
          resultado_schema?: NonNullable<Json>;
          risco?: string;
          sensivel?: boolean;
          tipo?: string;
        };
        Relationships: [];
      };
      agente_idempotencia: {
        Row: {
          agente_id: string | null;
          atualizado_em: string;
          chave: string;
          criado_em: string;
          escopo: string;
          execucao_id: string | null;
          ferramenta_id: string | null;
          id: string;
          passo_id: string | null;
          resolvido_em: string | null;
          resultado: Json | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          agente_id?: string | null;
          atualizado_em?: string;
          chave: string;
          criado_em?: string;
          escopo?: string;
          execucao_id?: string | null;
          ferramenta_id?: string | null;
          id?: string;
          passo_id?: string | null;
          resolvido_em?: string | null;
          resultado?: Json | null;
          status?: string;
        };
        Update: {
          agente_id?: string | null;
          atualizado_em?: string;
          chave?: string;
          criado_em?: string;
          escopo?: string;
          execucao_id?: string | null;
          ferramenta_id?: string | null;
          id?: string;
          passo_id?: string | null;
          resolvido_em?: string | null;
          resultado?: Json | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agente_idempotencia_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_idempotencia_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_idempotencia_ferramenta_id_fkey";
            columns: ["ferramenta_id"];
            isOneToOne: false;
            referencedRelation: "agente_ferramentas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_idempotencia_passo_id_fkey";
            columns: ["passo_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucao_passos";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_mensagens: {
        Row: {
          conteudo: NonNullable<Json>;
          criado_em: string;
          de_agente_id: string;
          execucao_id: string | null;
          id: string;
          lida_em: string | null;
          para_agente_id: string;
          profundidade: number;
        };
        ComputedFields: never;
        Insert: {
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          de_agente_id: string;
          execucao_id?: string | null;
          id?: string;
          lida_em?: string | null;
          para_agente_id: string;
          profundidade?: number;
        };
        Update: {
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          de_agente_id?: string;
          execucao_id?: string | null;
          id?: string;
          lida_em?: string | null;
          para_agente_id?: string;
          profundidade?: number;
        };
        Relationships: [
          {
            foreignKeyName: "agente_mensagens_de_agente_id_fkey";
            columns: ["de_agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_mensagens_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_mensagens_para_agente_id_fkey";
            columns: ["para_agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_tarefas: {
        Row: {
          agendado_para: string;
          agente_id: string;
          atualizado_em: string;
          criado_em: string;
          execucao_id: string | null;
          id: string;
          idempotency_key: string | null;
          lease_ate: string | null;
          max_tentativas: number;
          payload: NonNullable<Json>;
          prioridade: number;
          reservado_por: string | null;
          status: string;
          tentativas: number;
          tipo: string;
          ultimo_erro: string | null;
        };
        ComputedFields: never;
        Insert: {
          agendado_para?: string;
          agente_id: string;
          atualizado_em?: string;
          criado_em?: string;
          execucao_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          lease_ate?: string | null;
          max_tentativas?: number;
          payload?: NonNullable<Json>;
          prioridade?: number;
          reservado_por?: string | null;
          status?: string;
          tentativas?: number;
          tipo?: string;
          ultimo_erro?: string | null;
        };
        Update: {
          agendado_para?: string;
          agente_id?: string;
          atualizado_em?: string;
          criado_em?: string;
          execucao_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          lease_ate?: string | null;
          max_tentativas?: number;
          payload?: NonNullable<Json>;
          prioridade?: number;
          reservado_por?: string | null;
          status?: string;
          tentativas?: number;
          tipo?: string;
          ultimo_erro?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agente_tarefas_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agente_tarefas_execucao_id_fkey";
            columns: ["execucao_id"];
            isOneToOne: false;
            referencedRelation: "agente_execucoes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_versoes: {
        Row: {
          agente_id: string;
          ativo: boolean;
          conteudo: NonNullable<Json>;
          criado_em: string;
          criado_por: string | null;
          id: string;
          observacao: string;
          tipo: string;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          agente_id: string;
          ativo?: boolean;
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          observacao?: string;
          tipo: string;
          versao: number;
        };
        Update: {
          agente_id?: string;
          ativo?: boolean;
          conteudo?: NonNullable<Json>;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          observacao?: string;
          tipo?: string;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "agente_versoes_agente_id_fkey";
            columns: ["agente_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
        ];
      };
      agente_worker_heartbeats: {
        Row: {
          criado_em: string;
          hostname: string | null;
          id: string;
          processos: number;
          status: string;
          ultimo_ping: string;
          versao: string | null;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          hostname?: string | null;
          id?: string;
          processos?: number;
          status?: string;
          ultimo_ping?: string;
          versao?: string | null;
          worker_id: string;
        };
        Update: {
          criado_em?: string;
          hostname?: string | null;
          id?: string;
          processos?: number;
          status?: string;
          ultimo_ping?: string;
          versao?: string | null;
          worker_id?: string;
        };
        Relationships: [];
      };
      agentes: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          chave: string;
          config: NonNullable<Json>;
          criado_em: string;
          criado_por: string | null;
          descricao: string;
          icone: string;
          id: string;
          modelo: string | null;
          nome: string;
          ordem: number;
          rota_painel: string | null;
          system_prompt_atual_id: string | null;
          temperatura: number | null;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          chave: string;
          config?: NonNullable<Json>;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string;
          icone?: string;
          id?: string;
          modelo?: string | null;
          nome: string;
          ordem?: number;
          rota_painel?: string | null;
          system_prompt_atual_id?: string | null;
          temperatura?: number | null;
          tipo?: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          chave?: string;
          config?: NonNullable<Json>;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string;
          icone?: string;
          id?: string;
          modelo?: string | null;
          nome?: string;
          ordem?: number;
          rota_painel?: string | null;
          system_prompt_atual_id?: string | null;
          temperatura?: number | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agentes_prompt_atual_fk";
            columns: ["system_prompt_atual_id"];
            isOneToOne: false;
            referencedRelation: "agente_versoes";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_fluxo_etapas: {
        Row: {
          acao: string;
          ativo: boolean;
          configuracao: NonNullable<Json>;
          created_at: string;
          destino_fluxo_id: string | null;
          espera_segundos: number;
          fluxo_id: string;
          id: string;
          mensagem: string;
          midia_nome: string | null;
          midia_url: string | null;
          modo_avanco: string;
          nome: string;
          ordem: number;
          proxima_etapa_id: string | null;
          tipo_mensagem: string;
          tipo_resposta: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          acao?: string;
          ativo?: boolean;
          configuracao?: NonNullable<Json>;
          created_at?: string;
          destino_fluxo_id?: string | null;
          espera_segundos?: number;
          fluxo_id: string;
          id?: string;
          mensagem?: string;
          midia_nome?: string | null;
          midia_url?: string | null;
          modo_avanco?: string;
          nome: string;
          ordem?: number;
          proxima_etapa_id?: string | null;
          tipo_mensagem?: string;
          tipo_resposta?: string;
          updated_at?: string;
        };
        Update: {
          acao?: string;
          ativo?: boolean;
          configuracao?: NonNullable<Json>;
          created_at?: string;
          destino_fluxo_id?: string | null;
          espera_segundos?: number;
          fluxo_id?: string;
          id?: string;
          mensagem?: string;
          midia_nome?: string | null;
          midia_url?: string | null;
          modo_avanco?: string;
          nome?: string;
          ordem?: number;
          proxima_etapa_id?: string | null;
          tipo_mensagem?: string;
          tipo_resposta?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_fluxo_etapas_destino_fluxo_id_fkey";
            columns: ["destino_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_fluxo_etapas_fluxo_id_fkey";
            columns: ["fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_fluxo_etapas_proxima_etapa_id_fkey";
            columns: ["proxima_etapa_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxo_etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_fluxo_opcoes: {
        Row: {
          acao: string;
          ativo: boolean;
          configuracao: NonNullable<Json>;
          created_at: string;
          destino_etapa_id: string | null;
          destino_fluxo_id: string | null;
          etapa_id: string;
          id: string;
          ordem: number;
          titulo: string;
          updated_at: string;
          valor: string;
        };
        ComputedFields: never;
        Insert: {
          acao?: string;
          ativo?: boolean;
          configuracao?: NonNullable<Json>;
          created_at?: string;
          destino_etapa_id?: string | null;
          destino_fluxo_id?: string | null;
          etapa_id: string;
          id?: string;
          ordem?: number;
          titulo: string;
          updated_at?: string;
          valor?: string;
        };
        Update: {
          acao?: string;
          ativo?: boolean;
          configuracao?: NonNullable<Json>;
          created_at?: string;
          destino_etapa_id?: string | null;
          destino_fluxo_id?: string | null;
          etapa_id?: string;
          id?: string;
          ordem?: number;
          titulo?: string;
          updated_at?: string;
          valor?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_fluxo_opcoes_destino_etapa_id_fkey";
            columns: ["destino_etapa_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxo_etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_fluxo_opcoes_destino_fluxo_id_fkey";
            columns: ["destino_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_fluxo_opcoes_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxo_etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_fluxos: {
        Row: {
          ativo: boolean;
          conexao_id: string | null;
          created_at: string;
          descricao: string;
          finalizacao_delay_minutos: number;
          icone: string;
          id: string;
          mensagem_inicial: string;
          mensagem_unica: boolean;
          mostrar_finalizacao: boolean;
          nome: string;
          ordem: number;
          sem_resposta_acao: string;
          sem_resposta_fluxo_id: string | null;
          sem_resposta_mensagem: string;
          sem_resposta_minutos: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          descricao?: string;
          finalizacao_delay_minutos?: number;
          icone?: string;
          id?: string;
          mensagem_inicial?: string;
          mensagem_unica?: boolean;
          mostrar_finalizacao?: boolean;
          nome: string;
          ordem?: number;
          sem_resposta_acao?: string;
          sem_resposta_fluxo_id?: string | null;
          sem_resposta_mensagem?: string;
          sem_resposta_minutos?: number;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          descricao?: string;
          finalizacao_delay_minutos?: number;
          icone?: string;
          id?: string;
          mensagem_inicial?: string;
          mensagem_unica?: boolean;
          mostrar_finalizacao?: boolean;
          nome?: string;
          ordem?: number;
          sem_resposta_acao?: string;
          sem_resposta_fluxo_id?: string | null;
          sem_resposta_mensagem?: string;
          sem_resposta_minutos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_fluxos_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_fluxos_sem_resposta_fluxo_id_fkey";
            columns: ["sem_resposta_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_horarios: {
        Row: {
          abre: string;
          conexao_id: string | null;
          created_at: string;
          dia_semana: number;
          fecha: string;
          fechado: boolean;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          abre?: string;
          conexao_id?: string | null;
          created_at?: string;
          dia_semana: number;
          fecha?: string;
          fechado?: boolean;
          id?: string;
          updated_at?: string;
        };
        Update: {
          abre?: string;
          conexao_id?: string | null;
          created_at?: string;
          dia_semana?: number;
          fecha?: string;
          fechado?: boolean;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_horarios_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_menu_opcoes: {
        Row: {
          acao: string;
          ativo: boolean;
          conexao_id: string | null;
          created_at: string;
          id: string;
          mensagem: string;
          nome: string;
          ordem: number;
          permitir_palavra_chave: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          acao?: string;
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          id?: string;
          mensagem?: string;
          nome: string;
          ordem?: number;
          permitir_palavra_chave?: boolean;
          updated_at?: string;
        };
        Update: {
          acao?: string;
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          id?: string;
          mensagem?: string;
          nome?: string;
          ordem?: number;
          permitir_palavra_chave?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_menu_opcoes_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_numeros: {
        Row: {
          ativo: boolean;
          conexao_id: string | null;
          created_at: string;
          id: string;
          nome: string | null;
          observacao: string | null;
          permitido: boolean;
          telefone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          id?: string;
          nome?: string | null;
          observacao?: string | null;
          permitido?: boolean;
          telefone: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          id?: string;
          nome?: string | null;
          observacao?: string | null;
          permitido?: boolean;
          telefone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_numeros_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_palavras_chave: {
        Row: {
          created_at: string;
          id: string;
          opcao_id: string | null;
          resposta_id: string | null;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          opcao_id?: string | null;
          resposta_id?: string | null;
          texto: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          opcao_id?: string | null;
          resposta_id?: string | null;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_palavras_chave_opcao_id_fkey";
            columns: ["opcao_id"];
            isOneToOne: false;
            referencedRelation: "bot_menu_opcoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_palavras_chave_resposta_id_fkey";
            columns: ["resposta_id"];
            isOneToOne: false;
            referencedRelation: "bot_respostas";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_primeiro_contato: {
        Row: {
          acao: string;
          ativo: boolean;
          condicao: string;
          conexao_id: string | null;
          created_at: string;
          delay_mensagem_segundos: number;
          delay_segundos: number;
          destino_fluxo_id: string | null;
          destino_resposta_id: string | null;
          enviar_mensagem: string;
          id: string;
          mensagem: string;
          nome: string;
          ordem: number;
          palavras: string[];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          acao?: string;
          ativo?: boolean;
          condicao?: string;
          conexao_id?: string | null;
          created_at?: string;
          delay_mensagem_segundos?: number;
          delay_segundos?: number;
          destino_fluxo_id?: string | null;
          destino_resposta_id?: string | null;
          enviar_mensagem?: string;
          id?: string;
          mensagem?: string;
          nome?: string;
          ordem?: number;
          palavras?: string[];
          updated_at?: string;
        };
        Update: {
          acao?: string;
          ativo?: boolean;
          condicao?: string;
          conexao_id?: string | null;
          created_at?: string;
          delay_mensagem_segundos?: number;
          delay_segundos?: number;
          destino_fluxo_id?: string | null;
          destino_resposta_id?: string | null;
          enviar_mensagem?: string;
          id?: string;
          mensagem?: string;
          nome?: string;
          ordem?: number;
          palavras?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_primeiro_contato_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_primeiro_contato_destino_fluxo_id_fkey";
            columns: ["destino_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_primeiro_contato_destino_resposta_id_fkey";
            columns: ["destino_resposta_id"];
            isOneToOne: false;
            referencedRelation: "bot_respostas";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_respostas: {
        Row: {
          acao_nao: string;
          acao_sim: string;
          ativo: boolean;
          conexao_id: string | null;
          created_at: string;
          delay_acao_segundos: number;
          destino_nao_fluxo_id: string | null;
          destino_nao_resposta_id: string | null;
          destino_sim_fluxo_id: string | null;
          destino_sim_resposta_id: string | null;
          id: string;
          midia_nome: string | null;
          midia_url: string | null;
          ordem: number;
          pergunta_confirmacao: string;
          resposta: string;
          resposta_retorno_dia: string;
          tipo_midia: string;
          titulo: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          acao_nao?: string;
          acao_sim?: string;
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          delay_acao_segundos?: number;
          destino_nao_fluxo_id?: string | null;
          destino_nao_resposta_id?: string | null;
          destino_sim_fluxo_id?: string | null;
          destino_sim_resposta_id?: string | null;
          id?: string;
          midia_nome?: string | null;
          midia_url?: string | null;
          ordem?: number;
          pergunta_confirmacao?: string;
          resposta?: string;
          resposta_retorno_dia?: string;
          tipo_midia?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          acao_nao?: string;
          acao_sim?: string;
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          delay_acao_segundos?: number;
          destino_nao_fluxo_id?: string | null;
          destino_nao_resposta_id?: string | null;
          destino_sim_fluxo_id?: string | null;
          destino_sim_resposta_id?: string | null;
          id?: string;
          midia_nome?: string | null;
          midia_url?: string | null;
          ordem?: number;
          pergunta_confirmacao?: string;
          resposta?: string;
          resposta_retorno_dia?: string;
          tipo_midia?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_respostas_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_respostas_destino_nao_fluxo_id_fkey";
            columns: ["destino_nao_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_respostas_destino_nao_resposta_id_fkey";
            columns: ["destino_nao_resposta_id"];
            isOneToOne: false;
            referencedRelation: "bot_respostas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_respostas_destino_sim_fluxo_id_fkey";
            columns: ["destino_sim_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_respostas_destino_sim_resposta_id_fkey";
            columns: ["destino_sim_resposta_id"];
            isOneToOne: false;
            referencedRelation: "bot_respostas";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_status_whatsapp: {
        Row: {
          agendado_em: string | null;
          ativo: boolean;
          conexao_id: string | null;
          cor_fundo: string;
          created_at: string;
          dias_semana: number[];
          hora: string | null;
          id: string;
          imagem_nome: string | null;
          imagem_url: string | null;
          legenda: string;
          modo: string;
          texto: string;
          tipo: string;
          ultima_publicacao_em: string | null;
          ultimo_erro: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agendado_em?: string | null;
          ativo?: boolean;
          conexao_id?: string | null;
          cor_fundo?: string;
          created_at?: string;
          dias_semana?: number[];
          hora?: string | null;
          id?: string;
          imagem_nome?: string | null;
          imagem_url?: string | null;
          legenda?: string;
          modo?: string;
          texto?: string;
          tipo?: string;
          ultima_publicacao_em?: string | null;
          ultimo_erro?: string | null;
          updated_at?: string;
        };
        Update: {
          agendado_em?: string | null;
          ativo?: boolean;
          conexao_id?: string | null;
          cor_fundo?: string;
          created_at?: string;
          dias_semana?: number[];
          hora?: string | null;
          id?: string;
          imagem_nome?: string | null;
          imagem_url?: string | null;
          legenda?: string;
          modo?: string;
          texto?: string;
          tipo?: string;
          ultima_publicacao_em?: string | null;
          ultimo_erro?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_status_whatsapp_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
        ];
      };
      calculo_itens: {
        Row: {
          calculo_id: string;
          id: string;
          material_id: string | null;
          material_nome: string;
          quantidade_color: number;
          quantidade_pb: number;
          total: number;
          total_color: number;
          total_pb: number;
          valor_unitario_color: number;
          valor_unitario_pb: number;
        };
        ComputedFields: never;
        Insert: {
          calculo_id: string;
          id?: string;
          material_id?: string | null;
          material_nome?: string;
          quantidade_color?: number;
          quantidade_pb?: number;
          total?: number;
          total_color?: number;
          total_pb?: number;
          valor_unitario_color?: number;
          valor_unitario_pb?: number;
        };
        Update: {
          calculo_id?: string;
          id?: string;
          material_id?: string | null;
          material_nome?: string;
          quantidade_color?: number;
          quantidade_pb?: number;
          total?: number;
          total_color?: number;
          total_pb?: number;
          valor_unitario_color?: number;
          valor_unitario_pb?: number;
        };
        Relationships: [
          {
            foreignKeyName: "calculo_itens_calculo_id_fkey";
            columns: ["calculo_id"];
            isOneToOne: false;
            referencedRelation: "calculos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calculo_itens_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
            referencedColumns: ["id"];
          },
        ];
      };
      calculos: {
        Row: {
          acabamentos: NonNullable<Json>;
          cliente_nome: string | null;
          cliente_telefone: string | null;
          created_at: string;
          frente_verso: boolean;
          id: string;
          material_nome: string | null;
          observacao: string | null;
          paginas_adicionais: number;
          paginas_color: number;
          paginas_pb: number;
          paginas_total: number;
          quantidade_arquivos: number;
          tamanho: string;
          tipo_impressao: string;
          usuario_id: string;
          valor_acabamento: number;
          valor_total: number;
        };
        ComputedFields: never;
        Insert: {
          acabamentos?: NonNullable<Json>;
          cliente_nome?: string | null;
          cliente_telefone?: string | null;
          created_at?: string;
          frente_verso?: boolean;
          id?: string;
          material_nome?: string | null;
          observacao?: string | null;
          paginas_adicionais?: number;
          paginas_color?: number;
          paginas_pb?: number;
          paginas_total?: number;
          quantidade_arquivos?: number;
          tamanho?: string;
          tipo_impressao?: string;
          usuario_id?: string;
          valor_acabamento?: number;
          valor_total?: number;
        };
        Update: {
          acabamentos?: NonNullable<Json>;
          cliente_nome?: string | null;
          cliente_telefone?: string | null;
          created_at?: string;
          frente_verso?: boolean;
          id?: string;
          material_nome?: string | null;
          observacao?: string | null;
          paginas_adicionais?: number;
          paginas_color?: number;
          paginas_pb?: number;
          paginas_total?: number;
          quantidade_arquivos?: number;
          tamanho?: string;
          tipo_impressao?: string;
          usuario_id?: string;
          valor_acabamento?: number;
          valor_total?: number;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          cpf: string | null;
          created_at: string;
          data_nascimento: string | null;
          email: string | null;
          id: string;
          nome: string;
          observacao: string | null;
          origem_alteracao: string | null;
          origem_id: string | null;
          telefone: string | null;
          telefone_normalizado: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cpf?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          email?: string | null;
          id?: string;
          nome?: string;
          observacao?: string | null;
          origem_alteracao?: string | null;
          origem_id?: string | null;
          telefone?: string | null;
          telefone_normalizado?: string | null;
          updated_at?: string;
        };
        Update: {
          cpf?: string | null;
          created_at?: string;
          data_nascimento?: string | null;
          email?: string | null;
          id?: string;
          nome?: string;
          observacao?: string | null;
          origem_alteracao?: string | null;
          origem_id?: string | null;
          telefone?: string | null;
          telefone_normalizado?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      comunicacao_sites: {
        Row: {
          created_at: string;
          foto_url: string | null;
          icone: string;
          id: string;
          nome: string;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          foto_url?: string | null;
          icone?: string;
          id?: string;
          nome: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          foto_url?: string | null;
          icone?: string;
          id?: string;
          nome?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      configuracoes: {
        Row: {
          areas_impressao: NonNullable<Json>;
          email: string | null;
          empresa_nome: string;
          endereco: string | null;
          foto_express_logo_url: string | null;
          ia_modelo: string | null;
          ia_modelo_audio: string | null;
          ia_provedor: string;
          id: string;
          impressora_padrao_largura: number;
          impressora_padrao_nome: string | null;
          impressora_padrao_tipo: string;
          impressoras_padrao: NonNullable<Json>;
          instagram: string | null;
          logo_url: string | null;
          mensagem_prazo_orcamento: string;
          pix_ativo: boolean;
          pix_banco: string | null;
          pix_chave: string | null;
          pix_mensagem: string;
          pix_nome: string | null;
          rodape_orcamento: string;
          sorteio_logo_url: string | null;
          telefone: string | null;
          updated_at: string;
          validade_padrao_dias: number;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          areas_impressao?: NonNullable<Json>;
          email?: string | null;
          empresa_nome?: string;
          endereco?: string | null;
          foto_express_logo_url?: string | null;
          ia_modelo?: string | null;
          ia_modelo_audio?: string | null;
          ia_provedor?: string;
          id?: string;
          impressora_padrao_largura?: number;
          impressora_padrao_nome?: string | null;
          impressora_padrao_tipo?: string;
          impressoras_padrao?: NonNullable<Json>;
          instagram?: string | null;
          logo_url?: string | null;
          mensagem_prazo_orcamento?: string;
          pix_ativo?: boolean;
          pix_banco?: string | null;
          pix_chave?: string | null;
          pix_mensagem?: string;
          pix_nome?: string | null;
          rodape_orcamento?: string;
          sorteio_logo_url?: string | null;
          telefone?: string | null;
          updated_at?: string;
          validade_padrao_dias?: number;
          whatsapp?: string | null;
        };
        Update: {
          areas_impressao?: NonNullable<Json>;
          email?: string | null;
          empresa_nome?: string;
          endereco?: string | null;
          foto_express_logo_url?: string | null;
          ia_modelo?: string | null;
          ia_modelo_audio?: string | null;
          ia_provedor?: string;
          id?: string;
          impressora_padrao_largura?: number;
          impressora_padrao_nome?: string | null;
          impressora_padrao_tipo?: string;
          impressoras_padrao?: NonNullable<Json>;
          instagram?: string | null;
          logo_url?: string | null;
          mensagem_prazo_orcamento?: string;
          pix_ativo?: boolean;
          pix_banco?: string | null;
          pix_chave?: string | null;
          pix_mensagem?: string;
          pix_nome?: string | null;
          rodape_orcamento?: string;
          sorteio_logo_url?: string | null;
          telefone?: string | null;
          updated_at?: string;
          validade_padrao_dias?: number;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      curriculo_cursos: {
        Row: {
          ano: string | null;
          created_at: string;
          curriculo_id: string;
          id: string;
          instituicao: string | null;
          nome_curso: string;
          ordem: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ano?: string | null;
          created_at?: string;
          curriculo_id: string;
          id?: string;
          instituicao?: string | null;
          nome_curso: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          ano?: string | null;
          created_at?: string;
          curriculo_id?: string;
          id?: string;
          instituicao?: string | null;
          nome_curso?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculo_cursos_curriculo_id_fkey";
            columns: ["curriculo_id"];
            isOneToOne: false;
            referencedRelation: "curriculos";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculo_experiencias: {
        Row: {
          atividades: string | null;
          cargo: string | null;
          created_at: string;
          curriculo_id: string;
          empresa: string | null;
          id: string;
          ordem: number;
          periodo: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          atividades?: string | null;
          cargo?: string | null;
          created_at?: string;
          curriculo_id: string;
          empresa?: string | null;
          id?: string;
          ordem?: number;
          periodo?: string | null;
          updated_at?: string;
        };
        Update: {
          atividades?: string | null;
          cargo?: string | null;
          created_at?: string;
          curriculo_id?: string;
          empresa?: string | null;
          id?: string;
          ordem?: number;
          periodo?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculo_experiencias_curriculo_id_fkey";
            columns: ["curriculo_id"];
            isOneToOne: false;
            referencedRelation: "curriculos";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculo_formacoes: {
        Row: {
          ano: string | null;
          created_at: string;
          curriculo_id: string;
          id: string;
          instituicao: string | null;
          nivel: string | null;
          nome_curso: string;
          ordem: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ano?: string | null;
          created_at?: string;
          curriculo_id: string;
          id?: string;
          instituicao?: string | null;
          nivel?: string | null;
          nome_curso: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          ano?: string | null;
          created_at?: string;
          curriculo_id?: string;
          id?: string;
          instituicao?: string | null;
          nivel?: string | null;
          nome_curso?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculo_formacoes_curriculo_id_fkey";
            columns: ["curriculo_id"];
            isOneToOne: false;
            referencedRelation: "curriculos";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculo_habilidades: {
        Row: {
          created_at: string;
          curriculo_id: string;
          descricao: string;
          habilidade_id: string | null;
          id: string;
          ordem: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          curriculo_id: string;
          descricao: string;
          habilidade_id?: string | null;
          id?: string;
          ordem?: number;
        };
        Update: {
          created_at?: string;
          curriculo_id?: string;
          descricao?: string;
          habilidade_id?: string | null;
          id?: string;
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "curriculo_habilidades_curriculo_id_fkey";
            columns: ["curriculo_id"];
            isOneToOne: false;
            referencedRelation: "curriculos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "curriculo_habilidades_habilidade_id_fkey";
            columns: ["habilidade_id"];
            isOneToOne: false;
            referencedRelation: "habilidades_curriculo";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculo_links: {
        Row: {
          ativo: boolean;
          created_at: string;
          curriculo_id: string | null;
          expires_at: string;
          id: string;
          token: string;
          used_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          created_at?: string;
          curriculo_id?: string | null;
          expires_at: string;
          id?: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          curriculo_id?: string | null;
          expires_at?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "curriculo_links_curriculo_id_fkey";
            columns: ["curriculo_id"];
            isOneToOne: false;
            referencedRelation: "curriculos";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculo_telefones: {
        Row: {
          created_at: string;
          curriculo_id: string;
          id: string;
          ordem: number;
          telefone: string;
          tipo: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          curriculo_id: string;
          id?: string;
          ordem?: number;
          telefone: string;
          tipo?: string | null;
        };
        Update: {
          created_at?: string;
          curriculo_id?: string;
          id?: string;
          ordem?: number;
          telefone?: string;
          tipo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "curriculo_telefones_curriculo_id_fkey";
            columns: ["curriculo_id"];
            isOneToOne: false;
            referencedRelation: "curriculos";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculos: {
        Row: {
          bairro: string | null;
          categoria_habilitacao: string | null;
          cep: string | null;
          cidade: string | null;
          cliente_id: string | null;
          completed_at: string | null;
          cpf: string;
          created_at: string;
          curso_superior: string | null;
          data_nascimento: string | null;
          documentacao_completa: boolean | null;
          email: string | null;
          endereco: string | null;
          escolaridade: string | null;
          estado_civil: string | null;
          exibir_data_atualizacao: boolean;
          experiencia_frase: string | null;
          experiencia_possui: boolean;
          foto_exibir: boolean;
          foto_url: string | null;
          habilidades_observacao: string | null;
          habilitacao: boolean;
          id: string;
          nome_completo: string;
          numero: string | null;
          objetivo_texto: string | null;
          objetivo_tipo: string;
          pos_graduacao_nome: string | null;
          status: string;
          tamanho_fonte: number;
          telefone_principal: string;
          telefone_principal_descricao: string | null;
          uf: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bairro?: string | null;
          categoria_habilitacao?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cliente_id?: string | null;
          completed_at?: string | null;
          cpf: string;
          created_at?: string;
          curso_superior?: string | null;
          data_nascimento?: string | null;
          documentacao_completa?: boolean | null;
          email?: string | null;
          endereco?: string | null;
          escolaridade?: string | null;
          estado_civil?: string | null;
          exibir_data_atualizacao?: boolean;
          experiencia_frase?: string | null;
          experiencia_possui?: boolean;
          foto_exibir?: boolean;
          foto_url?: string | null;
          habilidades_observacao?: string | null;
          habilitacao?: boolean;
          id?: string;
          nome_completo?: string;
          numero?: string | null;
          objetivo_texto?: string | null;
          objetivo_tipo?: string;
          pos_graduacao_nome?: string | null;
          status?: string;
          tamanho_fonte?: number;
          telefone_principal?: string;
          telefone_principal_descricao?: string | null;
          uf?: string | null;
          updated_at?: string;
        };
        Update: {
          bairro?: string | null;
          categoria_habilitacao?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cliente_id?: string | null;
          completed_at?: string | null;
          cpf?: string;
          created_at?: string;
          curso_superior?: string | null;
          data_nascimento?: string | null;
          documentacao_completa?: boolean | null;
          email?: string | null;
          endereco?: string | null;
          escolaridade?: string | null;
          estado_civil?: string | null;
          exibir_data_atualizacao?: boolean;
          experiencia_frase?: string | null;
          experiencia_possui?: boolean;
          foto_exibir?: boolean;
          foto_url?: string | null;
          habilidades_observacao?: string | null;
          habilitacao?: boolean;
          id?: string;
          nome_completo?: string;
          numero?: string | null;
          objetivo_texto?: string | null;
          objetivo_tipo?: string;
          pos_graduacao_nome?: string | null;
          status?: string;
          tamanho_fonte?: number;
          telefone_principal?: string;
          telefone_principal_descricao?: string | null;
          uf?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_arquivos: {
        Row: {
          altura_px: number;
          criado_em: string;
          criado_por: string;
          id: string;
          largura_px: number;
          nome_original: string;
          original_bucket: string;
          original_path: string;
          tamanho_bytes: number;
          thumbnail_bucket: string;
          thumbnail_path: string;
          tipo_mime: string;
          trabalho_id: string;
        };
        ComputedFields: never;
        Insert: {
          altura_px: number;
          criado_em?: string;
          criado_por?: string;
          id?: string;
          largura_px: number;
          nome_original: string;
          original_bucket?: string;
          original_path: string;
          tamanho_bytes: number;
          thumbnail_bucket?: string;
          thumbnail_path: string;
          tipo_mime: string;
          trabalho_id: string;
        };
        Update: {
          altura_px?: number;
          criado_em?: string;
          criado_por?: string;
          id?: string;
          largura_px?: number;
          nome_original?: string;
          original_bucket?: string;
          original_path?: string;
          tamanho_bytes?: number;
          thumbnail_bucket?: string;
          thumbnail_path?: string;
          tipo_mime?: string;
          trabalho_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_arquivos_trabalho_id_fkey";
            columns: ["trabalho_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_trabalhos";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_arquivos_impressao: {
        Row: {
          altura_px: number | null;
          bucket: string;
          caminho: string;
          criado_em: string;
          dpi: number;
          estado: string;
          folha_numero: number | null;
          geracao_id: string;
          id: string;
          largura_px: number | null;
          mime: string;
          nome_arquivo: string;
          paginas: number | null;
          tamanho_bytes: number | null;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          altura_px?: number | null;
          bucket?: string;
          caminho: string;
          criado_em?: string;
          dpi?: number;
          estado?: string;
          folha_numero?: number | null;
          geracao_id: string;
          id?: string;
          largura_px?: number | null;
          mime: string;
          nome_arquivo: string;
          paginas?: number | null;
          tamanho_bytes?: number | null;
          tipo: string;
        };
        Update: {
          altura_px?: number | null;
          bucket?: string;
          caminho?: string;
          criado_em?: string;
          dpi?: number;
          estado?: string;
          folha_numero?: number | null;
          geracao_id?: string;
          id?: string;
          largura_px?: number | null;
          mime?: string;
          nome_arquivo?: string;
          paginas?: number | null;
          tamanho_bytes?: number | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_arquivos_impressao_geracao_id_fkey";
            columns: ["geracao_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_geracoes";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_configuracoes: {
        Row: {
          atualizado_em: string;
          crop_altura: number | null;
          crop_largura: number | null;
          crop_x: number | null;
          crop_y: number | null;
          espelhar_horizontal: boolean;
          espelhar_vertical: boolean;
          item_id: string;
          modo_ajuste: string;
          posicao_x: number;
          posicao_y: number;
          rotacao: number;
          zoom: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          crop_altura?: number | null;
          crop_largura?: number | null;
          crop_x?: number | null;
          crop_y?: number | null;
          espelhar_horizontal?: boolean;
          espelhar_vertical?: boolean;
          item_id: string;
          modo_ajuste?: string;
          posicao_x?: number;
          posicao_y?: number;
          rotacao?: number;
          zoom?: number;
        };
        Update: {
          atualizado_em?: string;
          crop_altura?: number | null;
          crop_largura?: number | null;
          crop_x?: number | null;
          crop_y?: number | null;
          espelhar_horizontal?: boolean;
          espelhar_vertical?: boolean;
          item_id?: string;
          modo_ajuste?: string;
          posicao_x?: number;
          posicao_y?: number;
          rotacao?: number;
          zoom?: number;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_configuracoes_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "foto_express_itens";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_folhas: {
        Row: {
          altura_mm: number;
          id: string;
          largura_mm: number;
          linha_cor: string;
          linha_espacamento_ativa: boolean;
          linha_espessura_mm: number;
          montagem_id: string;
          numero: number;
          papel_id: string | null;
          papel_nome: string | null;
          valor_unitario: number;
        };
        ComputedFields: never;
        Insert: {
          altura_mm: number;
          id?: string;
          largura_mm: number;
          linha_cor?: string;
          linha_espacamento_ativa?: boolean;
          linha_espessura_mm?: number;
          montagem_id: string;
          numero: number;
          papel_id?: string | null;
          papel_nome?: string | null;
          valor_unitario?: number;
        };
        Update: {
          altura_mm?: number;
          id?: string;
          largura_mm?: number;
          linha_cor?: string;
          linha_espacamento_ativa?: boolean;
          linha_espessura_mm?: number;
          montagem_id?: string;
          numero?: number;
          papel_id?: string | null;
          papel_nome?: string | null;
          valor_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_folhas_montagem_id_fkey";
            columns: ["montagem_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_montagens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "foto_express_folhas_papel_id_fkey";
            columns: ["papel_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_papeis";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_formatos: {
        Row: {
          altura_cm: number;
          area_foto_altura: number;
          area_foto_largura: number;
          area_foto_x: number;
          area_foto_y: number;
          ativo: boolean;
          atualizado_em: string;
          categoria: string;
          codigo: string;
          cor_card: string;
          cor_fundo: string;
          criado_em: string;
          id: string;
          largura_cm: number;
          nome: string;
          nome_portal: string | null;
          ordem: number;
          padrao: boolean;
          papel_padrao_id: string | null;
          visivel_portal: boolean;
        };
        ComputedFields: never;
        Insert: {
          altura_cm: number;
          area_foto_altura?: number;
          area_foto_largura?: number;
          area_foto_x?: number;
          area_foto_y?: number;
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string;
          codigo: string;
          cor_card?: string;
          cor_fundo?: string;
          criado_em?: string;
          id?: string;
          largura_cm: number;
          nome: string;
          nome_portal?: string | null;
          ordem?: number;
          padrao?: boolean;
          papel_padrao_id?: string | null;
          visivel_portal?: boolean;
        };
        Update: {
          altura_cm?: number;
          area_foto_altura?: number;
          area_foto_largura?: number;
          area_foto_x?: number;
          area_foto_y?: number;
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string;
          codigo?: string;
          cor_card?: string;
          cor_fundo?: string;
          criado_em?: string;
          id?: string;
          largura_cm?: number;
          nome?: string;
          nome_portal?: string | null;
          ordem?: number;
          padrao?: boolean;
          papel_padrao_id?: string | null;
          visivel_portal?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_formatos_papel_padrao_id_fkey";
            columns: ["papel_padrao_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_papeis";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_geracoes: {
        Row: {
          assinatura: string;
          atualizado_em: string;
          concluido_em: string | null;
          criado_em: string;
          criado_por: string;
          dpi: number;
          erro: string | null;
          estado: string;
          etapa: string;
          id: string;
          iniciado_em: string | null;
          montagem_id: string;
          montagem_versao: number;
          saida: string;
          snapshot: NonNullable<Json>;
          trabalho_id: string;
        };
        ComputedFields: never;
        Insert: {
          assinatura: string;
          atualizado_em?: string;
          concluido_em?: string | null;
          criado_em?: string;
          criado_por?: string;
          dpi?: number;
          erro?: string | null;
          estado?: string;
          etapa?: string;
          id?: string;
          iniciado_em?: string | null;
          montagem_id: string;
          montagem_versao: number;
          saida: string;
          snapshot: NonNullable<Json>;
          trabalho_id: string;
        };
        Update: {
          assinatura?: string;
          atualizado_em?: string;
          concluido_em?: string | null;
          criado_em?: string;
          criado_por?: string;
          dpi?: number;
          erro?: string | null;
          estado?: string;
          etapa?: string;
          id?: string;
          iniciado_em?: string | null;
          montagem_id?: string;
          montagem_versao?: number;
          saida?: string;
          snapshot?: NonNullable<Json>;
          trabalho_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_geracoes_montagem_id_fkey";
            columns: ["montagem_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_montagens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "foto_express_geracoes_trabalho_id_fkey";
            columns: ["trabalho_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_trabalhos";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_itens: {
        Row: {
          altura_personalizada_cm: number | null;
          arquivo_id: string;
          atualizado_em: string;
          criado_em: string;
          formato_id: string | null;
          id: string;
          largura_personalizada_cm: number | null;
          ordem: number;
          orientacao: string;
          quantidade: number;
          status_edicao: string;
          trabalho_id: string;
        };
        ComputedFields: never;
        Insert: {
          altura_personalizada_cm?: number | null;
          arquivo_id: string;
          atualizado_em?: string;
          criado_em?: string;
          formato_id?: string | null;
          id?: string;
          largura_personalizada_cm?: number | null;
          ordem?: number;
          orientacao?: string;
          quantidade?: number;
          status_edicao?: string;
          trabalho_id: string;
        };
        Update: {
          altura_personalizada_cm?: number | null;
          arquivo_id?: string;
          atualizado_em?: string;
          criado_em?: string;
          formato_id?: string | null;
          id?: string;
          largura_personalizada_cm?: number | null;
          ordem?: number;
          orientacao?: string;
          quantidade?: number;
          status_edicao?: string;
          trabalho_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_itens_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "foto_express_itens_arquivo_trabalho_fkey";
            columns: ["arquivo_id", "trabalho_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_arquivos";
            referencedColumns: ["id", "trabalho_id"];
          },
          {
            foreignKeyName: "foto_express_itens_formato_id_fkey";
            columns: ["formato_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_formatos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "foto_express_itens_trabalho_id_fkey";
            columns: ["trabalho_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_trabalhos";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_limpezas_storage: {
        Row: {
          arquivo_id: string | null;
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          id: string;
          motivo: string;
          original_bucket: string;
          original_path: string;
          status: string;
          tentativas: number;
          thumbnail_bucket: string;
          thumbnail_path: string;
          ultimo_erro: string | null;
        };
        ComputedFields: never;
        Insert: {
          arquivo_id?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string;
          id?: string;
          motivo: string;
          original_bucket: string;
          original_path: string;
          status?: string;
          tentativas?: number;
          thumbnail_bucket: string;
          thumbnail_path: string;
          ultimo_erro?: string | null;
        };
        Update: {
          arquivo_id?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string;
          id?: string;
          motivo?: string;
          original_bucket?: string;
          original_path?: string;
          status?: string;
          tentativas?: number;
          thumbnail_bucket?: string;
          thumbnail_path?: string;
          ultimo_erro?: string | null;
        };
        Relationships: [];
      };
      foto_express_montagens: {
        Row: {
          assinatura: string;
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          espacamento_mm: number;
          estado: string;
          id: string;
          margem_direita_mm: number;
          margem_esquerda_mm: number;
          margem_inferior_mm: number;
          margem_superior_mm: number;
          orientacao_escolhida: string;
          orientacao_solicitada: string;
          papel: string;
          papel_altura_mm: number;
          papel_id: string | null;
          papel_largura_mm: number;
          papel_nome: string | null;
          permitir_rotacao: boolean;
          snapshot_confirmado: Json | null;
          trabalho_id: string;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          assinatura: string;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string;
          espacamento_mm?: number;
          estado?: string;
          id?: string;
          margem_direita_mm?: number;
          margem_esquerda_mm?: number;
          margem_inferior_mm?: number;
          margem_superior_mm?: number;
          orientacao_escolhida: string;
          orientacao_solicitada: string;
          papel: string;
          papel_altura_mm: number;
          papel_id?: string | null;
          papel_largura_mm: number;
          papel_nome?: string | null;
          permitir_rotacao?: boolean;
          snapshot_confirmado?: Json | null;
          trabalho_id: string;
          versao?: number;
        };
        Update: {
          assinatura?: string;
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string;
          espacamento_mm?: number;
          estado?: string;
          id?: string;
          margem_direita_mm?: number;
          margem_esquerda_mm?: number;
          margem_inferior_mm?: number;
          margem_superior_mm?: number;
          orientacao_escolhida?: string;
          orientacao_solicitada?: string;
          papel?: string;
          papel_altura_mm?: number;
          papel_id?: string | null;
          papel_largura_mm?: number;
          papel_nome?: string | null;
          permitir_rotacao?: boolean;
          snapshot_confirmado?: Json | null;
          trabalho_id?: string;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_montagens_papel_id_fkey";
            columns: ["papel_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_papeis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "foto_express_montagens_trabalho_id_fkey";
            columns: ["trabalho_id"];
            isOneToOne: true;
            referencedRelation: "foto_express_trabalhos";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_ocorrencias: {
        Row: {
          altura_mm: number;
          folha_id: string;
          id: string;
          indice_copia: number;
          item_id: string;
          largura_mm: number;
          rotacao_folha: number;
          x_mm: number;
          y_mm: number;
        };
        ComputedFields: never;
        Insert: {
          altura_mm: number;
          folha_id: string;
          id?: string;
          indice_copia: number;
          item_id: string;
          largura_mm: number;
          rotacao_folha?: number;
          x_mm: number;
          y_mm: number;
        };
        Update: {
          altura_mm?: number;
          folha_id?: string;
          id?: string;
          indice_copia?: number;
          item_id?: string;
          largura_mm?: number;
          rotacao_folha?: number;
          x_mm?: number;
          y_mm?: number;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_ocorrencias_folha_id_fkey";
            columns: ["folha_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_folhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "foto_express_ocorrencias_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_itens";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_papeis: {
        Row: {
          altura_mm: number;
          ativo: boolean;
          atualizado_em: string;
          codigo: string;
          criado_em: string;
          espacamento_mm: number;
          faixas_valor: NonNullable<Json>;
          id: string;
          largura_mm: number;
          linha_cor: string;
          linha_espacamento_ativa: boolean;
          linha_espessura_mm: number;
          margem_direita_mm: number;
          margem_esquerda_mm: number;
          margem_inferior_mm: number;
          margem_superior_mm: number;
          nome: string;
          ordem: number;
          orientacao: string;
          permitir_rotacao: boolean;
          valor_folha: number;
        };
        ComputedFields: never;
        Insert: {
          altura_mm: number;
          ativo?: boolean;
          atualizado_em?: string;
          codigo: string;
          criado_em?: string;
          espacamento_mm?: number;
          faixas_valor?: NonNullable<Json>;
          id?: string;
          largura_mm: number;
          linha_cor?: string;
          linha_espacamento_ativa?: boolean;
          linha_espessura_mm?: number;
          margem_direita_mm?: number;
          margem_esquerda_mm?: number;
          margem_inferior_mm?: number;
          margem_superior_mm?: number;
          nome: string;
          ordem?: number;
          orientacao?: string;
          permitir_rotacao?: boolean;
          valor_folha?: number;
        };
        Update: {
          altura_mm?: number;
          ativo?: boolean;
          atualizado_em?: string;
          codigo?: string;
          criado_em?: string;
          espacamento_mm?: number;
          faixas_valor?: NonNullable<Json>;
          id?: string;
          largura_mm?: number;
          linha_cor?: string;
          linha_espacamento_ativa?: boolean;
          linha_espessura_mm?: number;
          margem_direita_mm?: number;
          margem_esquerda_mm?: number;
          margem_inferior_mm?: number;
          margem_superior_mm?: number;
          nome?: string;
          ordem?: number;
          orientacao?: string;
          permitir_rotacao?: boolean;
          valor_folha?: number;
        };
        Relationships: [];
      };
      foto_express_portal_sessoes: {
        Row: {
          cliente_id: string;
          criado_em: string;
          expira_em: string;
          id: string;
          ip: string | null;
          renovacao_expira_em: string | null;
          renovacao_hash: string | null;
          revogado_em: string | null;
          token_hash: string;
          usado_em: string;
          user_agent: string | null;
        };
        ComputedFields: never;
        Insert: {
          cliente_id: string;
          criado_em?: string;
          expira_em: string;
          id?: string;
          ip?: string | null;
          renovacao_expira_em?: string | null;
          renovacao_hash?: string | null;
          revogado_em?: string | null;
          token_hash: string;
          usado_em?: string;
          user_agent?: string | null;
        };
        Update: {
          cliente_id?: string;
          criado_em?: string;
          expira_em?: string;
          id?: string;
          ip?: string | null;
          renovacao_expira_em?: string | null;
          renovacao_hash?: string | null;
          revogado_em?: string | null;
          token_hash?: string;
          usado_em?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_portal_sessoes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_portal_tentativas: {
        Row: {
          acao: string;
          criado_em: string;
          id: number;
          ip: string;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          criado_em?: string;
          id?: never;
          ip: string;
        };
        Update: {
          acao?: string;
          criado_em?: string;
          id?: never;
          ip?: string;
        };
        Relationships: [];
      };
      foto_express_textos: {
        Row: {
          alinhamento: string;
          altura: number | null;
          atualizado_em: string;
          conteudo: string;
          cor: string;
          criado_em: string;
          fonte: string;
          fonte_id: string;
          id: string;
          italico: boolean;
          item_id: string;
          largura: number | null;
          largura_normalizada: number;
          negrito: boolean;
          ordem: number;
          posicao_x: number;
          posicao_y: number;
          rotacao: number;
          tamanho: number;
          tamanho_normalizado: number;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          alinhamento?: string;
          altura?: number | null;
          atualizado_em?: string;
          conteudo?: string;
          cor?: string;
          criado_em?: string;
          fonte?: string;
          fonte_id?: string;
          id?: string;
          italico?: boolean;
          item_id: string;
          largura?: number | null;
          largura_normalizada?: number;
          negrito?: boolean;
          ordem?: number;
          posicao_x?: number;
          posicao_y?: number;
          rotacao?: number;
          tamanho?: number;
          tamanho_normalizado?: number;
          versao?: number;
        };
        Update: {
          alinhamento?: string;
          altura?: number | null;
          atualizado_em?: string;
          conteudo?: string;
          cor?: string;
          criado_em?: string;
          fonte?: string;
          fonte_id?: string;
          id?: string;
          italico?: boolean;
          item_id?: string;
          largura?: number | null;
          largura_normalizada?: number;
          negrito?: boolean;
          ordem?: number;
          posicao_x?: number;
          posicao_y?: number;
          rotacao?: number;
          tamanho?: number;
          tamanho_normalizado?: number;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_textos_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "foto_express_itens";
            referencedColumns: ["id"];
          },
        ];
      };
      foto_express_trabalhos: {
        Row: {
          atualizado_em: string;
          cliente_id: string | null;
          cliente_nome: string;
          cliente_telefone: string;
          criado_em: string;
          criado_por: string;
          id: string;
          numero: number;
          observacoes: string;
          orcamento_portal: Json | null;
          origem_portal: boolean;
          portal_enviado_em: string | null;
          status: string;
          valor_estimado: number | null;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          cliente_id?: string | null;
          cliente_nome?: string;
          cliente_telefone?: string;
          criado_em?: string;
          criado_por?: string;
          id?: string;
          numero?: number;
          observacoes?: string;
          orcamento_portal?: Json | null;
          origem_portal?: boolean;
          portal_enviado_em?: string | null;
          status?: string;
          valor_estimado?: number | null;
        };
        Update: {
          atualizado_em?: string;
          cliente_id?: string | null;
          cliente_nome?: string;
          cliente_telefone?: string;
          criado_em?: string;
          criado_por?: string;
          id?: string;
          numero?: number;
          observacoes?: string;
          orcamento_portal?: Json | null;
          origem_portal?: boolean;
          portal_enviado_em?: string | null;
          status?: string;
          valor_estimado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "foto_express_trabalhos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      habilidades_curriculo: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string;
          id: string;
          ordem: number;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao: string;
          id?: string;
          ordem?: number;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string;
          id?: string;
          ordem?: number;
        };
        Relationships: [];
      };
      ia_credenciais: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          chave: string;
          provedor: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          chave: string;
          provedor: string;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          chave?: string;
          provedor?: string;
        };
        Relationships: [];
      };
      materiais: {
        Row: {
          ativo: boolean;
          categoria: string;
          created_at: string;
          descricao: string;
          faixas: NonNullable<Json>;
          faixas_por_arquivo: Json | null;
          faixas_por_copia_adicional: NonNullable<Json>;
          formato: string;
          id: string;
          nome: string;
          ordem: number;
          perfil_impressao_id: string | null;
          preco_arquivos_fixo: number | null;
          preco_color: number;
          preco_pb: number;
          preco_por_arquivo: number;
          quantidade_arquivos_fixo: number | null;
          tipo_impressao: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          categoria?: string;
          created_at?: string;
          descricao?: string;
          faixas?: NonNullable<Json>;
          faixas_por_arquivo?: Json | null;
          faixas_por_copia_adicional?: NonNullable<Json>;
          formato?: string;
          id?: string;
          nome: string;
          ordem?: number;
          perfil_impressao_id?: string | null;
          preco_arquivos_fixo?: number | null;
          preco_color?: number;
          preco_pb?: number;
          preco_por_arquivo?: number;
          quantidade_arquivos_fixo?: number | null;
          tipo_impressao?: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          categoria?: string;
          created_at?: string;
          descricao?: string;
          faixas?: NonNullable<Json>;
          faixas_por_arquivo?: Json | null;
          faixas_por_copia_adicional?: NonNullable<Json>;
          formato?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          perfil_impressao_id?: string | null;
          preco_arquivos_fixo?: number | null;
          preco_color?: number;
          preco_pb?: number;
          preco_por_arquivo?: number;
          quantidade_arquivos_fixo?: number | null;
          tipo_impressao?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "materiais_perfil_impressao_id_fkey";
            columns: ["perfil_impressao_id"];
            isOneToOne: false;
            referencedRelation: "perfis_impressao";
            referencedColumns: ["id"];
          },
        ];
      };
      melhorias: {
        Row: {
          created_at: string;
          descricao: string | null;
          executada: boolean;
          id: string;
          status: string;
          tela: string;
          titulo: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          descricao?: string | null;
          executada?: boolean;
          id?: string;
          status?: string;
          tela: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          descricao?: string | null;
          executada?: boolean;
          id?: string;
          status?: string;
          tela?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mensagens_rapidas: {
        Row: {
          atalho: string;
          ativo: boolean;
          created_at: string;
          id: string;
          imagem_nome: string | null;
          imagem_path: string | null;
          mostrar_no_botao: boolean;
          ordem: number;
          texto: string | null;
          tipo: string;
          titulo: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          atalho: string;
          ativo?: boolean;
          created_at?: string;
          id?: string;
          imagem_nome?: string | null;
          imagem_path?: string | null;
          mostrar_no_botao?: boolean;
          ordem?: number;
          texto?: string | null;
          tipo?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          atalho?: string;
          ativo?: boolean;
          created_at?: string;
          id?: string;
          imagem_nome?: string | null;
          imagem_path?: string | null;
          mostrar_no_botao?: boolean;
          ordem?: number;
          texto?: string | null;
          tipo?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      objetivos_curriculo: {
        Row: {
          ativo: boolean;
          created_at: string;
          id: string;
          ordem: number;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          ordem?: number;
          texto: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          ordem?: number;
          texto?: string;
        };
        Relationships: [];
      };
      orcamento_links: {
        Row: {
          aberto_em: string | null;
          cancelado: boolean;
          confirmado_em: string | null;
          conversa_id: string | null;
          created_at: string;
          expira_em: string;
          id: string;
          orcamento_id: string;
          pedido_id: string | null;
          token: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aberto_em?: string | null;
          cancelado?: boolean;
          confirmado_em?: string | null;
          conversa_id?: string | null;
          created_at?: string;
          expira_em?: string;
          id?: string;
          orcamento_id: string;
          pedido_id?: string | null;
          token: string;
          updated_at?: string;
        };
        Update: {
          aberto_em?: string | null;
          cancelado?: boolean;
          confirmado_em?: string | null;
          conversa_id?: string | null;
          created_at?: string;
          expira_em?: string;
          id?: string;
          orcamento_id?: string;
          pedido_id?: string | null;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orcamento_links_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conversas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_links_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "orcamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_links_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamentos: {
        Row: {
          acabamentos: NonNullable<Json>;
          arquivos: NonNullable<Json>;
          calculo_id: string | null;
          cliente_id: string | null;
          cliente_nome: string;
          cliente_telefone: string | null;
          copia_manual: boolean;
          copias_adicionais: number;
          cor_impressao: string;
          created_at: string;
          frente_verso: boolean;
          id: string;
          incluir_pix: boolean;
          material_id: string | null;
          material_nome: string | null;
          numero: string;
          observacao: string | null;
          ordem: number;
          origem_orcamento: string;
          paginas_adicionais: number;
          paginas_total: number;
          pedido_id: string | null;
          pix_texto_final: string | null;
          prazo_quantidade: number;
          prazo_texto_final: string | null;
          prazo_tipo: string | null;
          precisa_prazo: boolean;
          quantidade_arquivos: number;
          revisao_necessaria: boolean;
          status: string;
          tamanho: string;
          tipo_impressao: string;
          usuario_id: string;
          validade: string | null;
          valor_acabamento: number;
          valor_total: number;
          valor_unitario: number;
        };
        ComputedFields: never;
        Insert: {
          acabamentos?: NonNullable<Json>;
          arquivos?: NonNullable<Json>;
          calculo_id?: string | null;
          cliente_id?: string | null;
          cliente_nome?: string;
          cliente_telefone?: string | null;
          copia_manual?: boolean;
          copias_adicionais?: number;
          cor_impressao?: string;
          created_at?: string;
          frente_verso?: boolean;
          id?: string;
          incluir_pix?: boolean;
          material_id?: string | null;
          material_nome?: string | null;
          numero?: string;
          observacao?: string | null;
          ordem?: number;
          origem_orcamento?: string;
          paginas_adicionais?: number;
          paginas_total?: number;
          pedido_id?: string | null;
          pix_texto_final?: string | null;
          prazo_quantidade?: number;
          prazo_texto_final?: string | null;
          prazo_tipo?: string | null;
          precisa_prazo?: boolean;
          quantidade_arquivos?: number;
          revisao_necessaria?: boolean;
          status?: string;
          tamanho?: string;
          tipo_impressao?: string;
          usuario_id?: string;
          validade?: string | null;
          valor_acabamento?: number;
          valor_total?: number;
          valor_unitario?: number;
        };
        Update: {
          acabamentos?: NonNullable<Json>;
          arquivos?: NonNullable<Json>;
          calculo_id?: string | null;
          cliente_id?: string | null;
          cliente_nome?: string;
          cliente_telefone?: string | null;
          copia_manual?: boolean;
          copias_adicionais?: number;
          cor_impressao?: string;
          created_at?: string;
          frente_verso?: boolean;
          id?: string;
          incluir_pix?: boolean;
          material_id?: string | null;
          material_nome?: string | null;
          numero?: string;
          observacao?: string | null;
          ordem?: number;
          origem_orcamento?: string;
          paginas_adicionais?: number;
          paginas_total?: number;
          pedido_id?: string | null;
          pix_texto_final?: string | null;
          prazo_quantidade?: number;
          prazo_texto_final?: string | null;
          prazo_tipo?: string | null;
          precisa_prazo?: boolean;
          quantidade_arquivos?: number;
          revisao_necessaria?: boolean;
          status?: string;
          tamanho?: string;
          tipo_impressao?: string;
          usuario_id?: string;
          validade?: string | null;
          valor_acabamento?: number;
          valor_total?: number;
          valor_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orcamentos_calculo_id_fkey";
            columns: ["calculo_id"];
            isOneToOne: false;
            referencedRelation: "calculos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamentos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamentos_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamentos_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
      pedidos: {
        Row: {
          cliente_id: string | null;
          cliente_nome: string;
          cliente_telefone: string | null;
          created_at: string;
          id: string;
          incluir_pix: boolean;
          numero: string;
          observacao: string | null;
          pix_texto_final: string | null;
          prazo_quantidade: number;
          prazo_texto_final: string | null;
          prazo_tipo: string | null;
          precisa_prazo: boolean;
          status: string;
          updated_at: string;
          usuario_id: string;
          validade: string | null;
          valor_pago: number;
          valor_total: number;
        };
        ComputedFields: never;
        Insert: {
          cliente_id?: string | null;
          cliente_nome?: string;
          cliente_telefone?: string | null;
          created_at?: string;
          id?: string;
          incluir_pix?: boolean;
          numero?: string;
          observacao?: string | null;
          pix_texto_final?: string | null;
          prazo_quantidade?: number;
          prazo_texto_final?: string | null;
          prazo_tipo?: string | null;
          precisa_prazo?: boolean;
          status?: string;
          updated_at?: string;
          usuario_id?: string;
          validade?: string | null;
          valor_pago?: number;
          valor_total?: number;
        };
        Update: {
          cliente_id?: string | null;
          cliente_nome?: string;
          cliente_telefone?: string | null;
          created_at?: string;
          id?: string;
          incluir_pix?: boolean;
          numero?: string;
          observacao?: string | null;
          pix_texto_final?: string | null;
          prazo_quantidade?: number;
          prazo_texto_final?: string | null;
          prazo_tipo?: string | null;
          precisa_prazo?: boolean;
          status?: string;
          updated_at?: string;
          usuario_id?: string;
          validade?: string | null;
          valor_pago?: number;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      perfis_acesso: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          id: string;
          nome: string;
          permissoes: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          permissoes?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          permissoes?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [];
      };
      perfis_impressao: {
        Row: {
          altura_mm: number;
          ativo: boolean;
          bandeja: string | null;
          copias: number;
          cor: string;
          created_at: string;
          duplex: string;
          id: string;
          impressora: string | null;
          largura_mm: number;
          midia: string;
          nome: string;
          ordem: number;
          orientacao: string;
          qualidade: string;
          tamanho: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          altura_mm?: number;
          ativo?: boolean;
          bandeja?: string | null;
          copias?: number;
          cor?: string;
          created_at?: string;
          duplex?: string;
          id?: string;
          impressora?: string | null;
          largura_mm?: number;
          midia?: string;
          nome: string;
          ordem?: number;
          orientacao?: string;
          qualidade?: string;
          tamanho?: string;
          updated_at?: string;
        };
        Update: {
          altura_mm?: number;
          ativo?: boolean;
          bandeja?: string | null;
          copias?: number;
          cor?: string;
          created_at?: string;
          duplex?: string;
          id?: string;
          impressora?: string | null;
          largura_mm?: number;
          midia?: string;
          nome?: string;
          ordem?: number;
          orientacao?: string;
          qualidade?: string;
          tamanho?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          ativo: boolean;
          conexao_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          nome: string | null;
          perfil_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          email?: string | null;
          id: string;
          nome?: string | null;
          perfil_id?: string | null;
        };
        Update: {
          ativo?: boolean;
          conexao_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          nome?: string | null;
          perfil_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_perfil_id_fkey";
            columns: ["perfil_id"];
            isOneToOne: false;
            referencedRelation: "perfis_acesso";
            referencedColumns: ["id"];
          },
        ];
      };
      rascunhos: {
        Row: {
          created_at: string;
          dados: NonNullable<Json>;
          id: string;
          updated_at: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dados?: NonNullable<Json>;
          id?: string;
          updated_at?: string;
          usuario_id?: string;
        };
        Update: {
          created_at?: string;
          dados?: NonNullable<Json>;
          id?: string;
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      sistema_chaves: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          id: string;
          nome: string;
          url_base: string;
          valor: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          id?: string;
          nome: string;
          url_base?: string;
          valor?: string;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          id?: string;
          nome?: string;
          url_base?: string;
          valor?: string;
        };
        Relationships: [];
      };
      sorteio_auditoria: {
        Row: {
          cliente_id: string | null;
          criado_em: string;
          cupom_id: string | null;
          detalhe: NonNullable<Json>;
          evento: string;
          id: string;
          nota_id: string | null;
          origem: string;
          participante_id: string | null;
          sorteio_id: string | null;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cliente_id?: string | null;
          criado_em?: string;
          cupom_id?: string | null;
          detalhe?: NonNullable<Json>;
          evento: string;
          id?: string;
          nota_id?: string | null;
          origem?: string;
          participante_id?: string | null;
          sorteio_id?: string | null;
          usuario_id?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          criado_em?: string;
          cupom_id?: string | null;
          detalhe?: NonNullable<Json>;
          evento?: string;
          id?: string;
          nota_id?: string | null;
          origem?: string;
          participante_id?: string | null;
          sorteio_id?: string | null;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_auditoria_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_auditoria_cupom_id_fkey";
            columns: ["cupom_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_cupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_auditoria_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_notas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_auditoria_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_auditoria_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_cupom_contribuicoes: {
        Row: {
          criado_em: string;
          cupom_id: string;
          id: string;
          nota_id: string;
          ordem: number;
          participante_id: string;
          sorteio_id: string;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          cupom_id: string;
          id?: string;
          nota_id: string;
          ordem?: number;
          participante_id: string;
          sorteio_id: string;
          valor_centavos: number;
        };
        Update: {
          criado_em?: string;
          cupom_id?: string;
          id?: string;
          nota_id?: string;
          ordem?: number;
          participante_id?: string;
          sorteio_id?: string;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_cupom_contribuicoes_cupom_id_fkey";
            columns: ["cupom_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_cupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_cupom_contribuicoes_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_notas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_cupom_contribuicoes_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_cupom_contribuicoes_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_cupons: {
        Row: {
          cancelado_em: string | null;
          gerado_em: string;
          id: string;
          nota_id: string;
          numero: string;
          participante_id: string;
          sorteio_id: string;
          status: string;
          valor_base_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          cancelado_em?: string | null;
          gerado_em?: string;
          id?: string;
          nota_id: string;
          numero: string;
          participante_id: string;
          sorteio_id: string;
          status?: string;
          valor_base_centavos?: number;
        };
        Update: {
          cancelado_em?: string | null;
          gerado_em?: string;
          id?: string;
          nota_id?: string;
          numero?: string;
          participante_id?: string;
          sorteio_id?: string;
          status?: string;
          valor_base_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_cupons_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_notas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_cupons_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_cupons_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_ganhadores: {
        Row: {
          cupom_id: string;
          id: string;
          numero_cupom: string;
          observacao: string | null;
          participante_id: string;
          premio_id: string | null;
          sorteado_em: string;
          sorteio_id: string;
          unidade: number | null;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cupom_id: string;
          id?: string;
          numero_cupom: string;
          observacao?: string | null;
          participante_id: string;
          premio_id?: string | null;
          sorteado_em?: string;
          sorteio_id: string;
          unidade?: number | null;
          usuario_id?: string | null;
        };
        Update: {
          cupom_id?: string;
          id?: string;
          numero_cupom?: string;
          observacao?: string | null;
          participante_id?: string;
          premio_id?: string | null;
          sorteado_em?: string;
          sorteio_id?: string;
          unidade?: number | null;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_ganhadores_cupom_id_fkey";
            columns: ["cupom_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_cupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_ganhadores_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_ganhadores_premio_id_fkey";
            columns: ["premio_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_premios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_ganhadores_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_historico: {
        Row: {
          cliente_id: string;
          criado_em: string;
          data_fim: string | null;
          data_inicio: string | null;
          encerrado_em: string | null;
          id: string;
          numero_sorteio: number;
          quantidade_cupons: number;
          quantidade_notas: number;
          saldo_final_centavos: number;
          sorteio_id: string;
        };
        ComputedFields: never;
        Insert: {
          cliente_id: string;
          criado_em?: string;
          data_fim?: string | null;
          data_inicio?: string | null;
          encerrado_em?: string | null;
          id?: string;
          numero_sorteio: number;
          quantidade_cupons?: number;
          quantidade_notas?: number;
          saldo_final_centavos?: number;
          sorteio_id: string;
        };
        Update: {
          cliente_id?: string;
          criado_em?: string;
          data_fim?: string | null;
          data_inicio?: string | null;
          encerrado_em?: string | null;
          id?: string;
          numero_sorteio?: number;
          quantidade_cupons?: number;
          quantidade_notas?: number;
          saldo_final_centavos?: number;
          sorteio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_historico_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_historico_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_notas: {
        Row: {
          atualizado_em: string;
          cadastrado_em: string;
          cancelado_em: string | null;
          cupons_gerados: number;
          cupons_processado_em: string | null;
          id: string;
          invalidado_em: string | null;
          motivo_invalidez: string | null;
          nota_base_id: string | null;
          numero: string;
          participante_id: string;
          saldo_gerado_centavos: number;
          sorteio_id: string;
          status: string;
          validado_em: string | null;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          cadastrado_em?: string;
          cancelado_em?: string | null;
          cupons_gerados?: number;
          cupons_processado_em?: string | null;
          id?: string;
          invalidado_em?: string | null;
          motivo_invalidez?: string | null;
          nota_base_id?: string | null;
          numero: string;
          participante_id: string;
          saldo_gerado_centavos?: number;
          sorteio_id: string;
          status?: string;
          validado_em?: string | null;
          valor_centavos: number;
        };
        Update: {
          atualizado_em?: string;
          cadastrado_em?: string;
          cancelado_em?: string | null;
          cupons_gerados?: number;
          cupons_processado_em?: string | null;
          id?: string;
          invalidado_em?: string | null;
          motivo_invalidez?: string | null;
          nota_base_id?: string | null;
          numero?: string;
          participante_id?: string;
          saldo_gerado_centavos?: number;
          sorteio_id?: string;
          status?: string;
          validado_em?: string | null;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_notas_nota_base_id_fkey";
            columns: ["nota_base_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_notas_base";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_notas_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_notas_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_notas_base: {
        Row: {
          atualizado_em: string;
          cancelada_em: string | null;
          cliente_origem_id: string | null;
          criado_em: string;
          data_nota: string | null;
          id: string;
          numero: string;
          origem_id: string | null;
          sincronizado_em: string | null;
          situacao: number;
          sorteio_id: string;
          valor_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          cancelada_em?: string | null;
          cliente_origem_id?: string | null;
          criado_em?: string;
          data_nota?: string | null;
          id?: string;
          numero: string;
          origem_id?: string | null;
          sincronizado_em?: string | null;
          situacao?: number;
          sorteio_id: string;
          valor_centavos: number;
        };
        Update: {
          atualizado_em?: string;
          cancelada_em?: string | null;
          cliente_origem_id?: string | null;
          criado_em?: string;
          data_nota?: string | null;
          id?: string;
          numero?: string;
          origem_id?: string | null;
          sincronizado_em?: string | null;
          situacao?: number;
          sorteio_id?: string;
          valor_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_notas_base_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_participantes: {
        Row: {
          aceite_termos_em: string | null;
          aceite_termos_versao: number | null;
          atualizado_em: string;
          cliente_id: string;
          concorre_sorteio: boolean;
          criado_em: string;
          id: string;
          saldo_centavos: number;
          sincronizacao_status: string;
          sincronizado_em: string | null;
          sorteio_id: string;
        };
        ComputedFields: never;
        Insert: {
          aceite_termos_em?: string | null;
          aceite_termos_versao?: number | null;
          atualizado_em?: string;
          cliente_id: string;
          concorre_sorteio?: boolean;
          criado_em?: string;
          id?: string;
          saldo_centavos?: number;
          sincronizacao_status?: string;
          sincronizado_em?: string | null;
          sorteio_id: string;
        };
        Update: {
          aceite_termos_em?: string | null;
          aceite_termos_versao?: number | null;
          atualizado_em?: string;
          cliente_id?: string;
          concorre_sorteio?: boolean;
          criado_em?: string;
          id?: string;
          saldo_centavos?: number;
          sincronizacao_status?: string;
          sincronizado_em?: string | null;
          sorteio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_participantes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_participantes_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_premios: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          descricao: string;
          id: string;
          nome: string;
          ordem: number;
          quantidade: number;
          sorteio_id: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string;
          id?: string;
          nome: string;
          ordem?: number;
          quantidade?: number;
          sorteio_id: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          quantidade?: number;
          sorteio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_premios_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_saldo_fontes: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          nota_id: string;
          participante_id: string;
          sequencia: number;
          sorteio_id: string;
          status: string;
          valor_original_centavos: number;
          valor_pendente_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nota_id: string;
          participante_id: string;
          sequencia?: never;
          sorteio_id: string;
          status?: string;
          valor_original_centavos: number;
          valor_pendente_centavos?: number;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nota_id?: string;
          participante_id?: string;
          sequencia?: never;
          sorteio_id?: string;
          status?: string;
          valor_original_centavos?: number;
          valor_pendente_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_saldo_fontes_nota_id_fkey";
            columns: ["nota_id"];
            isOneToOne: true;
            referencedRelation: "sorteio_notas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_saldo_fontes_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_saldo_fontes_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_sessoes: {
        Row: {
          cliente_id: string;
          criado_em: string;
          expira_em: string;
          id: string;
          ip: string | null;
          participante_id: string;
          renovacao_expira_em: string | null;
          renovacao_hash: string | null;
          revogado_em: string | null;
          sorteio_id: string;
          token_hash: string;
          usado_em: string;
          user_agent: string | null;
        };
        ComputedFields: never;
        Insert: {
          cliente_id: string;
          criado_em?: string;
          expira_em: string;
          id?: string;
          ip?: string | null;
          participante_id: string;
          renovacao_expira_em?: string | null;
          renovacao_hash?: string | null;
          revogado_em?: string | null;
          sorteio_id: string;
          token_hash: string;
          usado_em?: string;
          user_agent?: string | null;
        };
        Update: {
          cliente_id?: string;
          criado_em?: string;
          expira_em?: string;
          id?: string;
          ip?: string | null;
          participante_id?: string;
          renovacao_expira_em?: string | null;
          renovacao_hash?: string | null;
          revogado_em?: string | null;
          sorteio_id?: string;
          token_hash?: string;
          usado_em?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_sessoes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_sessoes_participante_id_fkey";
            columns: ["participante_id"];
            isOneToOne: false;
            referencedRelation: "sorteio_participantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sorteio_sessoes_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_sincronizacao_cursores: {
        Row: {
          atualizado_em: string;
          consumidor: string;
          criado_em: string;
          sequencia: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          consumidor: string;
          criado_em?: string;
          sequencia?: number;
        };
        Update: {
          atualizado_em?: string;
          consumidor?: string;
          criado_em?: string;
          sequencia?: number;
        };
        Relationships: [];
      };
      sorteio_sincronizacao_fila: {
        Row: {
          alterado_em: string;
          atualizado_em: string;
          criado_em: string;
          destino: string;
          entidade: string;
          entidade_id: string;
          erro: string | null;
          id: string;
          metadados: Json | null;
          operacao: string;
          operacao_id: string | null;
          origem: string;
          processado_em: string | null;
          sequencia: number;
          sorteio_id: string | null;
          status: string;
          tentativas: number;
          tipo: string;
          ultima_tentativa_em: string | null;
        };
        ComputedFields: never;
        Insert: {
          alterado_em?: string;
          atualizado_em?: string;
          criado_em?: string;
          destino: string;
          entidade: string;
          entidade_id: string;
          erro?: string | null;
          id?: string;
          metadados?: Json | null;
          operacao: string;
          operacao_id?: string | null;
          origem: string;
          processado_em?: string | null;
          sequencia?: number;
          sorteio_id?: string | null;
          status?: string;
          tentativas?: number;
          tipo: string;
          ultima_tentativa_em?: string | null;
        };
        Update: {
          alterado_em?: string;
          atualizado_em?: string;
          criado_em?: string;
          destino?: string;
          entidade?: string;
          entidade_id?: string;
          erro?: string | null;
          id?: string;
          metadados?: Json | null;
          operacao?: string;
          operacao_id?: string | null;
          origem?: string;
          processado_em?: string | null;
          sequencia?: number;
          sorteio_id?: string | null;
          status?: string;
          tentativas?: number;
          tipo?: string;
          ultima_tentativa_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_sincronizacao_fila_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_sincronizacoes: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          destino: string | null;
          direcao: string;
          duracao_ms: number | null;
          erro: string | null;
          finalizado_em: string | null;
          id: string;
          iniciado_em: string;
          lote_id: string | null;
          operacao_id: string | null;
          origem: string | null;
          registros_enviados: number;
          registros_processados: number;
          registros_recebidos: number;
          sorteio_id: string | null;
          status: string;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          destino?: string | null;
          direcao: string;
          duracao_ms?: number | null;
          erro?: string | null;
          finalizado_em?: string | null;
          id?: string;
          iniciado_em?: string;
          lote_id?: string | null;
          operacao_id?: string | null;
          origem?: string | null;
          registros_enviados?: number;
          registros_processados?: number;
          registros_recebidos?: number;
          sorteio_id?: string | null;
          status?: string;
          tipo: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          destino?: string | null;
          direcao?: string;
          duracao_ms?: number | null;
          erro?: string | null;
          finalizado_em?: string | null;
          id?: string;
          iniciado_em?: string;
          lote_id?: string | null;
          operacao_id?: string | null;
          origem?: string | null;
          registros_enviados?: number;
          registros_processados?: number;
          registros_recebidos?: number;
          sorteio_id?: string | null;
          status?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_sincronizacoes_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteio_tentativas: {
        Row: {
          acao: string;
          criado_em: string;
          id: string;
          ip: string;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          criado_em?: string;
          id?: string;
          ip: string;
        };
        Update: {
          acao?: string;
          criado_em?: string;
          id?: string;
          ip?: string;
        };
        Relationships: [];
      };
      sorteio_termos: {
        Row: {
          atual: boolean;
          atualizado_em: string;
          como_participar: string;
          como_sera_realizado: string;
          criado_em: string;
          id: string;
          informacoes: string;
          outras_condicoes: string;
          premios: string;
          publicado_em: string | null;
          regras: string;
          sorteio_id: string;
          titulo: string;
          validade: string;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          atual?: boolean;
          atualizado_em?: string;
          como_participar?: string;
          como_sera_realizado?: string;
          criado_em?: string;
          id?: string;
          informacoes?: string;
          outras_condicoes?: string;
          premios?: string;
          publicado_em?: string | null;
          regras?: string;
          sorteio_id: string;
          titulo?: string;
          validade?: string;
          versao?: number;
        };
        Update: {
          atual?: boolean;
          atualizado_em?: string;
          como_participar?: string;
          como_sera_realizado?: string;
          criado_em?: string;
          id?: string;
          informacoes?: string;
          outras_condicoes?: string;
          premios?: string;
          publicado_em?: string | null;
          regras?: string;
          sorteio_id?: string;
          titulo?: string;
          validade?: string;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sorteio_termos_sorteio_id_fkey";
            columns: ["sorteio_id"];
            isOneToOne: false;
            referencedRelation: "sorteios";
            referencedColumns: ["id"];
          },
        ];
      };
      sorteios: {
        Row: {
          atualizado_em: string;
          base_sincronizada_em: string | null;
          conferencia_encerramento: Json | null;
          criado_em: string;
          criado_por: string | null;
          data_fim: string | null;
          data_inicio: string | null;
          data_sorteio: string | null;
          descricao: string;
          encerrado_em: string | null;
          encerrado_por: string | null;
          id: string;
          nome: string;
          numero_sorteio: number;
          quantidade_maxima_cupons: number | null;
          status: string;
          valor_minimo_nota_centavos: number;
          valor_por_cupom_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          base_sincronizada_em?: string | null;
          conferencia_encerramento?: Json | null;
          criado_em?: string;
          criado_por?: string | null;
          data_fim?: string | null;
          data_inicio?: string | null;
          data_sorteio?: string | null;
          descricao?: string;
          encerrado_em?: string | null;
          encerrado_por?: string | null;
          id?: string;
          nome: string;
          numero_sorteio: number;
          quantidade_maxima_cupons?: number | null;
          status?: string;
          valor_minimo_nota_centavos?: number;
          valor_por_cupom_centavos?: number;
        };
        Update: {
          atualizado_em?: string;
          base_sincronizada_em?: string | null;
          conferencia_encerramento?: Json | null;
          criado_em?: string;
          criado_por?: string | null;
          data_fim?: string | null;
          data_inicio?: string | null;
          data_sorteio?: string | null;
          descricao?: string;
          encerrado_em?: string | null;
          encerrado_por?: string | null;
          id?: string;
          nome?: string;
          numero_sorteio?: number;
          quantidade_maxima_cupons?: number | null;
          status?: string;
          valor_minimo_nota_centavos?: number;
          valor_por_cupom_centavos?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      whatsapp_arquivos: {
        Row: {
          cliente_id: string | null;
          conversa_id: string;
          copias: number;
          created_at: string;
          frente_verso: boolean;
          id: string;
          mensagem_id: string | null;
          mime_type: string | null;
          nome: string;
          paginas: number;
          paginas_manuais: boolean;
          pedido_id: string | null;
          storage_path: string | null;
          tipo: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          cliente_id?: string | null;
          conversa_id: string;
          copias?: number;
          created_at?: string;
          frente_verso?: boolean;
          id?: string;
          mensagem_id?: string | null;
          mime_type?: string | null;
          nome?: string;
          paginas?: number;
          paginas_manuais?: boolean;
          pedido_id?: string | null;
          storage_path?: string | null;
          tipo?: string;
          url?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          conversa_id?: string;
          copias?: number;
          created_at?: string;
          frente_verso?: boolean;
          id?: string;
          mensagem_id?: string | null;
          mime_type?: string | null;
          nome?: string;
          paginas?: number;
          paginas_manuais?: boolean;
          pedido_id?: string | null;
          storage_path?: string | null;
          tipo?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_arquivos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_arquivos_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conversas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_arquivos_mensagem_id_fkey";
            columns: ["mensagem_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_mensagens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_arquivos_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_auditoria: {
        Row: {
          acao: string;
          conversa_id: string | null;
          created_at: string;
          detalhe: string | null;
          id: string;
          usuario_id: string | null;
          usuario_nome: string | null;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          conversa_id?: string | null;
          created_at?: string;
          detalhe?: string | null;
          id?: string;
          usuario_id?: string | null;
          usuario_nome?: string | null;
        };
        Update: {
          acao?: string;
          conversa_id?: string | null;
          created_at?: string;
          detalhe?: string | null;
          id?: string;
          usuario_id?: string | null;
          usuario_nome?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_auditoria_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_conexoes: {
        Row: {
          ativo: boolean;
          base_url: string;
          client_token: string;
          config_provedor: NonNullable<Json>;
          cor: string;
          created_at: string;
          id: string;
          id_externo: string | null;
          instance_id: string;
          instance_token: string;
          nome: string;
          ordem: number;
          provedor: string;
          servidor_id: string | null;
          status: string;
          status_atualizado_em: string | null;
          telefone: string;
          ultimo_erro: string | null;
          ultimo_erro_em: string | null;
          updated_at: string;
          webhook_token: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          base_url?: string;
          client_token?: string;
          config_provedor?: NonNullable<Json>;
          cor?: string;
          created_at?: string;
          id?: string;
          id_externo?: string | null;
          instance_id?: string;
          instance_token?: string;
          nome: string;
          ordem?: number;
          provedor?: string;
          servidor_id?: string | null;
          status?: string;
          status_atualizado_em?: string | null;
          telefone?: string;
          ultimo_erro?: string | null;
          ultimo_erro_em?: string | null;
          updated_at?: string;
          webhook_token?: string;
        };
        Update: {
          ativo?: boolean;
          base_url?: string;
          client_token?: string;
          config_provedor?: NonNullable<Json>;
          cor?: string;
          created_at?: string;
          id?: string;
          id_externo?: string | null;
          instance_id?: string;
          instance_token?: string;
          nome?: string;
          ordem?: number;
          provedor?: string;
          servidor_id?: string | null;
          status?: string;
          status_atualizado_em?: string | null;
          telefone?: string;
          ultimo_erro?: string | null;
          ultimo_erro_em?: string | null;
          updated_at?: string;
          webhook_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_conexoes_servidor_id_fkey";
            columns: ["servidor_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_servidores";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_servidores: {
        Row: {
          ativo: boolean;
          base_url: string;
          created_at: string;
          criado_por: string | null;
          id: string;
          nome: string;
          provedor: string;
          segredo_ref: string | null;
          ultimo_erro: string | null;
          ultimo_teste_em: string | null;
          ultimo_teste_ok: boolean | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          base_url: string;
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          provedor: string;
          segredo_ref?: string | null;
          ultimo_erro?: string | null;
          ultimo_teste_em?: string | null;
          ultimo_teste_ok?: boolean | null;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          base_url?: string;
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          provedor?: string;
          segredo_ref?: string | null;
          ultimo_erro?: string | null;
          ultimo_teste_em?: string | null;
          ultimo_teste_ok?: boolean | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_eventos: {
        Row: {
          conexao_id: string;
          dedup_key: string;
          erro: string | null;
          id: string;
          payload: NonNullable<Json>;
          processado_em: string | null;
          provedor: string;
          recebido_em: string;
          status: string;
          tentativas: number;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          conexao_id: string;
          dedup_key: string;
          erro?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          processado_em?: string | null;
          provedor: string;
          recebido_em?: string;
          status?: string;
          tentativas?: number;
          tipo: string;
        };
        Update: {
          conexao_id?: string;
          dedup_key?: string;
          erro?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          processado_em?: string | null;
          provedor?: string;
          recebido_em?: string;
          status?: string;
          tentativas?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_eventos_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_config: {
        Row: {
          agente_atendimento_ativo: boolean;
          agente_atendimento_dias_semana: number[];
          agente_atendimento_exigir_validacao: boolean;
          agente_atendimento_ferramentas_permitidas: string[];
          agente_atendimento_horario_fim: string;
          agente_atendimento_horario_inicio: string;
          agente_atendimento_id: string | null;
          agente_atendimento_max_contexto_mensagens: number;
          agente_atendimento_msg_ativacao: string;
          agente_atendimento_msg_fora_horario: string;
          agente_atendimento_msg_transferencia: string;
          app_url: string;
          base_url: string;
          bot_24h: boolean;
          bot_ativo: boolean;
          conexao_id: string | null;
          conexao_nome: string;
          enviar_msg_finalizacao: boolean;
          exigir_revisao_humana: boolean;
          fallback_fluxo_id: string | null;
          fallback_inicial_minutos: number;
          finalizacao_delay_minutos: number;
          finalizacao_uma_vez_dia: boolean;
          fluxo_finalizacao_id: string | null;
          id: string;
          ignorar_agradecimentos: NonNullable<Json>;
          inatividade_minutos: number;
          inatividade_status: string;
          inatividade1_minutos: number;
          inatividade2_minutos: number;
          link_exigir_telefone: boolean;
          link_permitir_acabamento: boolean;
          link_permitir_confirmacao: boolean;
          link_permitir_copias: boolean;
          link_permitir_formato: boolean;
          link_permitir_frente_verso: boolean;
          link_permitir_material: boolean;
          link_permitir_tipo: boolean;
          link_permitir_upload: boolean;
          modo_numeros: string;
          mostrar_precos_link: boolean;
          msg_boas_vindas: string;
          msg_finalizacao: string;
          msg_finalizacao_ativo: boolean;
          msg_fora_horario: string;
          msg_fora_horario_ativo: boolean;
          msg_inatividade_aguardando: string;
          msg_inatividade_em_atendimento: string;
          msg_inatividade_finalizado: string;
          msg_inatividade_pendente: string;
          msg_inatividade1: string;
          msg_inicial: string;
          msg_link_curriculo: string;
          msg_menu: string;
          msg_nao_entendi: string;
          msg_orcamento_confirmado: string;
          msg_orcamento_confirmado_ativo: boolean;
          msg_orcamento_gerado: string;
          msg_orcamento_gerado_ativo: boolean;
          msg_retorno_dia: string;
          msg_revisao: string;
          msg_revisao_ativo: boolean;
          msg_transferencia: string;
          msg_transferencia_ativo: boolean;
          msg_transferencia_fora_horario: string;
          msg_transferencia_fora_horario_ativo: boolean;
          permitir_link: boolean;
          permitir_orcamento_automatico: boolean;
          reabrir_mesmo_dia: boolean;
          updated_at: string;
          usar_ia: boolean;
          webhook_token: string;
        };
        ComputedFields: never;
        Insert: {
          agente_atendimento_ativo?: boolean;
          agente_atendimento_dias_semana?: number[];
          agente_atendimento_exigir_validacao?: boolean;
          agente_atendimento_ferramentas_permitidas?: string[];
          agente_atendimento_horario_fim?: string;
          agente_atendimento_horario_inicio?: string;
          agente_atendimento_id?: string | null;
          agente_atendimento_max_contexto_mensagens?: number;
          agente_atendimento_msg_ativacao?: string;
          agente_atendimento_msg_fora_horario?: string;
          agente_atendimento_msg_transferencia?: string;
          app_url?: string;
          base_url?: string;
          bot_24h?: boolean;
          bot_ativo?: boolean;
          conexao_id?: string | null;
          conexao_nome?: string;
          enviar_msg_finalizacao?: boolean;
          exigir_revisao_humana?: boolean;
          fallback_fluxo_id?: string | null;
          fallback_inicial_minutos?: number;
          finalizacao_delay_minutos?: number;
          finalizacao_uma_vez_dia?: boolean;
          fluxo_finalizacao_id?: string | null;
          id?: string;
          ignorar_agradecimentos?: NonNullable<Json>;
          inatividade_minutos?: number;
          inatividade_status?: string;
          inatividade1_minutos?: number;
          inatividade2_minutos?: number;
          link_exigir_telefone?: boolean;
          link_permitir_acabamento?: boolean;
          link_permitir_confirmacao?: boolean;
          link_permitir_copias?: boolean;
          link_permitir_formato?: boolean;
          link_permitir_frente_verso?: boolean;
          link_permitir_material?: boolean;
          link_permitir_tipo?: boolean;
          link_permitir_upload?: boolean;
          modo_numeros?: string;
          mostrar_precos_link?: boolean;
          msg_boas_vindas?: string;
          msg_finalizacao?: string;
          msg_finalizacao_ativo?: boolean;
          msg_fora_horario?: string;
          msg_fora_horario_ativo?: boolean;
          msg_inatividade_aguardando?: string;
          msg_inatividade_em_atendimento?: string;
          msg_inatividade_finalizado?: string;
          msg_inatividade_pendente?: string;
          msg_inatividade1?: string;
          msg_inicial?: string;
          msg_link_curriculo?: string;
          msg_menu?: string;
          msg_nao_entendi?: string;
          msg_orcamento_confirmado?: string;
          msg_orcamento_confirmado_ativo?: boolean;
          msg_orcamento_gerado?: string;
          msg_orcamento_gerado_ativo?: boolean;
          msg_retorno_dia?: string;
          msg_revisao?: string;
          msg_revisao_ativo?: boolean;
          msg_transferencia?: string;
          msg_transferencia_ativo?: boolean;
          msg_transferencia_fora_horario?: string;
          msg_transferencia_fora_horario_ativo?: boolean;
          permitir_link?: boolean;
          permitir_orcamento_automatico?: boolean;
          reabrir_mesmo_dia?: boolean;
          updated_at?: string;
          usar_ia?: boolean;
          webhook_token?: string;
        };
        Update: {
          agente_atendimento_ativo?: boolean;
          agente_atendimento_dias_semana?: number[];
          agente_atendimento_exigir_validacao?: boolean;
          agente_atendimento_ferramentas_permitidas?: string[];
          agente_atendimento_horario_fim?: string;
          agente_atendimento_horario_inicio?: string;
          agente_atendimento_id?: string | null;
          agente_atendimento_max_contexto_mensagens?: number;
          agente_atendimento_msg_ativacao?: string;
          agente_atendimento_msg_fora_horario?: string;
          agente_atendimento_msg_transferencia?: string;
          app_url?: string;
          base_url?: string;
          bot_24h?: boolean;
          bot_ativo?: boolean;
          conexao_id?: string | null;
          conexao_nome?: string;
          enviar_msg_finalizacao?: boolean;
          exigir_revisao_humana?: boolean;
          fallback_fluxo_id?: string | null;
          fallback_inicial_minutos?: number;
          finalizacao_delay_minutos?: number;
          finalizacao_uma_vez_dia?: boolean;
          fluxo_finalizacao_id?: string | null;
          id?: string;
          ignorar_agradecimentos?: NonNullable<Json>;
          inatividade_minutos?: number;
          inatividade_status?: string;
          inatividade1_minutos?: number;
          inatividade2_minutos?: number;
          link_exigir_telefone?: boolean;
          link_permitir_acabamento?: boolean;
          link_permitir_confirmacao?: boolean;
          link_permitir_copias?: boolean;
          link_permitir_formato?: boolean;
          link_permitir_frente_verso?: boolean;
          link_permitir_material?: boolean;
          link_permitir_tipo?: boolean;
          link_permitir_upload?: boolean;
          modo_numeros?: string;
          mostrar_precos_link?: boolean;
          msg_boas_vindas?: string;
          msg_finalizacao?: string;
          msg_finalizacao_ativo?: boolean;
          msg_fora_horario?: string;
          msg_fora_horario_ativo?: boolean;
          msg_inatividade_aguardando?: string;
          msg_inatividade_em_atendimento?: string;
          msg_inatividade_finalizado?: string;
          msg_inatividade_pendente?: string;
          msg_inatividade1?: string;
          msg_inicial?: string;
          msg_link_curriculo?: string;
          msg_menu?: string;
          msg_nao_entendi?: string;
          msg_orcamento_confirmado?: string;
          msg_orcamento_confirmado_ativo?: boolean;
          msg_orcamento_gerado?: string;
          msg_orcamento_gerado_ativo?: boolean;
          msg_retorno_dia?: string;
          msg_revisao?: string;
          msg_revisao_ativo?: boolean;
          msg_transferencia?: string;
          msg_transferencia_ativo?: boolean;
          msg_transferencia_fora_horario?: string;
          msg_transferencia_fora_horario_ativo?: boolean;
          permitir_link?: boolean;
          permitir_orcamento_automatico?: boolean;
          reabrir_mesmo_dia?: boolean;
          updated_at?: string;
          usar_ia?: boolean;
          webhook_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_agente_atendimento_id_fkey";
            columns: ["agente_atendimento_id"];
            isOneToOne: false;
            referencedRelation: "agentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_config_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_config_fallback_fluxo_id_fkey";
            columns: ["fallback_fluxo_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_config_fluxo_finalizacao_id_fkey";
            columns: ["fluxo_finalizacao_id"];
            isOneToOne: false;
            referencedRelation: "bot_fluxos";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_conversas: {
        Row: {
          agente_processando: boolean;
          agente_processando_em: string | null;
          atendente_id: string | null;
          atendente_nome: string | null;
          atendimento_numero: number;
          bot_lock_em: string | null;
          bot_pendente: boolean;
          bot_pendente_em: string | null;
          chat_lid: string | null;
          cliente_id: string | null;
          conexao_id: string | null;
          contexto: NonNullable<Json>;
          created_at: string;
          data_finalizacao: string | null;
          etapa: string;
          finalizacao_em: string | null;
          finalizacao_fluxo_em: string | null;
          id: string;
          inatividade_avisada: boolean;
          inatividade_etapa: number;
          inicio_atendimento: string | null;
          motivo_encaminhamento: string | null;
          motivo_finalizacao: string | null;
          motivo_pendencia: string | null;
          nao_lidas: number;
          nome_contato: string | null;
          nome_manual: boolean;
          orcamento_id: string | null;
          pedido_id: string | null;
          saudacao_em: string | null;
          status: string;
          telefone: string;
          total_mensagens: number;
          ultima_mensagem: string | null;
          ultima_mensagem_em: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agente_processando?: boolean;
          agente_processando_em?: string | null;
          atendente_id?: string | null;
          atendente_nome?: string | null;
          atendimento_numero?: number;
          bot_lock_em?: string | null;
          bot_pendente?: boolean;
          bot_pendente_em?: string | null;
          chat_lid?: string | null;
          cliente_id?: string | null;
          conexao_id?: string | null;
          contexto?: NonNullable<Json>;
          created_at?: string;
          data_finalizacao?: string | null;
          etapa?: string;
          finalizacao_em?: string | null;
          finalizacao_fluxo_em?: string | null;
          id?: string;
          inatividade_avisada?: boolean;
          inatividade_etapa?: number;
          inicio_atendimento?: string | null;
          motivo_encaminhamento?: string | null;
          motivo_finalizacao?: string | null;
          motivo_pendencia?: string | null;
          nao_lidas?: number;
          nome_contato?: string | null;
          nome_manual?: boolean;
          orcamento_id?: string | null;
          pedido_id?: string | null;
          saudacao_em?: string | null;
          status?: string;
          telefone: string;
          total_mensagens?: number;
          ultima_mensagem?: string | null;
          ultima_mensagem_em?: string | null;
          updated_at?: string;
        };
        Update: {
          agente_processando?: boolean;
          agente_processando_em?: string | null;
          atendente_id?: string | null;
          atendente_nome?: string | null;
          atendimento_numero?: number;
          bot_lock_em?: string | null;
          bot_pendente?: boolean;
          bot_pendente_em?: string | null;
          chat_lid?: string | null;
          cliente_id?: string | null;
          conexao_id?: string | null;
          contexto?: NonNullable<Json>;
          created_at?: string;
          data_finalizacao?: string | null;
          etapa?: string;
          finalizacao_em?: string | null;
          finalizacao_fluxo_em?: string | null;
          id?: string;
          inatividade_avisada?: boolean;
          inatividade_etapa?: number;
          inicio_atendimento?: string | null;
          motivo_encaminhamento?: string | null;
          motivo_finalizacao?: string | null;
          motivo_pendencia?: string | null;
          nao_lidas?: number;
          nome_contato?: string | null;
          nome_manual?: boolean;
          orcamento_id?: string | null;
          pedido_id?: string | null;
          saudacao_em?: string | null;
          status?: string;
          telefone?: string;
          total_mensagens?: number;
          ultima_mensagem?: string | null;
          ultima_mensagem_em?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_conversas_conexao_id_fkey";
            columns: ["conexao_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conexoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_conversas_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "orcamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_conversas_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_mensagens: {
        Row: {
          apagada: boolean;
          apagada_em: string | null;
          arquivo_nome: string | null;
          arquivo_path: string | null;
          arquivo_url: string | null;
          autor: string | null;
          conversa_id: string;
          created_at: string;
          data_hora: string;
          direcao: string;
          editada: boolean;
          editada_em: string | null;
          erro: string | null;
          id: string;
          mime_type: string | null;
          payload: NonNullable<Json>;
          status: string;
          texto: string | null;
          texto_original: string | null;
          tipo: string;
          transcricao: string | null;
          whatsapp_message_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          apagada?: boolean;
          apagada_em?: string | null;
          arquivo_nome?: string | null;
          arquivo_path?: string | null;
          arquivo_url?: string | null;
          autor?: string | null;
          conversa_id: string;
          created_at?: string;
          data_hora?: string;
          direcao?: string;
          editada?: boolean;
          editada_em?: string | null;
          erro?: string | null;
          id?: string;
          mime_type?: string | null;
          payload?: NonNullable<Json>;
          status?: string;
          texto?: string | null;
          texto_original?: string | null;
          tipo?: string;
          transcricao?: string | null;
          whatsapp_message_id?: string | null;
        };
        Update: {
          apagada?: boolean;
          apagada_em?: string | null;
          arquivo_nome?: string | null;
          arquivo_path?: string | null;
          arquivo_url?: string | null;
          autor?: string | null;
          conversa_id?: string;
          created_at?: string;
          data_hora?: string;
          direcao?: string;
          editada?: boolean;
          editada_em?: string | null;
          erro?: string | null;
          id?: string;
          mime_type?: string | null;
          payload?: NonNullable<Json>;
          status?: string;
          texto?: string | null;
          texto_original?: string | null;
          tipo?: string;
          transcricao?: string | null;
          whatsapp_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_notas: {
        Row: {
          created_at: string;
          id: string;
          nota: string;
          telefone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          nota?: string;
          telefone: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nota?: string;
          telefone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      whatsapp_conexao_registrar_status: {
        Args: { _conexao_id: string; _erro?: string; _status: string };
        Returns: boolean;
      };
      whatsapp_evento_concluir: {
        Args: { _erro?: string; _id: string; _status: string };
        Returns: boolean;
      };
      whatsapp_evento_registrar: {
        Args: {
          _conexao_id: string;
          _dedup_key: string;
          _payload?: Json;
          _provedor: string;
          _tipo: string;
        };
        Returns: Array<{ id: string; novo: boolean; status: string; tentativas: number }>;
      };
      whatsapp_eventos_limpar: { Args: { _dias?: number }; Returns: number };
      agente_agendar_automacoes: {
        Args: { _limite?: number };
        Returns: Json;
      };
      agente_alerta_atualizar_status: {
        Args: { _id: string; _status: string };
        Returns: boolean;
      };
      agente_automacao_historico: {
        Args: { _automacao_id: string; _limite?: number };
        Returns: Json;
      };
      agente_eventos_permitidos: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      agente_gerar_alertas: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      agente_heartbeats_manter: {
        Args: { _inativo_minutos?: number; _retencao_dias?: number };
        Returns: Json;
      };
      agente_monitoramento_resumo: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      agente_proxima_execucao: {
        Args: {
          _apos: string;
          _dias: number[];
          _executar_em: string;
          _frequencia: string;
          _fuso: string;
          _hora: string;
          _intervalo: number;
          _tipo: string;
        };
        Returns: string;
      };
      agente_concluir_tarefa: {
        Args: { _erro?: string; _status: string; _tarefa_id: string };
        Returns: boolean;
      };
      agente_decidir_aprovacao: {
        Args: {
          _aprovacao_id: string;
          _decisao: string;
          _hash_confirmacao?: string;
          _motivo?: string;
        };
        Returns: Json;
      };
      agente_dentro_limite_profundidade: {
        Args: { _execucao_id: string; _limite?: number };
        Returns: boolean;
      };
      agente_enfileirar_tarefa: {
        Args: {
          _agendado_para?: string;
          _agente_id: string;
          _execucao_id?: string;
          _idempotency_key?: string;
          _payload?: Json;
          _prioridade?: number;
          _tipo: string;
        };
        Returns: string;
      };
      agente_expirar_leases: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      agente_hash_parametros: { Args: { _parametros: Json }; Returns: string };
      agente_idempotencia_iniciar: {
        Args: {
          _agente_id?: string;
          _chave: string;
          _escopo?: string;
          _execucao_id?: string;
          _ferramenta_id?: string;
          _passo_id?: string;
        };
        Returns: Json;
      };
      agente_idempotencia_resolver: {
        Args: { _chave: string; _resultado?: Json; _status: string };
        Returns: boolean;
      };
      agente_pode_acao: { Args: { _chave: string }; Returns: boolean };
      agente_registrar_auditoria: {
        Args: {
          _acao: string;
          _agente_id?: string;
          _dados?: Json;
          _entidade?: string;
          _entidade_id?: string;
          _execucao_id?: string;
          _ip?: string;
        };
        Returns: string;
      };
      agente_registrar_heartbeat: {
        Args: {
          _hostname?: string;
          _processos?: number;
          _status?: string;
          _versao?: string;
          _worker_id: string;
        };
        Returns: undefined;
      };
      agente_reservar_tarefas: {
        Args: {
          _lease_segundos?: number;
          _limite?: number;
          _worker_id: string;
        };
        Returns: Json;
      };
      conexao_do_usuario: { Args: { _user_id: string }; Returns: string };
      cpf_valido: { Args: { _cpf: string }; Returns: boolean };
      disparar_rotina_bot: { Args: { rota: string }; Returns: undefined };
      disparar_rotina_sorteios: { Args: { rota: string }; Returns: undefined };
      foto_express_aplicar_texto_todas_fotos: {
        Args: { _item_id: string; _texto_id: string; _trabalho_id: string };
        Returns: number;
      };
      foto_express_atualizar_geracao: {
        Args: { _etapa: string; _geracao_id: string };
        Returns: undefined;
      };
      foto_express_concluir_geracao: {
        Args: { _arquivos: Json; _geracao_id: string };
        Returns: undefined;
      };
      foto_express_criar_texto: {
        Args: { _item_id: string; _trabalho_id: string };
        Returns: {
          alinhamento: string;
          altura: number | null;
          atualizado_em: string;
          conteudo: string;
          cor: string;
          criado_em: string;
          fonte: string;
          fonte_id: string;
          id: string;
          italico: boolean;
          item_id: string;
          largura: number | null;
          largura_normalizada: number;
          negrito: boolean;
          ordem: number;
          posicao_x: number;
          posicao_y: number;
          rotacao: number;
          tamanho: number;
          tamanho_normalizado: number;
          versao: number;
        };
        SetofOptions: {
          from: "*";
          to: "foto_express_textos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      foto_express_duplicar_item: {
        Args: { _item_id: string };
        Returns: string;
      };
      foto_express_duplicar_texto: {
        Args: { _item_id: string; _texto_id: string; _trabalho_id: string };
        Returns: {
          alinhamento: string;
          altura: number | null;
          atualizado_em: string;
          conteudo: string;
          cor: string;
          criado_em: string;
          fonte: string;
          fonte_id: string;
          id: string;
          italico: boolean;
          item_id: string;
          largura: number | null;
          largura_normalizada: number;
          negrito: boolean;
          ordem: number;
          posicao_x: number;
          posicao_y: number;
          rotacao: number;
          tamanho: number;
          tamanho_normalizado: number;
          versao: number;
        };
        SetofOptions: {
          from: "*";
          to: "foto_express_textos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      foto_express_excluir_album: {
        Args: { _trabalho_id: string };
        Returns: {
          arquivo_id: string;
          limpeza_id: string;
          original_bucket: string;
          original_path: string;
          thumbnail_bucket: string;
          thumbnail_path: string;
        }[];
      };
      foto_express_excluir_itens: {
        Args: { _item_ids: string[] };
        Returns: {
          limpeza_id: string;
          original_bucket: string;
          original_path: string;
          thumbnail_bucket: string;
          thumbnail_path: string;
        }[];
      };
      foto_express_excluir_texto: {
        Args: { _item_id: string; _texto_id: string; _trabalho_id: string };
        Returns: undefined;
      };
      foto_express_falhar_geracao: {
        Args: { _erro: string; _geracao_id: string };
        Returns: undefined;
      };
      foto_express_iniciar_geracao: {
        Args: { _saida: string; _trabalho_id: string };
        Returns: string;
      };
      foto_express_mover_texto: {
        Args: {
          _direcao: number;
          _item_id: string;
          _texto_id: string;
          _trabalho_id: string;
        };
        Returns: undefined;
      };
      foto_express_portal_excluir_itens: {
        Args: {
          _cliente_id: string;
          _item_ids: string[];
          _trabalho_id: string;
        };
        Returns: {
          limpeza_id: string;
          original_bucket: string;
          original_path: string;
          thumbnail_bucket: string;
          thumbnail_path: string;
        }[];
      };
      foto_express_registrar_limpeza_upload: {
        Args: {
          _erro?: string;
          _original_path: string;
          _thumbnail_path: string;
        };
        Returns: string;
      };
      foto_express_registrar_upload: {
        Args: {
          _altura_px: number;
          _largura_px: number;
          _nome_original: string;
          _ordem?: number;
          _original_path: string;
          _tamanho_bytes: number;
          _thumbnail_path: string;
          _tipo_mime: string;
          _trabalho_id: string;
        };
        Returns: string;
      };
      foto_express_registrar_upload_com_formato: {
        Args: {
          _altura_px: number;
          _formato_id: string;
          _largura_px: number;
          _nome_original: string;
          _ordem?: number;
          _original_path: string;
          _tamanho_bytes: number;
          _thumbnail_path: string;
          _tipo_mime: string;
          _trabalho_id: string;
        };
        Returns: string;
      };
      foto_express_remover_texto_todas_fotos: {
        Args: { _item_id: string; _texto_id: string; _trabalho_id: string };
        Returns: number;
      };
      foto_express_salvar_edicao: {
        Args: {
          _crop_altura: number;
          _crop_largura: number;
          _crop_x: number;
          _crop_y: number;
          _espelhar_horizontal: boolean;
          _espelhar_vertical: boolean;
          _item_id: string;
          _modo_ajuste: string;
          _orientacao: string;
          _posicao_x: number;
          _posicao_y: number;
          _rotacao: number;
          _trabalho_id: string;
          _zoom: number;
        };
        Returns: string;
      };
      foto_express_salvar_edicao_com_formato: {
        Args: {
          _crop_altura: number;
          _crop_largura: number;
          _crop_x: number;
          _crop_y: number;
          _espelhar_horizontal: boolean;
          _espelhar_vertical: boolean;
          _formato_id: string;
          _item_id: string;
          _modo_ajuste: string;
          _orientacao: string;
          _posicao_x: number;
          _posicao_y: number;
          _rotacao: number;
          _trabalho_id: string;
          _zoom: number;
        };
        Returns: string;
      };
      foto_express_salvar_montagem: {
        Args: {
          _assinatura: string;
          _espacamento_mm: number;
          _folhas: Json;
          _margem_direita_mm: number;
          _margem_esquerda_mm: number;
          _margem_inferior_mm: number;
          _margem_superior_mm: number;
          _orientacao_escolhida: string;
          _orientacao_solicitada: string;
          _papel: string;
          _papel_altura_mm: number;
          _papel_largura_mm: number;
          _permitir_rotacao: boolean;
          _trabalho_id: string;
          _versao_esperada: number;
        };
        Returns: {
          assinatura: string;
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          espacamento_mm: number;
          estado: string;
          id: string;
          margem_direita_mm: number;
          margem_esquerda_mm: number;
          margem_inferior_mm: number;
          margem_superior_mm: number;
          orientacao_escolhida: string;
          orientacao_solicitada: string;
          papel: string;
          papel_altura_mm: number;
          papel_id: string | null;
          papel_largura_mm: number;
          papel_nome: string | null;
          permitir_rotacao: boolean;
          snapshot_confirmado: Json | null;
          trabalho_id: string;
          versao: number;
        };
        SetofOptions: {
          from: "*";
          to: "foto_express_montagens";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      foto_express_salvar_montagem_com_papel: {
        Args: {
          _assinatura: string;
          _folhas: Json;
          _orientacao_escolhida: string;
          _papel_id: string;
          _trabalho_id: string;
          _versao_esperada: number;
        };
        Returns: {
          assinatura: string;
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          espacamento_mm: number;
          estado: string;
          id: string;
          margem_direita_mm: number;
          margem_esquerda_mm: number;
          margem_inferior_mm: number;
          margem_superior_mm: number;
          orientacao_escolhida: string;
          orientacao_solicitada: string;
          papel: string;
          papel_altura_mm: number;
          papel_id: string | null;
          papel_largura_mm: number;
          papel_nome: string | null;
          permitir_rotacao: boolean;
          snapshot_confirmado: Json | null;
          trabalho_id: string;
          versao: number;
        };
        SetofOptions: {
          from: "*";
          to: "foto_express_montagens";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      foto_express_salvar_montagem_por_papeis: {
        Args: {
          _assinatura: string;
          _grupos: Json;
          _trabalho_id: string;
          _versao_esperada: number;
        };
        Returns: {
          assinatura: string;
          atualizado_em: string;
          criado_em: string;
          criado_por: string;
          espacamento_mm: number;
          estado: string;
          id: string;
          margem_direita_mm: number;
          margem_esquerda_mm: number;
          margem_inferior_mm: number;
          margem_superior_mm: number;
          orientacao_escolhida: string;
          orientacao_solicitada: string;
          papel: string;
          papel_altura_mm: number;
          papel_id: string | null;
          papel_largura_mm: number;
          papel_nome: string | null;
          permitir_rotacao: boolean;
          snapshot_confirmado: Json | null;
          trabalho_id: string;
          versao: number;
        };
        SetofOptions: {
          from: "*";
          to: "foto_express_montagens";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      foto_express_salvar_texto: {
        Args: {
          _alinhamento: string;
          _conteudo: string;
          _cor: string;
          _fonte_id: string;
          _italico: boolean;
          _item_id: string;
          _largura_normalizada: number;
          _negrito: boolean;
          _posicao_x: number;
          _posicao_y: number;
          _rotacao: number;
          _tamanho_normalizado: number;
          _texto_id: string;
          _trabalho_id: string;
          _versao_esperada: number;
        };
        Returns: {
          alinhamento: string;
          altura: number | null;
          atualizado_em: string;
          conteudo: string;
          cor: string;
          criado_em: string;
          fonte: string;
          fonte_id: string;
          id: string;
          italico: boolean;
          item_id: string;
          largura: number | null;
          largura_normalizada: number;
          negrito: boolean;
          ordem: number;
          posicao_x: number;
          posicao_y: number;
          rotacao: number;
          tamanho: number;
          tamanho_normalizado: number;
          versao: number;
        };
        SetofOptions: {
          from: "*";
          to: "foto_express_textos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      foto_express_snapshot_montagem: {
        Args: { _montagem_id: string };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      pode_agentes: { Args: { _chave?: string }; Returns: boolean };
      pode_foto_express: { Args: { _chave?: string }; Returns: boolean };
      pode_sorteios: { Args: Record<PropertyKey, never>; Returns: boolean };
      sorteio_apuracao_resumo: { Args: { _sorteio_id: string }; Returns: Json };
      sorteio_conferencia: { Args: { _sorteio_id: string }; Returns: Json };
      sorteio_definir_termos_atual: {
        Args: { _termos_id: string };
        Returns: undefined;
      };
      sorteio_emitir_cupons_do_pool: {
        Args: {
          _nota_referencia?: string;
          _origem?: string;
          _participante_id: string;
          _pool_maximo?: number;
          _usuario_id?: string;
        };
        Returns: Json;
      };
      sorteio_encerrar: {
        Args: { _sorteio_id: string; _usuario_id?: string };
        Returns: Json;
      };
      sorteio_gerar_cupons_da_nota: {
        Args: { _nota_id: string; _origem?: string; _usuario_id?: string };
        Returns: Json;
      };
      sorteio_portal_criar_participacao: {
        Args: {
          _cpf: string;
          _data_nascimento: string;
          _nome: string;
          _sorteio_id: string;
          _telefone: string;
          _telefone_normalizado: string;
        };
        Returns: string;
      };
      sorteio_reabrir: {
        Args: { _sorteio_id: string; _usuario_id?: string };
        Returns: Json;
      };
      sorteio_realizar: {
        Args: { _sorteio_id: string; _usuario_id?: string };
        Returns: Json;
      };
      sorteio_recalcular_saldo_participante: {
        Args: {
          _origem?: string;
          _participante_id: string;
          _usuario_id?: string;
        };
        Returns: Json;
      };
      sorteio_totais_por_elegibilidade: {
        Args: { _apenas_concorrentes?: boolean; _sorteio_id: string };
        Returns: Json;
      };
      tem_permissao: {
        Args: { _chave: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
