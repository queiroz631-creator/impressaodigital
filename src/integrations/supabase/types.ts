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
    PostgrestVersion: "14.5"
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
      bot_fluxo_etapas: {
        Row: {
          acao: string
          ativo: boolean
          configuracao: Json
          created_at: string
          destino_fluxo_id: string | null
          espera_segundos: number
          fluxo_id: string
          id: string
          mensagem: string
          midia_nome: string | null
          midia_url: string | null
          modo_avanco: string
          nome: string
          ordem: number
          proxima_etapa_id: string | null
          tipo_mensagem: string
          tipo_resposta: string
          updated_at: string
        }
        Insert: {
          acao?: string
          ativo?: boolean
          configuracao?: Json
          created_at?: string
          destino_fluxo_id?: string | null
          espera_segundos?: number
          fluxo_id: string
          id?: string
          mensagem?: string
          midia_nome?: string | null
          midia_url?: string | null
          modo_avanco?: string
          nome: string
          ordem?: number
          proxima_etapa_id?: string | null
          tipo_mensagem?: string
          tipo_resposta?: string
          updated_at?: string
        }
        Update: {
          acao?: string
          ativo?: boolean
          configuracao?: Json
          created_at?: string
          destino_fluxo_id?: string | null
          espera_segundos?: number
          fluxo_id?: string
          id?: string
          mensagem?: string
          midia_nome?: string | null
          midia_url?: string | null
          modo_avanco?: string
          nome?: string
          ordem?: number
          proxima_etapa_id?: string | null
          tipo_mensagem?: string
          tipo_resposta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_fluxo_etapas_destino_fluxo_id_fkey"
            columns: ["destino_fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_fluxo_etapas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_fluxo_etapas_proxima_etapa_id_fkey"
            columns: ["proxima_etapa_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxo_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_fluxo_opcoes: {
        Row: {
          acao: string
          ativo: boolean
          configuracao: Json
          created_at: string
          destino_etapa_id: string | null
          destino_fluxo_id: string | null
          etapa_id: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
          valor: string
        }
        Insert: {
          acao?: string
          ativo?: boolean
          configuracao?: Json
          created_at?: string
          destino_etapa_id?: string | null
          destino_fluxo_id?: string | null
          etapa_id: string
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
          valor?: string
        }
        Update: {
          acao?: string
          ativo?: boolean
          configuracao?: Json
          created_at?: string
          destino_etapa_id?: string | null
          destino_fluxo_id?: string | null
          etapa_id?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_fluxo_opcoes_destino_etapa_id_fkey"
            columns: ["destino_etapa_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxo_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_fluxo_opcoes_destino_fluxo_id_fkey"
            columns: ["destino_fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_fluxo_opcoes_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxo_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_fluxos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          icone: string
          id: string
          mensagem_inicial: string
          mensagem_unica: boolean
          mostrar_finalizacao: boolean
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          mensagem_inicial?: string
          mensagem_unica?: boolean
          mostrar_finalizacao?: boolean
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          mensagem_inicial?: string
          mensagem_unica?: boolean
          mostrar_finalizacao?: boolean
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      bot_horarios: {
        Row: {
          abre: string
          created_at: string
          dia_semana: number
          fecha: string
          fechado: boolean
          id: string
          updated_at: string
        }
        Insert: {
          abre?: string
          created_at?: string
          dia_semana: number
          fecha?: string
          fechado?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          abre?: string
          created_at?: string
          dia_semana?: number
          fecha?: string
          fechado?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_menu_opcoes: {
        Row: {
          acao: string
          ativo: boolean
          created_at: string
          id: string
          mensagem: string
          nome: string
          ordem: number
          permitir_palavra_chave: boolean
          updated_at: string
        }
        Insert: {
          acao?: string
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem?: string
          nome: string
          ordem?: number
          permitir_palavra_chave?: boolean
          updated_at?: string
        }
        Update: {
          acao?: string
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem?: string
          nome?: string
          ordem?: number
          permitir_palavra_chave?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bot_numeros: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string | null
          observacao: string | null
          permitido: boolean
          telefone: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string | null
          observacao?: string | null
          permitido?: boolean
          telefone: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string | null
          observacao?: string | null
          permitido?: boolean
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_palavras_chave: {
        Row: {
          created_at: string
          id: string
          opcao_id: string | null
          resposta_id: string | null
          texto: string
        }
        Insert: {
          created_at?: string
          id?: string
          opcao_id?: string | null
          resposta_id?: string | null
          texto: string
        }
        Update: {
          created_at?: string
          id?: string
          opcao_id?: string | null
          resposta_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_palavras_chave_opcao_id_fkey"
            columns: ["opcao_id"]
            isOneToOne: false
            referencedRelation: "bot_menu_opcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_palavras_chave_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "bot_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_primeiro_contato: {
        Row: {
          acao: string
          ativo: boolean
          condicao: string
          created_at: string
          delay_mensagem_segundos: number
          delay_segundos: number
          destino_fluxo_id: string | null
          destino_resposta_id: string | null
          enviar_mensagem: string
          id: string
          mensagem: string
          nome: string
          ordem: number
          palavras: string[]
          updated_at: string
        }
        Insert: {
          acao?: string
          ativo?: boolean
          condicao?: string
          created_at?: string
          delay_mensagem_segundos?: number
          delay_segundos?: number
          destino_fluxo_id?: string | null
          destino_resposta_id?: string | null
          enviar_mensagem?: string
          id?: string
          mensagem?: string
          nome?: string
          ordem?: number
          palavras?: string[]
          updated_at?: string
        }
        Update: {
          acao?: string
          ativo?: boolean
          condicao?: string
          created_at?: string
          delay_mensagem_segundos?: number
          delay_segundos?: number
          destino_fluxo_id?: string | null
          destino_resposta_id?: string | null
          enviar_mensagem?: string
          id?: string
          mensagem?: string
          nome?: string
          ordem?: number
          palavras?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_primeiro_contato_destino_fluxo_id_fkey"
            columns: ["destino_fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_primeiro_contato_destino_resposta_id_fkey"
            columns: ["destino_resposta_id"]
            isOneToOne: false
            referencedRelation: "bot_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_respostas: {
        Row: {
          acao_nao: string
          acao_sim: string
          ativo: boolean
          created_at: string
          delay_acao_segundos: number
          destino_nao_fluxo_id: string | null
          destino_nao_resposta_id: string | null
          destino_sim_fluxo_id: string | null
          destino_sim_resposta_id: string | null
          id: string
          midia_nome: string | null
          midia_url: string | null
          ordem: number
          pergunta_confirmacao: string
          resposta: string
          resposta_retorno_dia: string
          tipo_midia: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_nao?: string
          acao_sim?: string
          ativo?: boolean
          created_at?: string
          delay_acao_segundos?: number
          destino_nao_fluxo_id?: string | null
          destino_nao_resposta_id?: string | null
          destino_sim_fluxo_id?: string | null
          destino_sim_resposta_id?: string | null
          id?: string
          midia_nome?: string | null
          midia_url?: string | null
          ordem?: number
          pergunta_confirmacao?: string
          resposta?: string
          resposta_retorno_dia?: string
          tipo_midia?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_nao?: string
          acao_sim?: string
          ativo?: boolean
          created_at?: string
          delay_acao_segundos?: number
          destino_nao_fluxo_id?: string | null
          destino_nao_resposta_id?: string | null
          destino_sim_fluxo_id?: string | null
          destino_sim_resposta_id?: string | null
          id?: string
          midia_nome?: string | null
          midia_url?: string | null
          ordem?: number
          pergunta_confirmacao?: string
          resposta?: string
          resposta_retorno_dia?: string
          tipo_midia?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_respostas_destino_nao_fluxo_id_fkey"
            columns: ["destino_nao_fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_respostas_destino_nao_resposta_id_fkey"
            columns: ["destino_nao_resposta_id"]
            isOneToOne: false
            referencedRelation: "bot_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_respostas_destino_sim_fluxo_id_fkey"
            columns: ["destino_sim_fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_respostas_destino_sim_resposta_id_fkey"
            columns: ["destino_sim_resposta_id"]
            isOneToOne: false
            referencedRelation: "bot_respostas"
            referencedColumns: ["id"]
          },
        ]
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
          areas_impressao: Json
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
          areas_impressao?: Json
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
          areas_impressao?: Json
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
      curriculo_cursos: {
        Row: {
          ano: string | null
          created_at: string
          curriculo_id: string
          id: string
          instituicao: string | null
          nome_curso: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ano?: string | null
          created_at?: string
          curriculo_id: string
          id?: string
          instituicao?: string | null
          nome_curso: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ano?: string | null
          created_at?: string
          curriculo_id?: string
          id?: string
          instituicao?: string | null
          nome_curso?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculo_cursos_curriculo_id_fkey"
            columns: ["curriculo_id"]
            isOneToOne: false
            referencedRelation: "curriculos"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculo_experiencias: {
        Row: {
          atividades: string | null
          cargo: string | null
          created_at: string
          curriculo_id: string
          empresa: string | null
          id: string
          ordem: number
          periodo: string | null
          updated_at: string
        }
        Insert: {
          atividades?: string | null
          cargo?: string | null
          created_at?: string
          curriculo_id: string
          empresa?: string | null
          id?: string
          ordem?: number
          periodo?: string | null
          updated_at?: string
        }
        Update: {
          atividades?: string | null
          cargo?: string | null
          created_at?: string
          curriculo_id?: string
          empresa?: string | null
          id?: string
          ordem?: number
          periodo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculo_experiencias_curriculo_id_fkey"
            columns: ["curriculo_id"]
            isOneToOne: false
            referencedRelation: "curriculos"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculo_formacoes: {
        Row: {
          ano: string | null
          created_at: string
          curriculo_id: string
          id: string
          instituicao: string | null
          nivel: string | null
          nome_curso: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ano?: string | null
          created_at?: string
          curriculo_id: string
          id?: string
          instituicao?: string | null
          nivel?: string | null
          nome_curso: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ano?: string | null
          created_at?: string
          curriculo_id?: string
          id?: string
          instituicao?: string | null
          nivel?: string | null
          nome_curso?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculo_formacoes_curriculo_id_fkey"
            columns: ["curriculo_id"]
            isOneToOne: false
            referencedRelation: "curriculos"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculo_habilidades: {
        Row: {
          created_at: string
          curriculo_id: string
          descricao: string
          habilidade_id: string | null
          id: string
          ordem: number
        }
        Insert: {
          created_at?: string
          curriculo_id: string
          descricao: string
          habilidade_id?: string | null
          id?: string
          ordem?: number
        }
        Update: {
          created_at?: string
          curriculo_id?: string
          descricao?: string
          habilidade_id?: string | null
          id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculo_habilidades_curriculo_id_fkey"
            columns: ["curriculo_id"]
            isOneToOne: false
            referencedRelation: "curriculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculo_habilidades_habilidade_id_fkey"
            columns: ["habilidade_id"]
            isOneToOne: false
            referencedRelation: "habilidades_curriculo"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculo_links: {
        Row: {
          ativo: boolean
          created_at: string
          curriculo_id: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          curriculo_id?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          curriculo_id?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculo_links_curriculo_id_fkey"
            columns: ["curriculo_id"]
            isOneToOne: false
            referencedRelation: "curriculos"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculo_telefones: {
        Row: {
          created_at: string
          curriculo_id: string
          id: string
          ordem: number
          telefone: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          curriculo_id: string
          id?: string
          ordem?: number
          telefone: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          curriculo_id?: string
          id?: string
          ordem?: number
          telefone?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculo_telefones_curriculo_id_fkey"
            columns: ["curriculo_id"]
            isOneToOne: false
            referencedRelation: "curriculos"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculos: {
        Row: {
          bairro: string | null
          categoria_habilitacao: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string | null
          completed_at: string | null
          cpf: string
          created_at: string
          curso_superior: string | null
          data_nascimento: string | null
          documentacao_completa: boolean | null
          email: string | null
          endereco: string | null
          escolaridade: string | null
          estado_civil: string | null
          exibir_data_atualizacao: boolean
          experiencia_frase: string | null
          experiencia_possui: boolean
          foto_exibir: boolean
          foto_url: string | null
          habilidades_observacao: string | null
          habilitacao: boolean
          id: string
          nome_completo: string
          numero: string | null
          objetivo_texto: string | null
          objetivo_tipo: string
          pos_graduacao_nome: string | null
          status: string
          telefone_principal: string
          telefone_principal_descricao: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          categoria_habilitacao?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          completed_at?: string | null
          cpf: string
          created_at?: string
          curso_superior?: string | null
          data_nascimento?: string | null
          documentacao_completa?: boolean | null
          email?: string | null
          endereco?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          exibir_data_atualizacao?: boolean
          experiencia_frase?: string | null
          experiencia_possui?: boolean
          foto_exibir?: boolean
          foto_url?: string | null
          habilidades_observacao?: string | null
          habilitacao?: boolean
          id?: string
          nome_completo?: string
          numero?: string | null
          objetivo_texto?: string | null
          objetivo_tipo?: string
          pos_graduacao_nome?: string | null
          status?: string
          telefone_principal?: string
          telefone_principal_descricao?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          categoria_habilitacao?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          completed_at?: string | null
          cpf?: string
          created_at?: string
          curso_superior?: string | null
          data_nascimento?: string | null
          documentacao_completa?: boolean | null
          email?: string | null
          endereco?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          exibir_data_atualizacao?: boolean
          experiencia_frase?: string | null
          experiencia_possui?: boolean
          foto_exibir?: boolean
          foto_url?: string | null
          habilidades_observacao?: string | null
          habilitacao?: boolean
          id?: string
          nome_completo?: string
          numero?: string | null
          objetivo_texto?: string | null
          objetivo_tipo?: string
          pos_graduacao_nome?: string | null
          status?: string
          telefone_principal?: string
          telefone_principal_descricao?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      habilidades_curriculo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
        }
        Relationships: []
      }
      materiais: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string
          faixas: Json
          faixas_por_arquivo: Json | null
          faixas_por_copia_adicional: Json
          formato: string
          id: string
          nome: string
          ordem: number
          perfil_impressao_id: string | null
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
          categoria?: string
          created_at?: string
          descricao?: string
          faixas?: Json
          faixas_por_arquivo?: Json | null
          faixas_por_copia_adicional?: Json
          formato?: string
          id?: string
          nome: string
          ordem?: number
          perfil_impressao_id?: string | null
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
          categoria?: string
          created_at?: string
          descricao?: string
          faixas?: Json
          faixas_por_arquivo?: Json | null
          faixas_por_copia_adicional?: Json
          formato?: string
          id?: string
          nome?: string
          ordem?: number
          perfil_impressao_id?: string | null
          preco_arquivos_fixo?: number | null
          preco_color?: number
          preco_pb?: number
          preco_por_arquivo?: number
          quantidade_arquivos_fixo?: number | null
          tipo_impressao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_perfil_impressao_id_fkey"
            columns: ["perfil_impressao_id"]
            isOneToOne: false
            referencedRelation: "perfis_impressao"
            referencedColumns: ["id"]
          },
        ]
      }
      melhorias: {
        Row: {
          created_at: string
          descricao: string | null
          executada: boolean
          id: string
          status: string
          tela: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          executada?: boolean
          id?: string
          status?: string
          tela: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          executada?: boolean
          id?: string
          status?: string
          tela?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      objetivos_curriculo: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          texto: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto?: string
        }
        Relationships: []
      }
      orcamento_links: {
        Row: {
          aberto_em: string | null
          cancelado: boolean
          confirmado_em: string | null
          conversa_id: string | null
          created_at: string
          expira_em: string
          id: string
          orcamento_id: string
          pedido_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          aberto_em?: string | null
          cancelado?: boolean
          confirmado_em?: string | null
          conversa_id?: string | null
          created_at?: string
          expira_em?: string
          id?: string
          orcamento_id: string
          pedido_id?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          aberto_em?: string | null
          cancelado?: boolean
          confirmado_em?: string | null
          conversa_id?: string | null
          created_at?: string
          expira_em?: string
          id?: string
          orcamento_id?: string
          pedido_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_links_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_links_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_links_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
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
      perfis_impressao: {
        Row: {
          altura_mm: number
          ativo: boolean
          bandeja: string | null
          copias: number
          cor: string
          created_at: string
          duplex: string
          id: string
          impressora: string | null
          largura_mm: number
          midia: string
          nome: string
          ordem: number
          orientacao: string
          qualidade: string
          tamanho: string
          updated_at: string
        }
        Insert: {
          altura_mm?: number
          ativo?: boolean
          bandeja?: string | null
          copias?: number
          cor?: string
          created_at?: string
          duplex?: string
          id?: string
          impressora?: string | null
          largura_mm?: number
          midia?: string
          nome: string
          ordem?: number
          orientacao?: string
          qualidade?: string
          tamanho?: string
          updated_at?: string
        }
        Update: {
          altura_mm?: number
          ativo?: boolean
          bandeja?: string | null
          copias?: number
          cor?: string
          created_at?: string
          duplex?: string
          id?: string
          impressora?: string | null
          largura_mm?: number
          midia?: string
          nome?: string
          ordem?: number
          orientacao?: string
          qualidade?: string
          tamanho?: string
          updated_at?: string
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
          bot_24h: boolean
          bot_ativo: boolean
          conexao_nome: string
          enviar_msg_finalizacao: boolean
          exigir_revisao_humana: boolean
          fallback_fluxo_id: string | null
          fallback_inicial_minutos: number
          finalizacao_delay_minutos: number
          finalizacao_uma_vez_dia: boolean
          fluxo_finalizacao_id: string | null
          id: string
          ignorar_agradecimentos: Json
          inatividade_minutos: number
          inatividade_status: string
          inatividade1_minutos: number
          inatividade2_minutos: number
          link_exigir_telefone: boolean
          link_permitir_acabamento: boolean
          link_permitir_confirmacao: boolean
          link_permitir_copias: boolean
          link_permitir_formato: boolean
          link_permitir_frente_verso: boolean
          link_permitir_material: boolean
          link_permitir_tipo: boolean
          link_permitir_upload: boolean
          modo_numeros: string
          mostrar_precos_link: boolean
          msg_boas_vindas: string
          msg_finalizacao: string
          msg_finalizacao_ativo: boolean
          msg_fora_horario: string
          msg_fora_horario_ativo: boolean
          msg_inatividade_aguardando: string
          msg_inatividade_em_atendimento: string
          msg_inatividade_finalizado: string
          msg_inatividade_pendente: string
          msg_inatividade1: string
          msg_inicial: string
          msg_menu: string
          msg_nao_entendi: string
          msg_orcamento_confirmado: string
          msg_orcamento_confirmado_ativo: boolean
          msg_orcamento_gerado: string
          msg_orcamento_gerado_ativo: boolean
          msg_retorno_dia: string
          msg_revisao: string
          msg_revisao_ativo: boolean
          msg_transferencia: string
          msg_transferencia_ativo: boolean
          msg_transferencia_fora_horario: string
          msg_transferencia_fora_horario_ativo: boolean
          permitir_link: boolean
          permitir_orcamento_automatico: boolean
          reabrir_mesmo_dia: boolean
          updated_at: string
          usar_ia: boolean
          webhook_token: string
        }
        Insert: {
          base_url?: string
          bot_24h?: boolean
          bot_ativo?: boolean
          conexao_nome?: string
          enviar_msg_finalizacao?: boolean
          exigir_revisao_humana?: boolean
          fallback_fluxo_id?: string | null
          fallback_inicial_minutos?: number
          finalizacao_delay_minutos?: number
          finalizacao_uma_vez_dia?: boolean
          fluxo_finalizacao_id?: string | null
          id?: string
          ignorar_agradecimentos?: Json
          inatividade_minutos?: number
          inatividade_status?: string
          inatividade1_minutos?: number
          inatividade2_minutos?: number
          link_exigir_telefone?: boolean
          link_permitir_acabamento?: boolean
          link_permitir_confirmacao?: boolean
          link_permitir_copias?: boolean
          link_permitir_formato?: boolean
          link_permitir_frente_verso?: boolean
          link_permitir_material?: boolean
          link_permitir_tipo?: boolean
          link_permitir_upload?: boolean
          modo_numeros?: string
          mostrar_precos_link?: boolean
          msg_boas_vindas?: string
          msg_finalizacao?: string
          msg_finalizacao_ativo?: boolean
          msg_fora_horario?: string
          msg_fora_horario_ativo?: boolean
          msg_inatividade_aguardando?: string
          msg_inatividade_em_atendimento?: string
          msg_inatividade_finalizado?: string
          msg_inatividade_pendente?: string
          msg_inatividade1?: string
          msg_inicial?: string
          msg_menu?: string
          msg_nao_entendi?: string
          msg_orcamento_confirmado?: string
          msg_orcamento_confirmado_ativo?: boolean
          msg_orcamento_gerado?: string
          msg_orcamento_gerado_ativo?: boolean
          msg_retorno_dia?: string
          msg_revisao?: string
          msg_revisao_ativo?: boolean
          msg_transferencia?: string
          msg_transferencia_ativo?: boolean
          msg_transferencia_fora_horario?: string
          msg_transferencia_fora_horario_ativo?: boolean
          permitir_link?: boolean
          permitir_orcamento_automatico?: boolean
          reabrir_mesmo_dia?: boolean
          updated_at?: string
          usar_ia?: boolean
          webhook_token?: string
        }
        Update: {
          base_url?: string
          bot_24h?: boolean
          bot_ativo?: boolean
          conexao_nome?: string
          enviar_msg_finalizacao?: boolean
          exigir_revisao_humana?: boolean
          fallback_fluxo_id?: string | null
          fallback_inicial_minutos?: number
          finalizacao_delay_minutos?: number
          finalizacao_uma_vez_dia?: boolean
          fluxo_finalizacao_id?: string | null
          id?: string
          ignorar_agradecimentos?: Json
          inatividade_minutos?: number
          inatividade_status?: string
          inatividade1_minutos?: number
          inatividade2_minutos?: number
          link_exigir_telefone?: boolean
          link_permitir_acabamento?: boolean
          link_permitir_confirmacao?: boolean
          link_permitir_copias?: boolean
          link_permitir_formato?: boolean
          link_permitir_frente_verso?: boolean
          link_permitir_material?: boolean
          link_permitir_tipo?: boolean
          link_permitir_upload?: boolean
          modo_numeros?: string
          mostrar_precos_link?: boolean
          msg_boas_vindas?: string
          msg_finalizacao?: string
          msg_finalizacao_ativo?: boolean
          msg_fora_horario?: string
          msg_fora_horario_ativo?: boolean
          msg_inatividade_aguardando?: string
          msg_inatividade_em_atendimento?: string
          msg_inatividade_finalizado?: string
          msg_inatividade_pendente?: string
          msg_inatividade1?: string
          msg_inicial?: string
          msg_menu?: string
          msg_nao_entendi?: string
          msg_orcamento_confirmado?: string
          msg_orcamento_confirmado_ativo?: boolean
          msg_orcamento_gerado?: string
          msg_orcamento_gerado_ativo?: boolean
          msg_retorno_dia?: string
          msg_revisao?: string
          msg_revisao_ativo?: boolean
          msg_transferencia?: string
          msg_transferencia_ativo?: boolean
          msg_transferencia_fora_horario?: string
          msg_transferencia_fora_horario_ativo?: boolean
          permitir_link?: boolean
          permitir_orcamento_automatico?: boolean
          reabrir_mesmo_dia?: boolean
          updated_at?: string
          usar_ia?: boolean
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_fallback_fluxo_id_fkey"
            columns: ["fallback_fluxo_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_config_fluxo_finalizacao_id_fkey"
            columns: ["fluxo_finalizacao_id"]
            isOneToOne: false
            referencedRelation: "bot_fluxos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversas: {
        Row: {
          atendente_id: string | null
          atendente_nome: string | null
          atendimento_numero: number
          bot_lock_em: string | null
          bot_pendente: boolean
          bot_pendente_em: string | null
          chat_lid: string | null
          cliente_id: string | null
          contexto: Json
          created_at: string
          data_finalizacao: string | null
          etapa: string
          finalizacao_em: string | null
          finalizacao_fluxo_em: string | null
          id: string
          inatividade_avisada: boolean
          inatividade_etapa: number
          inicio_atendimento: string | null
          motivo_encaminhamento: string | null
          motivo_finalizacao: string | null
          motivo_pendencia: string | null
          nao_lidas: number
          nome_contato: string | null
          orcamento_id: string | null
          pedido_id: string | null
          saudacao_em: string | null
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
          atendimento_numero?: number
          bot_lock_em?: string | null
          bot_pendente?: boolean
          bot_pendente_em?: string | null
          chat_lid?: string | null
          cliente_id?: string | null
          contexto?: Json
          created_at?: string
          data_finalizacao?: string | null
          etapa?: string
          finalizacao_em?: string | null
          finalizacao_fluxo_em?: string | null
          id?: string
          inatividade_avisada?: boolean
          inatividade_etapa?: number
          inicio_atendimento?: string | null
          motivo_encaminhamento?: string | null
          motivo_finalizacao?: string | null
          motivo_pendencia?: string | null
          nao_lidas?: number
          nome_contato?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          saudacao_em?: string | null
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
          atendimento_numero?: number
          bot_lock_em?: string | null
          bot_pendente?: boolean
          bot_pendente_em?: string | null
          chat_lid?: string | null
          cliente_id?: string | null
          contexto?: Json
          created_at?: string
          data_finalizacao?: string | null
          etapa?: string
          finalizacao_em?: string | null
          finalizacao_fluxo_em?: string | null
          id?: string
          inatividade_avisada?: boolean
          inatividade_etapa?: number
          inicio_atendimento?: string | null
          motivo_encaminhamento?: string | null
          motivo_finalizacao?: string | null
          motivo_pendencia?: string | null
          nao_lidas?: number
          nome_contato?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          saudacao_em?: string | null
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
          transcricao: string | null
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
          transcricao?: string | null
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
          transcricao?: string | null
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
