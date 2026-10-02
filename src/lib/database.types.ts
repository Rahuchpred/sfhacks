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
          code: string
          created_at: string
          expires_at: string
          id: string
          picked_up_at: string | null
          rescue_id: string
          uid: string
        }
        Insert: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          picked_up_at?: string | null
          rescue_id: string
          uid: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          picked_up_at?: string | null
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
      class_sections: {
        Row: {
          building_id: string | null
          capacity: number
          class_number: string | null
          component: string
          days: string[]
          end_time: string
          ends_on: string | null
          enrolled: number
          id: string
          number: string
          room: string | null
          sample: boolean
          section: string
          start_time: string
          starts_on: string | null
          subject: string
          term: string
          title: string
        }
        Insert: {
          building_id?: string | null
          capacity?: number
          class_number?: string | null
          component?: string
          days: string[]
          end_time: string
          ends_on?: string | null
          enrolled?: number
          id?: string
          number: string
          room?: string | null
          sample?: boolean
          section?: string
          start_time: string
          starts_on?: string | null
          subject: string
          term: string
          title: string
        }
        Update: {
          building_id?: string | null
          capacity?: number
          class_number?: string | null
          component?: string
          days?: string[]
          end_time?: string
          ends_on?: string | null
          enrolled?: number
          id?: string
          number?: string
          room?: string | null
          sample?: boolean
          section?: string
          start_time?: string
          starts_on?: string | null
          subject?: string
          term?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sections_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invites: {
        Row: {
          club_id: string
          code: string
        }
        Insert: {
          club_id: string
          code?: string
        }
        Update: {
          club_id?: string
          code?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          joined_at: string
          role: string
          uid: string
        }
        Insert: {
          club_id: string
          joined_at?: string
          role?: string
          uid: string
        }
        Update: {
          club_id?: string
          joined_at?: string
          role?: string
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          building_id: string
          checked_in_count: number
          club_id: string | null
          club_name: string
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          flyer_url: string | null
          food_items: string[]
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
          club_id?: string | null
          club_name?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at: string
          flyer_url?: string | null
          food_items?: string[]
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
          club_id?: string | null
          club_name?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          flyer_url?: string | null
          food_items?: string[]
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
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
      help_offers: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          note: string
          request_id: string
          status: string
          uid: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string
          request_id: string
          status?: string
          uid: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string
          request_id?: string
          status?: string
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          building_id: string | null
          created_at: string
          created_by: string
          department: string
          description: string
          id: string
          requester_name: string
          reward_detail: string
          reward_type: string
          skills: string[]
          spots: number
          status: string
          time_needed: string
          title: string
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          created_by?: string
          department?: string
          description?: string
          id?: string
          requester_name?: string
          reward_detail?: string
          reward_type: string
          skills?: string[]
          spots?: number
          status?: string
          time_needed?: string
          title: string
        }
        Update: {
          building_id?: string | null
          created_at?: string
          created_by?: string
          department?: string
          description?: string
          id?: string
          requester_name?: string
          reward_detail?: string
          reward_type?: string
          skills?: string[]
          spots?: number
          status?: string
          time_needed?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_summary: string | null
          bio: string
          company: string
          department: string
          email: string | null
          full_name: string
          github_url: string | null
          grad_year: number | null
          id: string
          is_demo: boolean
          linkedin_url: string | null
          major: string
          recruiter_visible: boolean
          resume_url: string | null
          role: string | null
          sfsu_verified: boolean
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          bio?: string
          company?: string
          department?: string
          email?: string | null
          full_name?: string
          github_url?: string | null
          grad_year?: number | null
          id: string
          is_demo?: boolean
          linkedin_url?: string | null
          major?: string
          recruiter_visible?: boolean
          resume_url?: string | null
          role?: string | null
          sfsu_verified?: boolean
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          bio?: string
          company?: string
          department?: string
          email?: string | null
          full_name?: string
          github_url?: string | null
          grad_year?: number | null
          id?: string
          is_demo?: boolean
          linkedin_url?: string | null
          major?: string
          recruiter_visible?: boolean
          resume_url?: string | null
          role?: string | null
          sfsu_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          building_id: string
          capacity: number
          id: string
          kind: string
          room: string
          sample: boolean
        }
        Insert: {
          building_id: string
          capacity: number
          id?: string
          kind?: string
          room: string
          sample?: boolean
        }
        Update: {
          building_id?: string
          capacity?: number
          id?: string
          kind?: string
          room?: string
          sample?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
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
      safety_notices: {
        Row: {
          area: string
          building_id: string | null
          category: string
          fetched_at: string
          id: string
          kind: string
          occurred_on: string | null
          show_pin: boolean
          source_key: string
          source_url: string
          summary: string
          title: string
        }
        Insert: {
          area?: string
          building_id?: string | null
          category: string
          fetched_at?: string
          id?: string
          kind?: string
          occurred_on?: string | null
          show_pin?: boolean
          source_key: string
          source_url: string
          summary: string
          title: string
        }
        Update: {
          area?: string
          building_id?: string | null
          category?: string
          fetched_at?: string
          id?: string
          kind?: string
          occurred_on?: string | null
          show_pin?: boolean
          source_key?: string
          source_url?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_notices_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_event: { Args: { p_event_id: string }; Returns: boolean }
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
      check_in_guest: {
        Args: { p_rsvp_id: string }
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
          claim_code: string
          expires_at: string
          ok: boolean
          portions_left: number
          reason: string
        }[]
      }
      club_audience_majors: {
        Args: { p_club_id: string }
        Returns: {
          attendees: number
          major: string
        }[]
      }
      club_roster: {
        Args: { p_club_id: string }
        Returns: {
          joined_at: string
          member_name: string
          role: string
          uid: string
        }[]
      }
      confirm_pickup: {
        Args: { p_code: string; p_rescue_id: string }
        Returns: {
          guest_name: string
          ok: boolean
          reason: string
        }[]
      }
      create_club: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "clubs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      demo_set_role: {
        Args: { p_role: string }
        Returns: {
          ai_summary: string | null
          bio: string
          company: string
          department: string
          email: string | null
          full_name: string
          github_url: string | null
          grad_year: number | null
          id: string
          is_demo: boolean
          linkedin_url: string | null
          major: string
          recruiter_visible: boolean
          resume_url: string | null
          role: string | null
          sfsu_verified: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
      help_offers_for: {
        Args: { p_request_id: string }
        Returns: {
          completed_at: string
          created_at: string
          events_attended: number
          grad_year: number
          major: string
          note: string
          offer_id: string
          sfsu_verified: boolean
          status: string
          student_id: string
          student_name: string
        }[]
      }
      host_attendance: {
        Args: never
        Returns: {
          checked_in_at: string
          event_id: string
          grad_year: number
          guest_id: string
          guest_name: string
          major: string
          registered_at: string
          rsvp_id: string
          sfsu_verified: boolean
        }[]
      }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      join_club: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "clubs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_role: { Args: never; Returns: string }
      release_expired_claims: { Args: never; Returns: number }
      rescue_claims: {
        Args: { p_rescue_id: string }
        Returns: {
          claim_id: string
          created_at: string
          expires_at: string
          guest_name: string
          picked_up_at: string
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
      set_help_offer_status: {
        Args: { p_offer_id: string; p_status: string }
        Returns: boolean
      }
      set_my_role: {
        Args: { p_role: string }
        Returns: {
          ai_summary: string | null
          bio: string
          company: string
          department: string
          email: string | null
          full_name: string
          github_url: string | null
          grad_year: number | null
          id: string
          is_demo: boolean
          linkedin_url: string | null
          major: string
          recruiter_visible: boolean
          resume_url: string | null
          role: string | null
          sfsu_verified: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      visible_attendance: {
        Args: never
        Returns: {
          club_name: string
          event_id: string
          profile_id: string
          starts_at: string
          tags: string[]
          title: string
        }[]
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
