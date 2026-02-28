// Re-export types from Supabase
import type { Database } from '@/lib/supabase/database.types';

export type Tables = Database['public']['Tables'];

// Core entity types
export type Landlord = Tables['landlords']['Row'];
export type Unit = Tables['units']['Row'];
export type UnitAttributes = Tables['unit_attributes']['Row'];
export type UnitStatus = Tables['unit_status']['Row'];
export type UnitDocument = Tables['unit_documents']['Row'];
export type UnitAppliance = Tables['unit_appliances']['Row'];
export type Lease = Tables['leases']['Row'];
export type Tenant = Tables['tenants']['Row'];
export type Payment = Tables['payments']['Row'];
export type PaymentPlan = Tables['payment_plans']['Row'];
export type MaintenanceRequest = Tables['maintenance_requests']['Row'];
export type MaintenanceIssue = Tables['maintenance_issues']['Row'];
export type Contractor = Tables['contractors']['Row'];
export type Conversation = Tables['conversations']['Row'];
export type ConversationContext = Tables['conversation_context']['Row'];
export type Dispute = Tables['disputes']['Row'];
export type LegalAction = Tables['legal_actions']['Row'];
export type DocumentTemplate = Tables['document_templates']['Row'];
export type LandlordNotification = Tables['landlord_notifications']['Row'];
export type AgentAction = Tables['agent_actions']['Row'];

// Insert types
export type LandlordInsert = Tables['landlords']['Insert'];
export type UnitInsert = Tables['units']['Insert'];
export type UnitAttributesInsert = Tables['unit_attributes']['Insert'];
export type UnitStatusInsert = Tables['unit_status']['Insert'];
export type UnitDocumentInsert = Tables['unit_documents']['Insert'];
export type UnitApplianceInsert = Tables['unit_appliances']['Insert'];
export type LeaseInsert = Tables['leases']['Insert'];
export type TenantInsert = Tables['tenants']['Insert'];
export type PaymentInsert = Tables['payments']['Insert'];
export type PaymentPlanInsert = Tables['payment_plans']['Insert'];
export type MaintenanceRequestInsert = Tables['maintenance_requests']['Insert'];
export type MaintenanceIssueInsert = Tables['maintenance_issues']['Insert'];
export type ContractorInsert = Tables['contractors']['Insert'];
export type ConversationInsert = Tables['conversations']['Insert'];
export type ConversationContextInsert = Tables['conversation_context']['Insert'];
export type DisputeInsert = Tables['disputes']['Insert'];
export type LegalActionInsert = Tables['legal_actions']['Insert'];
export type DocumentTemplateInsert = Tables['document_templates']['Insert'];
export type LandlordNotificationInsert = Tables['landlord_notifications']['Insert'];
export type AgentActionInsert = Tables['agent_actions']['Insert'];

// Update types
export type LandlordUpdate = Tables['landlords']['Update'];
export type UnitUpdate = Tables['units']['Update'];
export type UnitAttributesUpdate = Tables['unit_attributes']['Update'];
export type UnitStatusUpdate = Tables['unit_status']['Update'];
export type UnitDocumentUpdate = Tables['unit_documents']['Update'];
export type UnitApplianceUpdate = Tables['unit_appliances']['Update'];
export type LeaseUpdate = Tables['leases']['Update'];
export type TenantUpdate = Tables['tenants']['Update'];
export type PaymentUpdate = Tables['payments']['Update'];
export type PaymentPlanUpdate = Tables['payment_plans']['Update'];
export type MaintenanceRequestUpdate = Tables['maintenance_requests']['Update'];
export type MaintenanceIssueUpdate = Tables['maintenance_issues']['Update'];
export type ContractorUpdate = Tables['contractors']['Update'];
export type ConversationUpdate = Tables['conversations']['Update'];
export type ConversationContextUpdate = Tables['conversation_context']['Update'];
export type DisputeUpdate = Tables['disputes']['Update'];
export type LegalActionUpdate = Tables['legal_actions']['Update'];
export type DocumentTemplateUpdate = Tables['document_templates']['Update'];
export type LandlordNotificationUpdate = Tables['landlord_notifications']['Update'];

// Additional types for AI decisions
export interface AIDecision {
  timestamp: Date;
  action: string;
  reasoning: string;
  confidence: number;
}

// Dashboard metrics type
export interface DashboardMetrics {
  totalLandlords: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  rentCollectedThisMonth: number;
  rentExpectedThisMonth: number;
  activeMaintenanceRequests: number;
  chronicIssues: number;
  activeDisputes: number;
  legalActionsInProgress: number;
  unreadNotifications: number;
  certificatesExpiringSoon: number;
}

// Extended types with relationships
export interface UnitWithDetails extends Unit {
  attributes?: UnitAttributes | null;
  status?: UnitStatus | null;
  documents?: UnitDocument[];
  appliances?: UnitAppliance[];
  current_lease?: Lease | null;
}

export interface LeaseWithTenants extends Lease {
  tenants?: Tenant[];
  unit?: Unit;
}

export interface MaintenanceRequestWithDetails extends MaintenanceRequest {
  lease?: LeaseWithTenants;
  contractor?: Contractor | null;
  chronic_issue?: MaintenanceIssue | null;
}

export interface DisputeWithDetails extends Dispute {
  lease?: LeaseWithTenants;
  legal_actions?: LegalAction[];
}

// Workflow types
export type MaintenanceWorkflow = Tables['maintenance_workflows']['Row'];
export type WorkflowCommunication = Tables['workflow_communications']['Row'];
export type VendorBid = Tables['vendor_bids']['Row'];

export type MaintenanceWorkflowInsert = Tables['maintenance_workflows']['Insert'];
export type WorkflowCommunicationInsert = Tables['workflow_communications']['Insert'];
export type VendorBidInsert = Tables['vendor_bids']['Insert'];

export type MaintenanceWorkflowUpdate = Tables['maintenance_workflows']['Update'];
export type WorkflowCommunicationUpdate = Tables['workflow_communications']['Update'];
export type VendorBidUpdate = Tables['vendor_bids']['Update'];

// Workflow state type
export type WorkflowState = MaintenanceWorkflow['current_state'];

// AI Analysis structure
export interface AIAnalysis {
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  estimated_cost_range: 'low' | 'medium' | 'high';
  vendor_required: boolean;
  reasoning: string;
  confidence_score: number;
}

// Complete workflow with relationships
export interface MaintenanceWorkflowWithDetails extends MaintenanceWorkflow {
  maintenance_request?: MaintenanceRequestWithDetails;
  communications?: WorkflowCommunication[];
  vendor_bids?: VendorBid[];
}