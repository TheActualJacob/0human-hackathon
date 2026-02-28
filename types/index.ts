// Re-export types from Supabase
import type { Database } from '@/lib/supabase/database.types';

export type Tables = Database['public']['Tables'];

// Table row types
export type Tenant = Tables['tenants']['Row'];
export type MaintenanceTicket = Tables['maintenance_tickets']['Row'];
export type Vendor = Tables['vendors']['Row'];
export type Lease = Tables['leases']['Row'];
export type RentPayment = Tables['rent_payments']['Row'];
export type ActivityItem = Tables['activity_feed']['Row'];

// Insert types
export type TenantInsert = Tables['tenants']['Insert'];
export type MaintenanceTicketInsert = Tables['maintenance_tickets']['Insert'];
export type VendorInsert = Tables['vendors']['Insert'];
export type LeaseInsert = Tables['leases']['Insert'];
export type RentPaymentInsert = Tables['rent_payments']['Insert'];
export type ActivityItemInsert = Tables['activity_feed']['Insert'];

// Update types
export type TenantUpdate = Tables['tenants']['Update'];
export type MaintenanceTicketUpdate = Tables['maintenance_tickets']['Update'];
export type VendorUpdate = Tables['vendors']['Update'];
export type LeaseUpdate = Tables['leases']['Update'];
export type RentPaymentUpdate = Tables['rent_payments']['Update'];

// Additional types for AI decisions
export interface AIDecision {
  timestamp: Date;
  action: string;
  reasoning: string;
  confidence: number;
}

// Dashboard metrics type
export interface DashboardMetrics {
  totalUnits: number;
  occupiedUnits: number;
  rentCollectedThisMonth: number;
  rentExpectedThisMonth: number;
  openMaintenanceTickets: number;
  latePayments: number;
  aiResolvedTickets: number;
  totalTickets: number;
}