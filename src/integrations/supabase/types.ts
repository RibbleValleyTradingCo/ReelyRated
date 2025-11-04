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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      catches: {
        Row: {
          allow_ratings: boolean | null
          bait_used: string | null
          caught_at: string | null
          conditions: Json | null
          created_at: string
          description: string | null
          equipment_used: string | null
          gallery_photos: string[] | null
          hide_exact_spot: boolean | null
          id: string
          image_url: string
          length: number | null
          length_unit: Database["public"]["Enums"]["length_unit"] | null
          location: string | null
          method: string | null
          peg_or_swim: string | null
          species: Database["public"]["Enums"]["species_type"] | null
          session_id: string | null
          tags: string[] | null
          time_of_day: Database["public"]["Enums"]["time_of_day"] | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: Database["public"]["Enums"]["visibility_type"] | null
          water_type: string | null
          weight: number | null
          weight_unit: Database["public"]["Enums"]["weight_unit"] | null
        }
        Insert: {
          allow_ratings?: boolean | null
          bait_used?: string | null
          caught_at?: string | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          equipment_used?: string | null
          gallery_photos?: string[] | null
          hide_exact_spot?: boolean | null
          id?: string
          image_url: string
          length?: number | null
          length_unit?: Database["public"]["Enums"]["length_unit"] | null
          location?: string | null
          method?: string | null
          peg_or_swim?: string | null
          species?: Database["public"]["Enums"]["species_type"] | null
          session_id?: string | null
          tags?: string[] | null
          time_of_day?: Database["public"]["Enums"]["time_of_day"] | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: Database["public"]["Enums"]["visibility_type"] | null
          water_type?: string | null
          weight?: number | null
          weight_unit?: Database["public"]["Enums"]["weight_unit"] | null
        }
        Update: {
          allow_ratings?: boolean | null
          bait_used?: string | null
          caught_at?: string | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          equipment_used?: string | null
          gallery_photos?: string[] | null
          hide_exact_spot?: boolean | null
          id?: string
          image_url?: string
          length?: number | null
          length_unit?: Database["public"]["Enums"]["length_unit"] | null
          location?: string | null
          method?: string | null
          peg_or_swim?: string | null
          species?: Database["public"]["Enums"]["species_type"] | null
          session_id?: string | null
          tags?: string[] | null
          time_of_day?: Database["public"]["Enums"]["time_of_day"] | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: Database["public"]["Enums"]["visibility_type"] | null
          water_type?: string | null
          weight?: number | null
          weight_unit?: Database["public"]["Enums"]["weight_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "catches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_comments: {
        Row: {
          body: string
          catch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          catch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          catch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_comments_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_reactions: {
        Row: {
          catch_id: string
          created_at: string
          id: string
          reaction: string | null
          user_id: string
        }
        Insert: {
          catch_id: string
          created_at?: string
          id?: string
          reaction?: string | null
          user_id: string
        }
        Update: {
          catch_id?: string
          created_at?: string
          id?: string
          reaction?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_reactions_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      baits: {
        Row: {
          category: string
          created_at: string
          label: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          label: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      water_types: {
        Row: {
          code: string
          created_at: string
          group_name: string
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          group_name: string
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          group_name?: string
          label?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          category: string | null
          id: string
          label: string
          slug: string
          method_group: string | null
        }
        Insert: {
          category?: string | null
          id?: string
          label: string
          slug: string
          method_group?: string | null
        }
        Update: {
          category?: string | null
          id?: string
          label?: string
          slug?: string
          method_group?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          is_read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          is_read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          date: string | null
          id: string
          notes: string | null
          title: string
          user_id: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          notes?: string | null
          title: string
          user_id: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          notes?: string | null
          title?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          catch_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          catch_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          catch_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      profile_follows: {
        Row: {
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles_followers: {
        Row: Database["public"]["Tables"]["profile_follows"]["Row"]
        Insert: Database["public"]["Tables"]["profile_follows"]["Insert"]
        Update: Database["public"]["Tables"]["profile_follows"]["Update"]
        Relationships: Database["public"]["Tables"]["profile_follows"]["Relationships"]
      }
      ratings: {
        Row: {
          catch_id: string
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          catch_id: string
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          catch_id?: string
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      fishing_method:
        | "waggler"
        | "feeder"
        | "pole"
        | "stalking"
        | "surface"
        | "lure"
        | "deadbait"
        | "fly"
        | "other"
      length_unit: "cm" | "in"
      species_type:
        | "arctic_char"
        | "atlantic_salmon"
        | "barbel"
        | "bleak"
        | "bream"
        | "common_bream"
        | "silver_bream"
        | "brown_trout"
        | "trout"
        | "bullhead"
        | "carp"
        | "common_carp"
        | "mirror_carp"
        | "leather_carp"
        | "ghost_carp"
        | "grass_carp"
        | "crucian_carp"
        | "wels_catfish"
        | "catfish"
        | "chub"
        | "dace"
        | "european_eel"
        | "ferox_trout"
        | "golden_orfe"
        | "grayling"
        | "gudgeon"
        | "ide"
        | "lamprey"
        | "perch"
        | "pike"
        | "powan"
        | "rainbow_trout"
        | "roach"
        | "rudd"
        | "sea_trout"
        | "smelt"
        | "stickleback"
        | "stone_loach"
        | "sturgeon"
        | "tench"
        | "zander"
        | "other"
      time_of_day: "morning" | "afternoon" | "evening" | "night"
      visibility_type: "public" | "followers" | "private"
      water_clarity: "clear" | "coloured" | "unknown"
      water_type:
        | "commercial"
        | "club"
        | "river"
        | "canal"
        | "stillwater"
        | "lake"
        | "stream"
        | "pond"
        | "reservoir"
        | "drain"
        | "navigation"
      weather_type: "sunny" | "overcast" | "raining" | "windy"
      weight_unit: "lb_oz" | "kg"
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
      fishing_method: [
        "waggler",
        "feeder",
        "pole",
        "stalking",
        "surface",
        "lure",
        "deadbait",
        "fly",
        "other",
      ],
      length_unit: ["cm", "in"],
      species_type: [
        "carp",
        "mirror_carp",
        "common_carp",
        "barbel",
        "pike",
        "perch",
        "trout",
        "tench",
        "bream",
        "catfish",
        "other",
      ],
      time_of_day: ["morning", "afternoon", "evening", "night"],
      visibility_type: ["public", "followers", "private"],
      water_clarity: ["clear", "coloured", "unknown"],
      weather_type: ["sunny", "overcast", "raining", "windy"],
      weight_unit: ["lb_oz", "kg"],
    },
  },
} as const
