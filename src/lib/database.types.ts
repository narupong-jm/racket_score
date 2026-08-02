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
      match_games: {
        Row: {
          game_number: number
          match_id: string
          team1_score: number
          team2_score: number
        }
        Insert: {
          game_number: number
          match_id: string
          team1_score: number
          team2_score: number
        }
        Update: {
          game_number?: number
          match_id?: string
          team1_score?: number
          team2_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          match_id: string
          player_id: string
          team: number
        }
        Insert: {
          match_id: string
          player_id: string
          team: number
        }
        Update: {
          match_id?: string
          player_id?: string
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          manually_adjusted: boolean
          sequence_number: number
          status: string
          tournament_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          manually_adjusted?: boolean
          sequence_number: number
          status?: string
          tournament_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          manually_adjusted?: boolean
          sequence_number?: number
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          gender: string
          id: string
          name: string
          self_selected_level: string
        }
        Insert: {
          created_at?: string
          gender: string
          id?: string
          name: string
          self_selected_level: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          name?: string
          self_selected_level?: string
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          joined_at: string
          player_id: string
          tournament_id: string
        }
        Insert: {
          joined_at?: string
          player_id: string
          tournament_id: string
        }
        Update: {
          joined_at?: string
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          ended_at: string | null
          games_per_match: number
          id: string
          name: string
          point_cap: number | null
          points_per_game: number
          status: string
          type: string
          win_by: number
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          games_per_match: number
          id?: string
          name: string
          point_cap?: number | null
          points_per_game: number
          status?: string
          type: string
          win_by?: number
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          games_per_match?: number
          id?: string
          name?: string
          point_cap?: number | null
          points_per_game?: number
          status?: string
          type?: string
          win_by?: number
        }
        Relationships: []
      }
    }
    Views: {
      player_match_history: {
        Row: {
          completed_at: string | null
          match_id: string | null
          player_id: string | null
          points_for: number | null
          tournament_id: string | null
          tournament_type: string | null
          won: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          effective_level: string | null
          gender: string | null
          name: string | null
          player_id: string | null
          self_selected_level: string | null
          total_matches: number | null
          total_wins: number | null
          win_rate: number | null
        }
        Relationships: []
      }
      tournament_standings: {
        Row: {
          games_played: number | null
          games_won: number | null
          matches_played: number | null
          matches_won: number | null
          name: string | null
          player_id: string | null
          point_diff: number | null
          tournament_id: string | null
          win_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_tournament: {
        Args: { p_tournament_id: string }
        Returns: {
          created_at: string
          ended_at: string | null
          games_per_match: number
          id: string
          name: string
          point_cap: number | null
          points_per_game: number
          status: string
          type: string
          win_by: number
        }
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_match: {
        Args: {
          p_manually_adjusted?: boolean
          p_participants: Json
          p_sequence_number: number
          p_tournament_id: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          id: string
          manually_adjusted: boolean
          sequence_number: number
          status: string
          tournament_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_match_result: {
        Args: { p_games: Json; p_match_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          id: string
          manually_adjusted: boolean
          sequence_number: number
          status: string
          tournament_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
    Enums: {},
  },
} as const
