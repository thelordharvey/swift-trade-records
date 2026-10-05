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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string
          broker: string | null
          created_at: string
          currency: string
          id: string
          ingest_api_key_hash: string | null
          ingest_key_prefix: string | null
          is_archived: boolean
          last_sync_at: string | null
          name: string
          platform: string
          starting_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          broker?: string | null
          created_at?: string
          currency?: string
          id?: string
          ingest_api_key_hash?: string | null
          ingest_key_prefix?: string | null
          is_archived?: boolean
          last_sync_at?: string | null
          name: string
          platform?: string
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_type?: string
          broker?: string | null
          created_at?: string
          currency?: string
          id?: string
          ingest_api_key_hash?: string | null
          ingest_key_prefix?: string | null
          is_archived?: boolean
          last_sync_at?: string | null
          name?: string
          platform?: string
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_journal: {
        Row: {
          created_at: string
          date: string
          id: string
          lessons: string | null
          mood_after: number | null
          mood_before: number | null
          post_market_review: string | null
          pre_market_plan: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          lessons?: string | null
          mood_after?: number | null
          mood_before?: number | null
          post_market_review?: string | null
          pre_market_plan?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          lessons?: string | null
          mood_after?: number | null
          mood_before?: number | null
          post_market_review?: string | null
          pre_market_plan?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          account_id: string | null
          created_at: string
          errors: Json
          id: string
          rows_imported: number
          rows_skipped: number
          rows_total: number
          source: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          errors?: Json
          id?: string
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          source: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          errors?: Json
          id?: string
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_currency: string | null
          default_risk_percent: number | null
          display_name: string | null
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: string | null
          default_risk_percent?: number | null
          display_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string | null
          default_risk_percent?: number | null
          display_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      setups: {
        Row: {
          checklist: Json
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          checklist?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_id: string
          closed_at: string | null
          commission: number
          confidence: number | null
          created_at: string
          direction: string
          emotion_after: string | null
          emotion_before: string | null
          entry_price: number
          exit_price: number | null
          external_id: string | null
          followed_plan: boolean | null
          gross_pnl: number
          id: string
          is_demo: boolean
          lot_size: number
          mistake_tags: string[]
          net_pnl: number | null
          notes: string | null
          opened_at: string
          pips: number | null
          planned_risk_amount: number | null
          planned_rr: number | null
          r_multiple: number | null
          rating: number | null
          session: string | null
          setup_id: string | null
          source: string
          status: string
          stop_loss: number | null
          swap: number
          symbol: string
          tags: string[]
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          closed_at?: string | null
          commission?: number
          confidence?: number | null
          created_at?: string
          direction: string
          emotion_after?: string | null
          emotion_before?: string | null
          entry_price: number
          exit_price?: number | null
          external_id?: string | null
          followed_plan?: boolean | null
          gross_pnl?: number
          id?: string
          is_demo?: boolean
          lot_size?: number
          mistake_tags?: string[]
          net_pnl?: number | null
          notes?: string | null
          opened_at?: string
          pips?: number | null
          planned_risk_amount?: number | null
          planned_rr?: number | null
          r_multiple?: number | null
          rating?: number | null
          session?: string | null
          setup_id?: string | null
          source?: string
          status?: string
          stop_loss?: number | null
          swap?: number
          symbol: string
          tags?: string[]
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          closed_at?: string | null
          commission?: number
          confidence?: number | null
          created_at?: string
          direction?: string
          emotion_after?: string | null
          emotion_before?: string | null
          entry_price?: number
          exit_price?: number | null
          external_id?: string | null
          followed_plan?: boolean | null
          gross_pnl?: number
          id?: string
          is_demo?: boolean
          lot_size?: number
          mistake_tags?: string[]
          net_pnl?: number | null
          notes?: string | null
          opened_at?: string
          pips?: number | null
          planned_risk_amount?: number | null
          planned_rr?: number | null
          r_multiple?: number | null
          rating?: number | null
          session?: string | null
          setup_id?: string | null
          source?: string
          status?: string
          stop_loss?: number | null
          swap?: number
          symbol?: string
          tags?: string[]
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
