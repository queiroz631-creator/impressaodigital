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
      configuracoes: {
        Row: {
          email: string | null
          empresa_nome: string
          endereco: string | null
          id: string
          instagram: string | null
          logo_url: string | null
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
          instagram?: string | null
          logo_url?: string | null
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
          instagram?: string | null
          logo_url?: string | null
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
          formato: string
          id: string
          nome: string
          ordem: number
          preco_color: number
          preco_pb: number
          preco_por_arquivo: number
          tipo_impressao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          faixas?: Json
          faixas_por_arquivo?: Json | null
          formato?: string
          id?: string
          nome: string
          ordem?: number
          preco_color?: number
          preco_pb?: number
          preco_por_arquivo?: number
          tipo_impressao?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          faixas?: Json
          faixas_por_arquivo?: Json | null
          formato?: string
          id?: string
          nome?: string
          ordem?: number
          preco_color?: number
          preco_pb?: number
          preco_por_arquivo?: number
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
          cliente_nome: string
          cliente_telefone: string | null
          copia_manual: boolean
          cor_impressao: string
          created_at: string
          frente_verso: boolean
          id: string
          material_id: string | null
          material_nome: string | null
          numero: string
          observacao: string | null
          ordem: number
          paginas_total: number
          pedido_id: string | null
          quantidade_arquivos: number
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
          cliente_nome?: string
          cliente_telefone?: string | null
          copia_manual?: boolean
          cor_impressao?: string
          created_at?: string
          frente_verso?: boolean
          id?: string
          material_id?: string | null
          material_nome?: string | null
          numero?: string
          observacao?: string | null
          ordem?: number
          paginas_total?: number
          pedido_id?: string | null
          quantidade_arquivos?: number
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
          cliente_nome?: string
          cliente_telefone?: string | null
          copia_manual?: boolean
          cor_impressao?: string
          created_at?: string
          frente_verso?: boolean
          id?: string
          material_id?: string | null
          material_nome?: string | null
          numero?: string
          observacao?: string | null
          ordem?: number
          paginas_total?: number
          pedido_id?: string | null
          quantidade_arquivos?: number
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
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          id: string
          numero: string
          observacao: string | null
          status: string
          updated_at: string
          usuario_id: string
          validade: string | null
          valor_total: number
        }
        Insert: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          id?: string
          numero?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string
          validade?: string | null
          valor_total?: number
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          id?: string
          numero?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string
          validade?: string | null
          valor_total?: number
        }
        Relationships: []
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
