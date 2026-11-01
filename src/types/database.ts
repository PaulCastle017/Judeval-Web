
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attendance": {
                  Row: {
                    "comment": string,"player_id": string,"recorded_by": string | null,"session_id": string,"status": Database["public"]['Enums']["attendance_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string,"player_id": string,"recorded_by"?: string | null,"session_id": string,"status": Database["public"]['Enums']["attendance_status"],"updated_at"?: string
                  }
                  Update: {
                    "comment"?: string,"player_id"?: string,"recorded_by"?: string | null,"session_id"?: string,"status"?: Database["public"]['Enums']["attendance_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"end_time": string | null,"id": string,"name": string,"schedule_text": string,"season": string,"sort_order": number,"sport": Database["public"]['Enums']["sport_type"],"start_time": string | null,"training_weekdays": (number)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time"?: string | null,"id"?: string,"name": string,"schedule_text"?: string,"season"?: string,"sort_order"?: number,"sport"?: Database["public"]['Enums']["sport_type"],"start_time"?: string | null,"training_weekdays"?: (number)[],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string | null,"id"?: string,"name"?: string,"schedule_text"?: string,"season"?: string,"sort_order"?: number,"sport"?: Database["public"]['Enums']["sport_type"],"start_time"?: string | null,"training_weekdays"?: (number)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"coach_categories": {
                  Row: {
                    "category_id": string,"coach_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"coach_id": string,"created_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"coach_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_categories_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "created_at": string,"created_by": string | null,"default_minutes": number | null,"description": string,"id": string,"sport": Database["public"]['Enums']["sport_type"],"tags": (string)[],"title": string,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"default_minutes"?: number | null,"description"?: string,"id"?: string,"sport": Database["public"]['Enums']["sport_type"],"tags"?: (string)[],"title": string,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"default_minutes"?: number | null,"description"?: string,"id"?: string,"sport"?: Database["public"]['Enums']["sport_type"],"tags"?: (string)[],"title"?: string,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercises_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"match_players": {
                  Row: {
                    "comment": string,"lineup_slot": string | null,"match_id": string,"player_id": string,"recorded_by": string | null,"status": Database["public"]['Enums']["attendance_status"] | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string,"lineup_slot"?: string | null,"match_id": string,"player_id": string,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["attendance_status"] | null,"updated_at"?: string
                  }
                  Update: {
                    "comment"?: string,"lineup_slot"?: string | null,"match_id"?: string,"player_id"?: string,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["attendance_status"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_players_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_players_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "category_id": string,"competition": string,"created_at": string,"created_by": string | null,"goals_against": number | null,"goals_for": number | null,"id": string,"location": string,"match_date": string,"notes": string,"opponent": string,"sets": Json | null,"start_time": string | null,"updated_at": string,"venue": Database["public"]['Enums']["match_venue"]
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"competition"?: string,"created_at"?: string,"created_by"?: string | null,"goals_against"?: number | null,"goals_for"?: number | null,"id"?: string,"location"?: string,"match_date": string,"notes"?: string,"opponent": string,"sets"?: Json | null,"start_time"?: string | null,"updated_at"?: string,"venue"?: Database["public"]['Enums']["match_venue"]
                  }
                  Update: {
                    "category_id"?: string,"competition"?: string,"created_at"?: string,"created_by"?: string | null,"goals_against"?: number | null,"goals_for"?: number | null,"id"?: string,"location"?: string,"match_date"?: string,"notes"?: string,"opponent"?: string,"sets"?: Json | null,"start_time"?: string | null,"updated_at"?: string,"venue"?: Database["public"]['Enums']["match_venue"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"player_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"follow_up": boolean,"follow_up_done": boolean,"id": string,"note_date": string,"player_id": string,"topic": Database["public"]['Enums']["note_topic"] | null,"type": Database["public"]['Enums']["note_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"follow_up"?: boolean,"follow_up_done"?: boolean,"id"?: string,"note_date"?: string,"player_id": string,"topic"?: Database["public"]['Enums']["note_topic"] | null,"type"?: Database["public"]['Enums']["note_type"],"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"follow_up"?: boolean,"follow_up_done"?: boolean,"id"?: string,"note_date"?: string,"player_id"?: string,"topic"?: Database["public"]['Enums']["note_topic"] | null,"type"?: Database["public"]['Enums']["note_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_notes_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "active": boolean,"availability_notes": string,"birth_year": number | null,"category_id": string,"created_at": string,"created_by": string | null,"display_name": string,"first_name": string,"id": string,"last_name": string,"physical_considerations": string,"position": Database["public"]['Enums']["player_position"],"status": Database["public"]['Enums']["player_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"availability_notes"?: string,"birth_year"?: number | null,"category_id": string,"created_at"?: string,"created_by"?: string | null,"display_name"?: string,"first_name": string,"id"?: string,"last_name"?: string,"physical_considerations"?: string,"position"?: Database["public"]['Enums']["player_position"],"status"?: Database["public"]['Enums']["player_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"availability_notes"?: string,"birth_year"?: number | null,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"display_name"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"physical_considerations"?: string,"position"?: Database["public"]['Enums']["player_position"],"status"?: Database["public"]['Enums']["player_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "players_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "players_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "players_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_reminders": {
                  Row: {
                    "category_id": string,"created_at": string,"created_by": string | null,"slot_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"created_by"?: string | null,"slot_date": string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"created_by"?: string | null,"slot_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_reminders_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_reminders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["staff_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email"?: string,"full_name"?: string,"id": string,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"review_actions": {
                  Row: {
                    "created_at": string,"description": string,"done": boolean,"due_date": string | null,"id": string,"owner_id": string | null,"player_id": string | null,"review_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"owner_id"?: string | null,"player_id"?: string | null,"review_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"owner_id"?: string | null,"player_id"?: string | null,"review_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_actions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_actions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_actions_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "staff_reviews"
      referencedColumns: ["id"]
    }
                  ]
                },"review_players": {
                  Row: {
                    "created_at": string,"player_id": string,"review_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"player_id": string,"review_id": string
                  }
                  Update: {
                    "created_at"?: string,"player_id"?: string,"review_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_players_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "staff_reviews"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_reviews": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"review_date": string,"sport": Database["public"]['Enums']["sport_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"review_date"?: string,"sport"?: Database["public"]['Enums']["sport_type"],"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"review_date"?: string,"sport"?: Database["public"]['Enums']["sport_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_reviews_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_commitments": {
                  Row: {
                    "active": boolean,"category_id": string | null,"created_at": string,"description": string,"id": string,"sort_order": number,"sport": Database["public"]['Enums']["sport_type"],"status": Database["public"]['Enums']["commitment_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"sort_order"?: number,"sport"?: Database["public"]['Enums']["sport_type"],"status"?: Database["public"]['Enums']["commitment_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"sort_order"?: number,"sport"?: Database["public"]['Enums']["sport_type"],"status"?: Database["public"]['Enums']["commitment_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_commitments_category_sport_fkey"
      columns: ["category_id","sport"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","sport"]
    }
                  ]
                },"training_sessions": {
                  Row: {
                    "category_id": string,"closing_question": string,"closing_summary": string,"created_at": string,"created_by": string | null,"duration_minutes": number | null,"exercises": NonNullable<Json>,"id": string,"notes": string,"session_date": string,"start_time": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"closing_question"?: string,"closing_summary"?: string,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number | null,"exercises"?: NonNullable<Json>,"id"?: string,"notes"?: string,"session_date": string,"start_time"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"closing_question"?: string,"closing_summary"?: string,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number | null,"exercises"?: NonNullable<Json>,"id"?: string,"notes"?: string,"session_date"?: string,"start_time"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_sessions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_active_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"player_attendance_stats":
{ Args: { "p_category_id"?: string,"p_from"?: string,"p_to"?: string }; Returns: {
              "ausente": number,"justificado": number,"lesionado": number,"player_id": string,"presente": number,"rate": number,"total": number
            }[]
                           },
"player_last_news":
{ Args: { "p_sport": Database["public"]['Enums']["sport_type"] }; Returns: {
              "last_news_date": string,"player_id": string
            }[]
                           },
"player_match_stats":
{ Args: { "p_category_id"?: string,"p_from"?: string,"p_to"?: string }; Returns: {
              "ausente": number,"called_up": number,"justificado": number,"lesionado": number,"player_id": string,"presente": number,"rate": number
            }[]
                           },
"save_review":
{ Args: { "p_body": string,"p_id": string,"p_player_ids": (string)[],"p_review_date": string,"p_sport": Database["public"]['Enums']["sport_type"] }; Returns: string
                           },
"set_match_lineup":
{ Args: { "p_match_id": string,"p_slots": Json }; Returns: undefined
                           },
"set_match_squad":
{ Args: { "p_match_id": string,"p_player_ids": (string)[] }; Returns: undefined
                           },
"set_note_follow_up_done":
{ Args: { "p_done"?: boolean,"p_note_id": string }; Returns: undefined
                           },
"volley_sets_valid":
{ Args: { "p_sets": Json }; Returns: boolean
                           }
          }
          Enums: {
            "attendance_status": "presente"|"ausente"|"justificado"|"lesionado","commitment_status": "pendiente"|"cumplido"|"no_conseguido","match_venue": "local"|"visitante","note_topic": "vida_fuera"|"bienestar"|"experiencia"|"necesidades"|"objetivos"|"grupo"|"otro","note_type": "observacion"|"conversacion"|"reconocimiento"|"incidencia","player_position": "jugador"|"portero","player_status": "activo"|"lesionado"|"baja","sport_type": "futsal"|"voley","staff_role": "admin"|"coach"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "attendance_status": ["presente", "ausente", "justificado", "lesionado"],"commitment_status": ["pendiente", "cumplido", "no_conseguido"],"match_venue": ["local", "visitante"],"note_topic": ["vida_fuera", "bienestar", "experiencia", "necesidades", "objetivos", "grupo", "otro"],"note_type": ["observacion", "conversacion", "reconocimiento", "incidencia"],"player_position": ["jugador", "portero"],"player_status": ["activo", "lesionado", "baja"],"sport_type": ["futsal", "voley"],"staff_role": ["admin", "coach"]
          }
        }
} as const
