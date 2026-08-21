export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acabamentos: {
        Row: {
          ativo: boolean
          cobranca: string
          created_at: string
          faixas: Json
          id: string
          mostrar_nao_incluso: boolean
          mostrar_no_orcamento: boolean
          nome: string
          ordem: number
          paginas_bloco: number
          tipo_impressao: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          cobranca?: string
          created_at?: string
          faixas?: Json
          id?: string
          mostrar_nao_incluso?: boolean
          mostrar_no_orcamento?: boolean
          nome: string
          ordem?: number
          paginas_bloco?: number
          tipo_impressao?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          cobranca?: string
          created_at?: string
          faixas?: Json
          id?: string
          mostrar_nao_incluso?: boolean
          mostrar_no_orcamento?: boolean
          nome?: string
          ordem?: number
          paginas_bloco?: number
          tipo_impressao?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      calculo_itens: {
        Row: {
          calculo_id: string
          id: string
          material_id: string | null
          material_nome: string
          quantidade_color: number
          quantidade_pb: number
          total: number
          total_color: number
          total_pb: number
          valor_unitario_color: number
          valor_unitario_pb: number
        }
        Insert: {
          calculo_id: string
          id?: string
          material_id?: string | null
          material_nome?: string
          quantidade_color?: number
          quantidade_pb?: number
          total?: number
          total_color?: number
          total_pb?: number
          valor_unitario_color?: number
          valor_unitario_pb?: number
        }
        Update: {
          calculo_id?: string
          id?: string
          material_id?: string | null
          material_nome?: string
          quantidade_color?: number
          quantidade_pb?: number
          total?: number
          total_color?: number
          total_pb?: number
          valor_unitario_color?: number
          valor_unitario_pb?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculo_itens_calculo_id_fkey"
            columns: ["calculo_id"]
            isOneToOne: false
            referencedRelation: "calculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculo_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      calculos: {
        Row: {
          acabamentos: Json
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string
          frente_verso: boolean
          id: string
          material_nome: string | null
          observacao: string | null
          paginas_adicionais: number
          paginas_color: number
          paginas_pb: number
          paginas_total: number
          quantidade_arquivos: number
          tamanho: string
          tipo_impressao: string
          usuario_id: string
          valor_acabamento: number
          valor_total: number
        }
        Insert: {
          acabamentos?: Json
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          frente_verso?: boolean
          id?: string
          material_nome?: string | null
          observacao?: string | null
          paginas_adicionais?: number
          paginas_color?: number
          paginas_pb?: number
          paginas_total?: number
          quantidade_arquivos?: number
          tamanho?: string
          tipo_impressao?: string
          usuario_id?: string
          valor_acabamento?: number
          valor_total?: number
        }
        Update: {
          acabamentos?: Json
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          frente_verso?: boolean
          id?: string
          material_nome?: string | null
          observacao?: string | null
          paginas_adicionais?: number
          paginas_color?: number
          paginas_pb?: number
          paginas_total?: number
          quantidade_arquivos?: number
          tamanho?: string
          tipo_impressao?: string
          usuario_id?: string
          valor_acabamento?: number
          valor_total?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          observacao: string | null
          telefone: string | null
          telefone_normalizado: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          telefone?: string | null
          telefone_normalizado?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          telefone?: string | null
          telefone_normalizado?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          email: string | null
          empresa_nome: string
          endereco: string | null
          id: string
          impressora_padrao_largura: number
          impressora_padrao_nome: string | null
          impressora_padrao_tipo: string
          impressoras_padrao: Json
          instagram: string | null
          logo_url: string | null
          mensagem_prazo_orcamento: string
          pix_ativo: boolean
          pix_banco: string | null
          pix_chave: string | null
          pix_mensagem: string
          pix_nome: string | null
          rodape_orcamento: string
          telefone: string | null
          updated_at: string
          validade_padrao_dias: number
          whatsapp: string | null
        }
        Insert: {
          email?: string | null
          empresa_nome?: string
          endereco?: string | null
          id?: string
          impressora_padrao_largura?: number
          impressora_padrao_nome?: string | null
          impressora_padrao_tipo?: string
          impressoras_padrao?: Json
          instagram?: string | null
          logo_url?: string | null
          mensagem_prazo_orcamento?: string
          pix_ativo?: boolean
          pix_banco?: string | null
          pix_chave?: string | null
          pix_mensagem?: string
          pix_nome?: string | null
          rodape_orcamento?: string
          telefone?: string | null
          updated_at?: string
          validade_padrao_dias?: number
          whatsapp?: string | null
        }
        Update: {
          email?: string | null
          empresa_nome?: string
          endereco?: string | null
          id?: string
          impressora_padrao_largura?: number
          impressora_padrao_nome?: string | null
          impressora_padrao_tipo?: string
          impressoras_padrao?: Json
          instagram?: string | null
          logo_url?: string | null
          mensagem_prazo_orcamento?: string
          pix_ativo?: boolean
          pix_banco?: string | null
          pix_chave?: string | null
          pix_mensagem?: string
          pix_nome?: string | null
          rodape_orcamento?: string
          telefone?: string | null
          updated_at?: string
          validade_padrao_dias?: number
          whatsapp?: string | null
        }
        Relationships: []
      }
      materiais: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          faixas: Json
          faixas_por_arquivo: Json | null
          faixas_por_copia_adicional: Json
          formato: string
          id: string
          nome: string
          ordem: number
          preco_arquivos_fixo: number | null
          preco_color: number
          preco_pb: number
          preco_por_arquivo: number
          quantidade_arquivos_fixo: number | null
          tipo_impressao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          faixas?: Json
          faixas_por_arquivo?: Json | null
          faixas_por_copia_adicional?: Json
          formato?: string
          id?: string
          nome: string
          ordem?: number
          preco_arquivos_fixo?: number | null
          preco_color?: number
          preco_pb?: number
          preco_por_arquivo?: number
          quantidade_arquivos_fixo?: number | null
          tipo_impressao?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          faixas?: Json
          faixas_por_arquivo?: Json | null
          faixas_por_copia_adicional?: Json
          formato?: string
          id?: string
          nome?: string
          ordem?: number
          preco_arquivos_fixo?: number | null
          preco_color?: number
          preco_pb?: number
          preco_por_arquivo?: number
          quantidade_arquivos_fixo?: number | null
          tipo_impressao?: string
          updated_at?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          acabamentos: Json
          arquivos: Json
          calculo_id: string | null
          cliente_id: string | null
          cliente_nome: string
          cliente_telefone: string | null
          copia_manual: boolean
          copias_adicionais: number
          cor_impressao: string
          created_at: string
          frente_verso: boolean
          id: string
          incluir_pix: boolean
          material_id: string | null
          material_nome: string | null
          numero: string
          observacao: string | null
          ordem: number
          origem_orcamento: string
          paginas_adicionais: number
          paginas_total: number
          pedido_id: string | null
          pix_texto_final: string | null
          prazo_quantidade: number
          prazo_texto_final: string | null
          prazo_tipo: string | null
          precisa_prazo: boolean
          quantidade_arquivos: number
          revisao_necessaria: boolean
          status: string
          tamanho: string
          tipo_impressao: string
          usuario_id: string
          validade: string | null
          valor_acabamento: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          acabamentos?: Json
          arquivos?: Json
          calculo_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          copia_manual?: boolean
          copias_adicionais?: number
          cor_impressao?: string
          created_at?: string
          frente_verso?: boolean
          id?: string
          incluir_pix?: boolean
          material_id?: string | null
          material_nome?: string | null
          numero?: string
          observacao?: string | null
          ordem?: number
          origem_orcamento?: string
          paginas_adicionais?: number
          paginas_total?: number
          pedido_id?: string | null
          pix_texto_final?: string | null
          prazo_quantidade?: number
          prazo_texto_final?: string | null
          prazo_tipo?: string | null
          precisa_prazo?: boolean
          quantidade_arquivos?: number
          revisao_necessaria?: boolean
          status?: string
          tamanho?: string
          tipo_impressao?: string
          usuario_id?: string
          validade?: string | null
          valor_acabamento?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          acabamentos?: Json
          arquivos?: Json
          calculo_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          copia_manual?: boolean
          copias_adicionais?: number
          cor_impressao?: string
          created_at?: string
          frente_verso?: boolean
          id?: string
          incluir_pix?: boolean
          material_id?: string | null
          material_nome?: string | null
          numero?: string
          observacao?: string | null
          ordem?: number
          origem_orcamento?: string
          paginas_adicionais?: number
          paginas_total?: number
          pedido_id?: string | null
          pix_texto_final?: string | null
          prazo_quantidade?: number
          prazo_texto_final?: string | null
          prazo_tipo?: string | null
          precisa_prazo?: boolean
          quantidade_arquivos?: number
          revisao_necessaria?: boolean
          status?: string
          tamanho?: string
          tipo_impressao?: string
          usuario_id?: string
          validade?: string | null
          valor_acabamento?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_calculo_id_fkey"
            columns: ["calculo_id"]
            isOneToOne: false
            referencedRelation: "calculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          id: string
          incluir_pix: boolean
          numero: string
          observacao: string | null
          pix_texto_final: string | null
          prazo_quantidade: number
          prazo_texto_final: string | null
          prazo_tipo: string | null
          precisa_prazo: boolean
          status: string
          updated_at: string
          usuario_id: string
          validade: string | null
          valor_pago: number
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          id?: string
          incluir_pix?: boolean
          numero?: string
          observacao?: string | null
          pix_texto_final?: string | null
          prazo_quantidade?: number
          prazo_texto_final?: string | null
          prazo_tipo?: string | null
          precisa_prazo?: boolean
          status?: string
          updated_at?: string
          usuario_id?: string
          validade?: string | null
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          id?: string
          incluir_pix?: boolean
          numero?: string
          observacao?: string | null
          pix_texto_final?: string | null
          prazo_quantidade?: number
          prazo_texto_final?: string | null
          prazo_tipo?: string | null
          precisa_prazo?: boolean
          status?: string
          updated_at?: string
          usuario_id?: string
          validade?: string | null
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      rascunhos: {
        Row: {
          created_at: string
          dados: Json
          id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          id?: string
          updated_at?: string
          usuario_id?: string
        }
        Update: {
          created_at?: string
          dados?: Json
          id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_arquivos: {
        Row: {
          cliente_id: string | null
          conversa_id: string
          copias: number
          created_at: string
          frente_verso: boolean
          id: string
          mensagem_id: string | null
          mime_type: string | null
          nome: string
          paginas: number
          paginas_manuais: boolean
          pedido_id: string | null
          storage_path: string | null
          tipo: string
          url: string | null
        }
        Insert: {
          cliente_id?: string | null
          conversa_id: string
          copias?: number
          created_at?: string
          frente_verso?: boolean
          id?: string
          mensagem_id?: string | null
          mime_type?: string | null
          nome?: string
          paginas?: number
          paginas_manuais?: boolean
          pedido_id?: string | null
          storage_path?: string | null
          tipo?: string
          url?: string | null
        }
        Update: {
          cliente_id?: string | null
          conversa_id?: string
          copias?: number
          created_at?: string
          frente_verso?: boolean
          id?: string
          mensagem_id?: string | null
          mime_type?: string | null
          nome?: string
          paginas?: number
          paginas_manuais?: boolean
          pedido_id?: string | null
          storage_path?: string | null
          tipo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_arquivos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_arquivos_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_arquivos_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_arquivos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_auditoria: {
        Row: {
          acao: string
          conversa_id: string | null
          created_at: string
          detalhe: string | null
          id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          conversa_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          conversa_id?: string | null
          created_at?: string
          detalhe?: string | null
          id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_auditoria_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          base_url: string
          bot_ativo: boolean
          conexao_nome: string
          exigir_revisao_humana: boolean
          id: string
          link_exigir_telefone: boolean
          link_permitir_acabamento: boolean
          link_permitir_confirmacao: boolean
          link_permitir_copias: boolean
          link_permitir_formato: boolean
          link_permitir_frente_verso: boolean
          link_permitir_material: boolean
          link_permitir_tipo: boolean
          link_permitir_upload: boolean
          mostrar_precos_link: boolean
          msg_boas_vindas: string
          msg_finalizacao: string
          msg_inicial: string
          msg_orcamento_confirmado: string
          msg_orcamento_gerado: string
          msg_revisao: string
          msg_transferencia: string
          permitir_link: boolean
          permitir_orcamento_automatico: boolean
          reabrir_mesmo_dia: boolean
          updated_at: string
          webhook_token: string
        }
        Insert: {
          base_url?: string
          bot_ativo?: boolean
          conexao_nome?: string
          exigir_revisao_humana?: boolean
          id?: string
          link_exigir_telefone?: boolean
          link_permitir_acabamento?: boolean
          link_permitir_confirmacao?: boolean
          link_permitir_copias?: boolean
          link_permitir_formato?: boolean
          link_permitir_frente_verso?: boolean
          link_permitir_material?: boolean
          link_permitir_tipo?: boolean
          link_permitir_upload?: boolean
          mostrar_precos_link?: boolean
          msg_boas_vindas?: string
          msg_finalizacao?: string
          msg_inicial?: string
          msg_orcamento_confirmado?: string
          msg_orcamento_gerado?: string
          msg_revisao?: string
          msg_transferencia?: string
          permitir_link?: boolean
          permitir_orcamento_automatico?: boolean
          reabrir_mesmo_dia?: boolean
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          base_url?: string
          bot_ativo?: boolean
          conexao_nome?: string
          exigir_revisao_humana?: boolean
          id?: string
          link_exigir_telefone?: boolean
          link_permitir_acabamento?: boolean
          link_permitir_confirmacao?: boolean
          link_permitir_copias?: boolean
          link_permitir_formato?: boolean
          link_permitir_frente_verso?: boolean
          link_permitir_material?: boolean
          link_permitir_tipo?: boolean
          link_permitir_upload?: boolean
          mostrar_precos_link?: boolean
          msg_boas_vindas?: string
          msg_finalizacao?: string
          msg_inicial?: string
          msg_orcamento_confirmado?: string
          msg_orcamento_gerado?: string
          msg_revisao?: string
          msg_transferencia?: string
          permitir_link?: boolean
          permitir_orcamento_automatico?: boolean
          reabrir_mesmo_dia?: boolean
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          atendente_id: string | null
          atendente_nome: string | null
          cliente_id: string | null
          contexto: Json
          created_at: string
          data_finalizacao: string | null
          etapa: string
          id: string
          inicio_atendimento: string | null
          motivo_encaminhamento: string | null
          motivo_finalizacao: string | null
          motivo_pendencia: string | null
          nao_lidas: number
          nome_contato: string | null
          orcamento_id: string | null
          pedido_id: string | null
          status: string
          telefone: string
          total_mensagens: number
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
          updated_at: string
        }
        Insert: {
          atendente_id?: string | null
          atendente_nome?: string | null
          cliente_id?: string | null
          contexto?: Json
          created_at?: string
          data_finalizacao?: string | null
          etapa?: string
          id?: string
          inicio_atendimento?: string | null
          motivo_encaminhamento?: string | null
          motivo_finalizacao?: string | null
          motivo_pendencia?: string | null
          nao_lidas?: number
          nome_contato?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          status?: string
          telefone: string
          total_mensagens?: number
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Update: {
          atendente_id?: string | null
          atendente_nome?: string | null
          cliente_id?: string | null
          contexto?: Json
          created_at?: string
          data_finalizacao?: string | null
          etapa?: string
          id?: string
          inicio_atendimento?: string | null
          motivo_encaminhamento?: string | null
          motivo_finalizacao?: string | null
          motivo_pendencia?: string | null
          nao_lidas?: number
          nome_contato?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          status?: string
          telefone?: string
          total_mensagens?: number
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          arquivo_url: string | null
          autor: string | null
          conversa_id: string
          created_at: string
          data_hora: string
          direcao: string
          erro: string | null
          id: string
          mime_type: string | null
          payload: Json
          status: string
          texto: string | null
          tipo: string
          whatsapp_message_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_url?: string | null
          autor?: string | null
          conversa_id: string
          created_at?: string
          data_hora?: string
          direcao?: string
          erro?: string | null
          id?: string
          mime_type?: string | null
          payload?: Json
          status?: string
          texto?: string | null
          tipo?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          arquivo_url?: string | null
          autor?: string | null
          conversa_id?: string
          created_at?: string
          data_hora?: string
          direcao?: string
          erro?: string | null
          id?: string
          mime_type?: string | null
          payload?: Json
          status?: string
          texto?: string | null
          tipo?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
