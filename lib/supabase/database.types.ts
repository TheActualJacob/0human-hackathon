export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          unit: string
          lease_id: string | null
          move_in_date: string
          rent_amount: number
          payment_status: 'current' | 'late' | 'pending' | null
          risk_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          unit: string
          lease_id?: string | null
          move_in_date: string
          rent_amount: number
          payment_status?: 'current' | 'late' | 'pending' | null
          risk_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          unit?: string
          lease_id?: string | null
          move_in_date?: string
          rent_amount?: number
          payment_status?: 'current' | 'late' | 'pending' | null
          risk_score?: number
          created_at?: string
          updated_at?: string
        }
      }
      maintenance_tickets: {
        Row: {
          id: string
          tenant_id: string | null
          tenant_name: string
          unit: string
          title: string
          description: string
          category: 'plumbing' | 'electrical' | 'appliance' | 'hvac' | 'general' | 'emergency' | null
          urgency: 'low' | 'medium' | 'high' | 'emergency' | null
          status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | null
          vendor_id: string | null
          vendor_name: string | null
          estimated_cost: number | null
          actual_cost: number | null
          ai_classified: boolean
          ai_decisions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          tenant_name: string
          unit: string
          title: string
          description: string
          category?: 'plumbing' | 'electrical' | 'appliance' | 'hvac' | 'general' | 'emergency' | null
          urgency?: 'low' | 'medium' | 'high' | 'emergency' | null
          status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | null
          vendor_id?: string | null
          vendor_name?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          ai_classified?: boolean
          ai_decisions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          tenant_name?: string
          unit?: string
          title?: string
          description?: string
          category?: 'plumbing' | 'electrical' | 'appliance' | 'hvac' | 'general' | 'emergency' | null
          urgency?: 'low' | 'medium' | 'high' | 'emergency' | null
          status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | null
          vendor_id?: string | null
          vendor_name?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          ai_classified?: boolean
          ai_decisions?: Json
          created_at?: string
          updated_at?: string
        }
      }
      vendors: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          specialty: string[]
          avg_response_time: number
          avg_cost: number
          rating: number | null
          ai_performance_score: number
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          specialty: string[]
          avg_response_time: number
          avg_cost: number
          rating?: number | null
          ai_performance_score?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          specialty?: string[]
          avg_response_time?: number
          avg_cost?: number
          rating?: number | null
          ai_performance_score?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      leases: {
        Row: {
          id: string
          tenant_id: string | null
          unit: string
          start_date: string
          end_date: string
          monthly_rent: number
          security_deposit: number
          status: 'active' | 'expiring' | 'expired' | 'terminated' | null
          renewal_recommendation: number | null
          suggested_rent_increase: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          unit: string
          start_date: string
          end_date: string
          monthly_rent: number
          security_deposit: number
          status?: 'active' | 'expiring' | 'expired' | 'terminated' | null
          renewal_recommendation?: number | null
          suggested_rent_increase?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          unit?: string
          start_date?: string
          end_date?: string
          monthly_rent?: number
          security_deposit?: number
          status?: 'active' | 'expiring' | 'expired' | 'terminated' | null
          renewal_recommendation?: number | null
          suggested_rent_increase?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      rent_payments: {
        Row: {
          id: string
          tenant_id: string | null
          tenant_name: string
          unit: string
          amount: number
          due_date: string
          paid_date: string | null
          status: 'paid' | 'late' | 'pending' | 'overdue' | null
          late_fee: number | null
          ai_reminded: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          tenant_name: string
          unit: string
          amount: number
          due_date: string
          paid_date?: string | null
          status?: 'paid' | 'late' | 'pending' | 'overdue' | null
          late_fee?: number | null
          ai_reminded?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          tenant_name?: string
          unit?: string
          amount?: number
          due_date?: string
          paid_date?: string | null
          status?: 'paid' | 'late' | 'pending' | 'overdue' | null
          late_fee?: number | null
          ai_reminded?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      activity_feed: {
        Row: {
          id: string
          type: 'maintenance' | 'rent' | 'lease' | 'vendor' | 'system' | null
          action: string
          details: string
          entity_id: string | null
          ai_generated: boolean
          timestamp: string
        }
        Insert: {
          id?: string
          type?: 'maintenance' | 'rent' | 'lease' | 'vendor' | 'system' | null
          action: string
          details: string
          entity_id?: string | null
          ai_generated?: boolean
          timestamp?: string
        }
        Update: {
          id?: string
          type?: 'maintenance' | 'rent' | 'lease' | 'vendor' | 'system' | null
          action?: string
          details?: string
          entity_id?: string | null
          ai_generated?: boolean
          timestamp?: string
        }
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