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
      agent_actions: {
        Row: {
          id: string
          lease_id: string | null
          action_category: 'maintenance' | 'payment' | 'legal' | 'communication' | 'dispute' | 'document' | 'scheduling' | 'escalation' | 'other'
          action_description: string
          tools_called: Json | null
          input_summary: string | null
          output_summary: string | null
          confidence_score: number | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          lease_id?: string | null
          action_category: 'maintenance' | 'payment' | 'legal' | 'communication' | 'dispute' | 'document' | 'scheduling' | 'escalation' | 'other'
          action_description: string
          tools_called?: Json | null
          input_summary?: string | null
          output_summary?: string | null
          confidence_score?: number | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          lease_id?: string | null
          action_category?: 'maintenance' | 'payment' | 'legal' | 'communication' | 'dispute' | 'document' | 'scheduling' | 'escalation' | 'other'
          action_description?: string
          tools_called?: Json | null
          input_summary?: string | null
          output_summary?: string | null
          confidence_score?: number | null
          timestamp?: string | null
        }
        Relationships: []
      }
      contractors: {
        Row: {
          id: string
          landlord_id: string
          name: string
          trades: string[] | null
          phone: string | null
          email: string | null
          emergency_available: boolean | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          landlord_id: string
          name: string
          trades?: string[] | null
          phone?: string | null
          email?: string | null
          emergency_available?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          landlord_id?: string
          name?: string
          trades?: string[] | null
          phone?: string | null
          email?: string | null
          emergency_available?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      conversation_context: {
        Row: {
          id: string
          lease_id: string
          summary: string | null
          open_threads: Json | null
          last_updated: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          summary?: string | null
          open_threads?: Json | null
          last_updated?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          summary?: string | null
          open_threads?: Json | null
          last_updated?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          lease_id: string
          direction: 'inbound' | 'outbound'
          message_body: string
          whatsapp_message_id: string | null
          intent_classification: string | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          direction: 'inbound' | 'outbound'
          message_body: string
          whatsapp_message_id?: string | null
          intent_classification?: string | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          direction?: 'inbound' | 'outbound'
          message_body?: string
          whatsapp_message_id?: string | null
          intent_classification?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          id: string
          lease_id: string
          category: 'rent_arrears' | 'property_damage' | 'noise' | 'deposit' | 'harassment' | 'repairs' | 'other'
          description: string
          status: 'open' | 'under_review' | 'ruled' | 'appealed' | 'closed' | null
          ruling: string | null
          evidence_urls: string[] | null
          opened_at: string | null
          closed_at: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          category: 'rent_arrears' | 'property_damage' | 'noise' | 'deposit' | 'harassment' | 'repairs' | 'other'
          description: string
          status?: 'open' | 'under_review' | 'ruled' | 'appealed' | 'closed' | null
          ruling?: string | null
          evidence_urls?: string[] | null
          opened_at?: string | null
          closed_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          category?: 'rent_arrears' | 'property_damage' | 'noise' | 'deposit' | 'harassment' | 'repairs' | 'other'
          description?: string
          status?: 'open' | 'under_review' | 'ruled' | 'appealed' | 'closed' | null
          ruling?: string | null
          evidence_urls?: string[] | null
          opened_at?: string | null
          closed_at?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          id: string
          jurisdiction: string
          document_type: string
          template_body: string
          legal_basis: string | null
          version: number | null
          last_reviewed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          jurisdiction: string
          document_type: string
          template_body: string
          legal_basis?: string | null
          version?: number | null
          last_reviewed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          jurisdiction?: string
          document_type?: string
          template_body?: string
          legal_basis?: string | null
          version?: number | null
          last_reviewed_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      landlord_notifications: {
        Row: {
          id: string
          landlord_id: string
          lease_id: string | null
          notification_type: 'emergency_maintenance' | 'legal_notice_issued' | 'eviction_started' | 'tenant_vacated' | 'dispute_ruled' | 'rent_overdue' | 'compliance_expiry' | 'payment_received' | 'general' | 'signature_required'
          message: string
          related_record_type: string | null
          related_record_id: string | null
          requires_signature: boolean | null
          read_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          landlord_id: string
          lease_id?: string | null
          notification_type: 'emergency_maintenance' | 'legal_notice_issued' | 'eviction_started' | 'tenant_vacated' | 'dispute_ruled' | 'rent_overdue' | 'compliance_expiry' | 'payment_received' | 'general' | 'signature_required'
          message: string
          related_record_type?: string | null
          related_record_id?: string | null
          requires_signature?: boolean | null
          read_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          landlord_id?: string
          lease_id?: string | null
          notification_type?: 'emergency_maintenance' | 'legal_notice_issued' | 'eviction_started' | 'tenant_vacated' | 'dispute_ruled' | 'rent_overdue' | 'compliance_expiry' | 'payment_received' | 'general' | 'signature_required'
          message?: string
          related_record_type?: string | null
          related_record_id?: string | null
          requires_signature?: boolean | null
          read_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      landlords: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          whatsapp_number: string | null
          notification_preferences: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          full_name: string
          email: string
          phone?: string | null
          whatsapp_number?: string | null
          notification_preferences?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          whatsapp_number?: string | null
          notification_preferences?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      leases: {
        Row: {
          id: string
          unit_id: string
          start_date: string
          end_date: string | null
          monthly_rent: number
          deposit_amount: number | null
          deposit_held: number | null
          deposit_scheme: string | null
          notice_period_days: number | null
          status: 'active' | 'expired' | 'terminated' | 'notice_given' | 'pending' | null
          lease_document_url: string | null
          special_terms: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          start_date: string
          end_date?: string | null
          monthly_rent: number
          deposit_amount?: number | null
          deposit_held?: number | null
          deposit_scheme?: string | null
          notice_period_days?: number | null
          status?: 'active' | 'expired' | 'terminated' | 'notice_given' | 'pending' | null
          lease_document_url?: string | null
          special_terms?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          start_date?: string
          end_date?: string | null
          monthly_rent?: number
          deposit_amount?: number | null
          deposit_held?: number | null
          deposit_scheme?: string | null
          notice_period_days?: number | null
          status?: 'active' | 'expired' | 'terminated' | 'notice_given' | 'pending' | null
          lease_document_url?: string | null
          special_terms?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      legal_actions: {
        Row: {
          id: string
          lease_id: string
          dispute_id: string | null
          action_type: 'formal_notice' | 'section_8' | 'section_21' | 'eviction_notice' | 'payment_demand' | 'deposit_deduction_notice' | 'tribunal_prep' | 'payment_plan_agreement' | 'lease_violation_notice' | 'other'
          document_url: string | null
          issued_at: string | null
          response_deadline: string | null
          response_received_at: string | null
          status: 'issued' | 'acknowledged' | 'complied' | 'escalated' | 'expired' | null
          agent_reasoning: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          dispute_id?: string | null
          action_type: 'formal_notice' | 'section_8' | 'section_21' | 'eviction_notice' | 'payment_demand' | 'deposit_deduction_notice' | 'tribunal_prep' | 'payment_plan_agreement' | 'lease_violation_notice' | 'other'
          document_url?: string | null
          issued_at?: string | null
          response_deadline?: string | null
          response_received_at?: string | null
          status?: 'issued' | 'acknowledged' | 'complied' | 'escalated' | 'expired' | null
          agent_reasoning?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          dispute_id?: string | null
          action_type?: 'formal_notice' | 'section_8' | 'section_21' | 'eviction_notice' | 'payment_demand' | 'deposit_deduction_notice' | 'tribunal_prep' | 'payment_plan_agreement' | 'lease_violation_notice' | 'other'
          document_url?: string | null
          issued_at?: string | null
          response_deadline?: string | null
          response_received_at?: string | null
          status?: 'issued' | 'acknowledged' | 'complied' | 'escalated' | 'expired' | null
          agent_reasoning?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      maintenance_issues: {
        Row: {
          id: string
          unit_id: string
          issue_type: 'damp' | 'mould' | 'pest' | 'structural' | 'drainage' | 'heating' | 'electrical' | 'noise' | 'other'
          title: string
          description: string | null
          severity: 'minor' | 'moderate' | 'major' | 'critical' | null
          is_chronic: boolean | null
          is_building_wide: boolean | null
          first_reported_at: string | null
          last_reported_at: string | null
          report_count: number | null
          times_addressed: number | null
          status: 'monitoring' | 'active' | 'in_remediation' | 'resolved' | 'unresolvable' | null
          resolution_attempts: Json | null
          related_maintenance_request_ids: string[] | null
          related_dispute_ids: string[] | null
          potential_liability: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          issue_type: 'damp' | 'mould' | 'pest' | 'structural' | 'drainage' | 'heating' | 'electrical' | 'noise' | 'other'
          title: string
          description?: string | null
          severity?: 'minor' | 'moderate' | 'major' | 'critical' | null
          is_chronic?: boolean | null
          is_building_wide?: boolean | null
          first_reported_at?: string | null
          last_reported_at?: string | null
          report_count?: number | null
          times_addressed?: number | null
          status?: 'monitoring' | 'active' | 'in_remediation' | 'resolved' | 'unresolvable' | null
          resolution_attempts?: Json | null
          related_maintenance_request_ids?: string[] | null
          related_dispute_ids?: string[] | null
          potential_liability?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          issue_type?: 'damp' | 'mould' | 'pest' | 'structural' | 'drainage' | 'heating' | 'electrical' | 'noise' | 'other'
          title?: string
          description?: string | null
          severity?: 'minor' | 'moderate' | 'major' | 'critical' | null
          is_chronic?: boolean | null
          is_building_wide?: boolean | null
          first_reported_at?: string | null
          last_reported_at?: string | null
          report_count?: number | null
          times_addressed?: number | null
          status?: 'monitoring' | 'active' | 'in_remediation' | 'resolved' | 'unresolvable' | null
          resolution_attempts?: Json | null
          related_maintenance_request_ids?: string[] | null
          related_dispute_ids?: string[] | null
          potential_liability?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      maintenance_requests: {
        Row: {
          id: string
          lease_id: string
          maintenance_issue_id: string | null
          category: 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'heating' | 'pest' | 'damp' | 'access' | 'other'
          description: string
          urgency: 'emergency' | 'high' | 'routine' | null
          status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened' | null
          contractor_id: string | null
          scheduled_at: string | null
          completed_at: string | null
          cost: number | null
          photos: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          maintenance_issue_id?: string | null
          category: 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'heating' | 'pest' | 'damp' | 'access' | 'other'
          description: string
          urgency?: 'emergency' | 'high' | 'routine' | null
          status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened' | null
          contractor_id?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          cost?: number | null
          photos?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          maintenance_issue_id?: string | null
          category?: 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'heating' | 'pest' | 'damp' | 'access' | 'other'
          description?: string
          urgency?: 'emergency' | 'high' | 'routine' | null
          status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened' | null
          contractor_id?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          cost?: number | null
          photos?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_plans: {
        Row: {
          id: string
          lease_id: string
          total_arrears: number
          installment_amount: number
          installment_frequency: 'weekly' | 'fortnightly' | 'monthly' | null
          start_date: string
          end_date: string | null
          status: 'active' | 'completed' | 'breached' | null
          agreed_at: string | null
          document_url: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          total_arrears: number
          installment_amount: number
          installment_frequency?: 'weekly' | 'fortnightly' | 'monthly' | null
          start_date: string
          end_date?: string | null
          status?: 'active' | 'completed' | 'breached' | null
          agreed_at?: string | null
          document_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          total_arrears?: number
          installment_amount?: number
          installment_frequency?: 'weekly' | 'fortnightly' | 'monthly' | null
          start_date?: string
          end_date?: string | null
          status?: 'active' | 'completed' | 'breached' | null
          agreed_at?: string | null
          document_url?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          lease_id: string
          amount_due: number
          amount_paid: number | null
          due_date: string
          paid_date: string | null
          status: 'pending' | 'paid' | 'late' | 'partial' | 'missed' | null
          payment_method: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lease_id: string
          amount_due: number
          amount_paid?: number | null
          due_date: string
          paid_date?: string | null
          status?: 'pending' | 'paid' | 'late' | 'partial' | 'missed' | null
          payment_method?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string
          amount_due?: number
          amount_paid?: number | null
          due_date?: string
          paid_date?: string | null
          status?: 'pending' | 'paid' | 'late' | 'partial' | 'missed' | null
          payment_method?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          lease_id: string | null
          full_name: string
          email: string | null
          whatsapp_number: string
          id_document_url: string | null
          is_primary_tenant: boolean | null
          profile_data: Json | null
          auth_user_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lease_id?: string | null
          full_name: string
          email?: string | null
          whatsapp_number: string
          id_document_url?: string | null
          is_primary_tenant?: boolean | null
          profile_data?: Json | null
          auth_user_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lease_id?: string | null
          full_name?: string
          email?: string | null
          whatsapp_number?: string
          id_document_url?: string | null
          is_primary_tenant?: boolean | null
          profile_data?: Json | null
          auth_user_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      unit_appliances: {
        Row: {
          id: string
          unit_id: string
          appliance_type: string
          make: string | null
          model: string | null
          serial_number: string | null
          install_date: string | null
          warranty_expiry: string | null
          last_serviced_at: string | null
          condition: 'good' | 'fair' | 'poor' | 'faulty' | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          appliance_type: string
          make?: string | null
          model?: string | null
          serial_number?: string | null
          install_date?: string | null
          warranty_expiry?: string | null
          last_serviced_at?: string | null
          condition?: 'good' | 'fair' | 'poor' | 'faulty' | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          appliance_type?: string
          make?: string | null
          model?: string | null
          serial_number?: string | null
          install_date?: string | null
          warranty_expiry?: string | null
          last_serviced_at?: string | null
          condition?: 'good' | 'fair' | 'poor' | 'faulty' | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unit_attributes: {
        Row: {
          id: string
          unit_id: string
          square_footage: number | null
          bedrooms: number | null
          bathrooms: number | null
          has_ensuite: boolean | null
          floor_level: number | null
          furnished_status: 'unfurnished' | 'part_furnished' | 'fully_furnished' | null
          furnishing_notes: string | null
          heating_type: 'gas_central' | 'electric' | 'underfloor' | 'other' | null
          boiler_location: string | null
          boiler_model: string | null
          boiler_last_serviced: string | null
          has_dishwasher: boolean | null
          has_washing_machine: boolean | null
          has_dryer: boolean | null
          has_ac: boolean | null
          has_garden_access: boolean | null
          has_balcony: boolean | null
          has_parking: boolean | null
          has_lift: boolean | null
          furnished_status: string | null
          pet_policy: string | null
          gas_provider: string | null
          electricity_provider: string | null
          water_provider: string | null
          broadband_provider: string | null
          meter_locations: string | null
          door_code: string | null
          key_fob_number: string | null
          key_safe_code: string | null
          spare_key_location: string | null
          bin_collection_day: string | null
          bin_collection_notes: string | null
          building_manager_contact: string | null
          buildings_insurance_provider: string | null
          insurance_policy_number: string | null
          insurance_renewal_date: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          square_footage?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          has_ensuite?: boolean | null
          floor_level?: number | null
          furnished_status?: 'unfurnished' | 'part_furnished' | 'fully_furnished' | null
          furnishing_notes?: string | null
          heating_type?: 'gas_central' | 'electric' | 'underfloor' | 'other' | null
          boiler_location?: string | null
          boiler_model?: string | null
          boiler_last_serviced?: string | null
          has_dishwasher?: boolean | null
          has_washing_machine?: boolean | null
          has_dryer?: boolean | null
          has_ac?: boolean | null
          has_garden_access?: boolean | null
          has_balcony?: boolean | null
          has_parking?: boolean | null
          has_lift?: boolean | null
          gas_provider?: string | null
          electricity_provider?: string | null
          water_provider?: string | null
          broadband_provider?: string | null
          meter_locations?: string | null
          door_code?: string | null
          key_fob_number?: string | null
          key_safe_code?: string | null
          spare_key_location?: string | null
          bin_collection_day?: string | null
          bin_collection_notes?: string | null
          building_manager_contact?: string | null
          buildings_insurance_provider?: string | null
          insurance_policy_number?: string | null
          insurance_renewal_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          square_footage?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          has_ensuite?: boolean | null
          floor_level?: number | null
          furnished_status?: 'unfurnished' | 'part_furnished' | 'fully_furnished' | null
          furnishing_notes?: string | null
          heating_type?: 'gas_central' | 'electric' | 'underfloor' | 'other' | null
          boiler_location?: string | null
          boiler_model?: string | null
          boiler_last_serviced?: string | null
          has_dishwasher?: boolean | null
          has_washing_machine?: boolean | null
          has_dryer?: boolean | null
          has_ac?: boolean | null
          has_garden_access?: boolean | null
          has_balcony?: boolean | null
          has_parking?: boolean | null
          has_lift?: boolean | null
          gas_provider?: string | null
          electricity_provider?: string | null
          water_provider?: string | null
          broadband_provider?: string | null
          meter_locations?: string | null
          door_code?: string | null
          key_fob_number?: string | null
          key_safe_code?: string | null
          spare_key_location?: string | null
          bin_collection_day?: string | null
          bin_collection_notes?: string | null
          building_manager_contact?: string | null
          buildings_insurance_provider?: string | null
          insurance_policy_number?: string | null
          insurance_renewal_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unit_documents: {
        Row: {
          id: string
          unit_id: string
          document_type: 'gas_safety' | 'epc' | 'electrical_cert' | 'fire_risk' | 'asbestos' | 'planning_permission' | 'hmo_licence' | 'inventory' | 'move_in_checklist' | 'move_out_checklist' | 'other'
          document_url: string | null
          issue_date: string | null
          expiry_date: string | null
          status: 'valid' | 'expiring_soon' | 'expired' | null
          reminder_sent: boolean | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          document_type: 'gas_safety' | 'epc' | 'electrical_cert' | 'fire_risk' | 'asbestos' | 'planning_permission' | 'hmo_licence' | 'inventory' | 'move_in_checklist' | 'move_out_checklist' | 'other'
          document_url?: string | null
          issue_date?: string | null
          expiry_date?: string | null
          status?: 'valid' | 'expiring_soon' | 'expired' | null
          reminder_sent?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          document_type?: 'gas_safety' | 'epc' | 'electrical_cert' | 'fire_risk' | 'asbestos' | 'planning_permission' | 'hmo_licence' | 'inventory' | 'move_in_checklist' | 'move_out_checklist' | 'other'
          document_url?: string | null
          issue_date?: string | null
          expiry_date?: string | null
          status?: 'valid' | 'expiring_soon' | 'expired' | null
          reminder_sent?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      unit_status: {
        Row: {
          id: string
          unit_id: string
          occupancy_status: 'occupied' | 'vacant' | 'notice_given' | 'between_tenancies' | 'under_refurb' | null
          condition_rating: number | null
          condition_notes: string | null
          has_open_maintenance: boolean | null
          open_maintenance_count: number | null
          has_chronic_issue: boolean | null
          chronic_issue_count: number | null
          meter_reading_electric: number | null
          meter_reading_gas: number | null
          meter_reading_date: string | null
          move_in_date: string | null
          expected_move_out_date: string | null
          actual_move_out_date: string | null
          last_updated_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          occupancy_status?: 'occupied' | 'vacant' | 'notice_given' | 'between_tenancies' | 'under_refurb' | null
          condition_rating?: number | null
          condition_notes?: string | null
          has_open_maintenance?: boolean | null
          open_maintenance_count?: number | null
          has_chronic_issue?: boolean | null
          chronic_issue_count?: number | null
          meter_reading_electric?: number | null
          meter_reading_gas?: number | null
          meter_reading_date?: string | null
          move_in_date?: string | null
          expected_move_out_date?: string | null
          actual_move_out_date?: string | null
          last_updated_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          occupancy_status?: 'occupied' | 'vacant' | 'notice_given' | 'between_tenancies' | 'under_refurb' | null
          condition_rating?: number | null
          condition_notes?: string | null
          has_open_maintenance?: boolean | null
          open_maintenance_count?: number | null
          has_chronic_issue?: boolean | null
          chronic_issue_count?: number | null
          meter_reading_electric?: number | null
          meter_reading_gas?: number | null
          meter_reading_date?: string | null
          move_in_date?: string | null
          expected_move_out_date?: string | null
          actual_move_out_date?: string | null
          last_updated_at?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          id: string
          landlord_id: string
          unit_identifier: string
          address: string
          city: string
          country: string | null
          jurisdiction: string | null
          listing_status: 'not_listed' | 'public' | 'private' | null
          listing_description: string | null
          listing_created_at: string | null
          listing_expires_at: string | null
          rent_amount: number | null
          security_deposit: number | null
          available_date: string | null
          created_at: string | null
          images: string[] | null
          unit_type: string | null
          bedrooms: number | null
          bathrooms: number | null
          square_footage: number | null
          postcode: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          landlord_id: string
          unit_identifier: string
          address: string
          city: string
          country?: string | null
          jurisdiction?: string | null
          listing_status?: 'not_listed' | 'public' | 'private' | null
          listing_description?: string | null
          listing_created_at?: string | null
          listing_expires_at?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          available_date?: string | null
          created_at?: string | null
          images?: string[] | null
          unit_type?: string | null
          bedrooms?: number | null
          bathrooms?: number | null
          square_footage?: number | null
          postcode?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          landlord_id?: string
          unit_identifier?: string
          address?: string
          city?: string
          country?: string | null
          jurisdiction?: string | null
          listing_status?: 'not_listed' | 'public' | 'private' | null
          listing_description?: string | null
          listing_created_at?: string | null
          listing_expires_at?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          available_date?: string | null
          created_at?: string | null
          images?: string[] | null
          unit_type?: string | null
          bedrooms?: number | null
          bathrooms?: number | null
          square_footage?: number | null
          postcode?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      maintenance_workflows: {
        Row: {
          id: string
          maintenance_request_id: string
          current_state: 'SUBMITTED' | 'OWNER_NOTIFIED' | 'OWNER_RESPONDED' | 'DECISION_MADE' | 'VENDOR_CONTACTED' | 'AWAITING_VENDOR_RESPONSE' | 'ETA_CONFIRMED' | 'TENANT_NOTIFIED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED_DENIED'
          ai_analysis: any
          owner_response: 'approved' | 'denied' | 'question' | null
          owner_message: string | null
          vendor_message: string | null
          vendor_eta: string | null
          vendor_notes: string | null
          state_history: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          maintenance_request_id: string
          current_state?: 'SUBMITTED' | 'OWNER_NOTIFIED' | 'OWNER_RESPONDED' | 'DECISION_MADE' | 'VENDOR_CONTACTED' | 'AWAITING_VENDOR_RESPONSE' | 'ETA_CONFIRMED' | 'TENANT_NOTIFIED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED_DENIED'
          ai_analysis?: any
          owner_response?: 'approved' | 'denied' | 'question' | null
          owner_message?: string | null
          vendor_message?: string | null
          vendor_eta?: string | null
          vendor_notes?: string | null
          state_history?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          maintenance_request_id?: string
          current_state?: 'SUBMITTED' | 'OWNER_NOTIFIED' | 'OWNER_RESPONDED' | 'DECISION_MADE' | 'VENDOR_CONTACTED' | 'AWAITING_VENDOR_RESPONSE' | 'ETA_CONFIRMED' | 'TENANT_NOTIFIED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED_DENIED'
          ai_analysis?: any
          owner_response?: 'approved' | 'denied' | 'question' | null
          owner_message?: string | null
          vendor_message?: string | null
          vendor_eta?: string | null
          vendor_notes?: string | null
          state_history?: any
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_communications: {
        Row: {
          id: string
          workflow_id: string
          sender_type: 'tenant' | 'owner' | 'vendor' | 'system'
          sender_id: string | null
          sender_name: string | null
          message: string
          metadata: any
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          sender_type: 'tenant' | 'owner' | 'vendor' | 'system'
          sender_id?: string | null
          sender_name?: string | null
          message: string
          metadata?: any
          created_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          sender_type?: 'tenant' | 'owner' | 'vendor' | 'system'
          sender_id?: string | null
          sender_name?: string | null
          message?: string
          metadata?: any
          created_at?: string
        }
        Relationships: []
      }
      vendor_bids: {
        Row: {
          id: string
          workflow_id: string
          contractor_id: string
          bid_amount: number
          estimated_completion_time: number | null
          message: string | null
          is_selected: boolean | null
          ai_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          contractor_id: string
          bid_amount: number
          estimated_completion_time?: number | null
          message?: string | null
          is_selected?: boolean | null
          ai_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          contractor_id?: string
          bid_amount?: number
          estimated_completion_time?: number | null
          message?: string | null
          is_selected?: boolean | null
          ai_score?: number | null
          created_at?: string
        }
        Relationships: []
      }
      property_applications: {
        Row: {
          id: string
          unit_id: string
          tenant_id: string | null
          applicant_data: Json
          status: 'pending' | 'ai_screening' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn' | null
          ai_screening_result: Json | null
          ai_screening_score: number | null
          landlord_notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          tenant_id?: string | null
          applicant_data: Json
          status?: 'pending' | 'ai_screening' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn' | null
          ai_screening_result?: Json | null
          ai_screening_score?: number | null
          landlord_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          tenant_id?: string | null
          applicant_data?: Json
          status?: 'pending' | 'ai_screening' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn' | null
          ai_screening_result?: Json | null
          ai_screening_score?: number | null
          landlord_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      property_invites: {
        Row: {
          id: string
          unit_id: string
          landlord_id: string
          email: string
          message: string | null
          token: string
          expires_at: string | null
          used_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          unit_id: string
          landlord_id: string
          email: string
          message?: string | null
          token?: string
          expires_at?: string | null
          used_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          landlord_id?: string
          email?: string
          message?: string | null
          token?: string
          expires_at?: string | null
          used_at?: string | null
          created_at?: string | null
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