export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      food_logs: {
        Row: {
          created_at: string | null
          id: string
          kcal: number | null
          linked_urge_id: string | null
          name: string | null
          protein: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          kcal?: number | null
          linked_urge_id?: string | null
          name?: string | null
          protein?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          kcal?: number | null
          linked_urge_id?: string | null
          name?: string | null
          protein?: number | null
          user_id?: string | null
        }
      }
      profiles: {
        Row: {
          created_at: string | null
          goal: string | null
          goal_mode: GoalMode | null
          id: string
          insight_md: string | null
          insight_updated_at: string | null
          kcal_target: number | null
          limits_inputs: LimitsInputs | null
          name: string | null
          personality_md: string | null
          protein_target: number | null
          weight_kg: number | null
          what_changes: string | null
          why_it_matters: string | null
        }
        Insert: {
          created_at?: string | null
          goal?: string | null
          goal_mode?: GoalMode | null
          id: string
          insight_md?: string | null
          insight_updated_at?: string | null
          kcal_target?: number | null
          limits_inputs?: LimitsInputs | null
          name?: string | null
          personality_md?: string | null
          protein_target?: number | null
          weight_kg?: number | null
          what_changes?: string | null
          why_it_matters?: string | null
        }
        Update: {
          created_at?: string | null
          goal?: string | null
          goal_mode?: GoalMode | null
          id?: string
          insight_md?: string | null
          insight_updated_at?: string | null
          kcal_target?: number | null
          limits_inputs?: LimitsInputs | null
          name?: string | null
          personality_md?: string | null
          protein_target?: number | null
          weight_kg?: number | null
          what_changes?: string | null
          why_it_matters?: string | null
        }
      }
      urges: {
        Row: {
          after_feeling: string | null
          completed_at: string | null
          conversation_log: { beat: number; userChoice: string }[] | null
          craving: string | null
          created_at: string | null
          current_feeling: string | null
          expected_feeling: string | null
          gave_in: boolean | null
          held_seconds: number | null
          id: string
          strength_before: number | null
          summary: string | null
          user_id: string | null
          won_feeling: string | null
          worth_it: boolean | null
        }
        Insert: {
          after_feeling?: string | null
          completed_at?: string | null
          conversation_log?: { beat: number; userChoice: string }[] | null
          craving?: string | null
          created_at?: string | null
          current_feeling?: string | null
          expected_feeling?: string | null
          gave_in?: boolean | null
          held_seconds?: number | null
          id?: string
          strength_before?: number | null
          summary?: string | null
          user_id?: string | null
          won_feeling?: string | null
          worth_it?: boolean | null
        }
        Update: {
          after_feeling?: string | null
          completed_at?: string | null
          conversation_log?: { beat: number; userChoice: string }[] | null
          craving?: string | null
          created_at?: string | null
          current_feeling?: string | null
          expected_feeling?: string | null
          gave_in?: boolean | null
          held_seconds?: number | null
          id?: string
          strength_before?: number | null
          summary?: string | null
          user_id?: string | null
          won_feeling?: string | null
          worth_it?: boolean | null
        }
      }
    }
  }
}

export type ActivityLevel = 'sitting' | 'moderate' | 'very'

export type GoalMode = 'craving_control' | 'lose_weight'

export type LimitsInputs = {
  gender: 'male' | 'female'
  age: number
  height_cm: number
  weight_kg: number
  activity: ActivityLevel
  goal_mode: GoalMode
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Urge = Database['public']['Tables']['urges']['Row']
export type FoodLog = Database['public']['Tables']['food_logs']['Row']
