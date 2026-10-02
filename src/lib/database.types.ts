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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      buildings: {
        Row: {
          aliases: string[]
          id: string
          lat: number
          lng: number
          name: string
        }
        Insert: {
          aliases?: string[]
          id: string
          lat: number
          lng: number
          name: string
        }
        Update: {
          aliases?: string[]
          id?: string
          lat?: number
          lng?: number
          name?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          created_at: string
          id: string
          rescue_id: string
          uid: string
        }
        Insert: {
          created_at?: string
          id?: string
          rescue_id: string
          uid: string
        }
        Update: {
          created_at?: string
          id?: string
          rescue_id?: string
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_rescue_id_fkey"
            columns: ["rescue_id"]
            isOneToOne: false
            referencedRelation: "food_rescues"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          building_id: string
          checked_in_count: number
          club_name: string
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          flyer_url: string | null
          has_food: boolean
          id: string
          room: string | null
          rsvp_count: number
          source: string
          starts_at: string
          tags: string[]
          title: string
        }
        Insert: {
          building_id: string
          checked_in_count?: number
          club_name?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at: string
          flyer_url?: string | null
          has_food?: boolean
          id?: string
          room?: string | null
          rsvp_count?: number
          source?: string
          starts_at: string
          tags?: string[]
          title: string
        }
        Update: {
          building_id?: string
          checked_in_count?: number
          club_name?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          flyer_url?: string | null
          has_food?: boolean
          id?: string
          room?: string | null
          rsvp_count?: number
          source?: string
          starts_at?: string
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      food_rescues: {
        Row: {
          building_id: string
          created_at: string
          created_by: string | null
          dietary: string[]
          event_id: string | null
          id: string
          items: string
          max_per_person: number
          photo_url: string
          portions: number
          portions_left: number
          room: string | null
          safe_until: string
          status: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by?: string | null
          dietary?: string[]
          event_id?: string | null
          id?: string
          items: string
          max_per_person?: number
          photo_url: string
          portions: number
          portions_left: number
          room?: string | null
          safe_until: string
          status?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string | null
          dietary?: string[]
          event_id?: string | null
          id?: string
          items?: string
          max_per_person?: number
          photo_url?: string
          portions?: number
          portions_left?: number
          room?: string | null
          safe_until?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_rescues_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_rescues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_summary: string | null
          bio: string
          email: string | null
          full_name: string
          github_url: string | null
          grad_year: number | null
          id: string
          linkedin_url: string | null
          major: string
          recruiter_visible: boolean
          resume_url: string | null
          sfsu_verified: boolean
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          bio?: string
          email?: string | null
          full_name?: string
          github_url?: string | null
          grad_year?: number | null
          id: string
          linkedin_url?: string | null
          major?: string
          recruiter_visible?: boolean
          resume_url?: string | null
          sfsu_verified?: boolean
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          bio?: string
          email?: string | null
          full_name?: string
          github_url?: string | null
          grad_year?: number | null
          id?: string
          linkedin_url?: string | null
          major?: string
          recruiter_visible?: boolean
          resume_url?: string | null
          sfsu_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          checked_in_at: string | null
          code: string
          created_at: string
          event_id: string
          id: string
          uid: string
        }
        Insert: {
          checked_in_at?: string | null
          code?: string
          created_at?: string
          event_id: string
          id?: string
          uid: string
        }
        Update: {
          checked_in_at?: string | null
          code?: string
          created_at?: string
          event_id?: string
          id?: string
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_rsvp: { Args: { p_event_id: string }; Returns: boolean }
      check_in: {
        Args: { p_code: string }
        Returns: {
          checked_in_at: string
          event_id: string
          guest_name: string
          ok: boolean
          reason: string
        }[]
      }
      claim_portion: {
        Args: { p_rescue_id: string }
        Returns: {
          ok: boolean
          portions_left: number
          reason: string
        }[]
      }
      event_guests: {
        Args: { p_event_id: string }
        Returns: {
          checked_in_at: string
          created_at: string
          guest_name: string
          rsvp_id: string
          sfsu_verified: boolean
        }[]
      }
      rsvp_event: {
        Args: { p_event_id: string }
        Returns: {
          checked_in_at: string | null
          code: string
          created_at: string
          event_id: string
          id: string
          uid: string
        }
        SetofOptions: {
          from: "*"
          to: "rsvps"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
