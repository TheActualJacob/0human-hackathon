// Main type definitions
export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  unit: string;
  leaseId: string;
  moveInDate: Date;
  rentAmount: number;
  paymentStatus: 'current' | 'late' | 'pending';
  riskScore: number; // 0-100
}

export interface MaintenanceTicket {
  id: string;
  tenantId: string;
  tenantName: string;
  unit: string;
  title: string;
  description: string;
  category: 'plumbing' | 'electrical' | 'appliance' | 'hvac' | 'general' | 'emergency';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed';
  vendorId?: string;
  vendorName?: string;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: Date;
  updatedAt: Date;
  aiClassified: boolean;
  aiDecisions: AIDecision[];
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string[];
  avgResponseTime: number; // in hours
  avgCost: number;
  rating: number; // 1-5
  aiPerformanceScore: number; // 0-100
  isAvailable: boolean;
}

export interface Lease {
  id: string;
  tenantId: string;
  unit: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  status: 'active' | 'expiring' | 'expired' | 'terminated';
  renewalRecommendation?: number; // percentage
  suggestedRentIncrease?: number; // percentage
}

export interface RentPayment {
  id: string;
  tenantId: string;
  tenantName: string;
  unit: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: 'paid' | 'late' | 'pending' | 'overdue';
  lateFee?: number;
  aiReminded: boolean;
}

export interface ActivityItem {
  id: string;
  timestamp: Date;
  type: 'maintenance' | 'rent' | 'lease' | 'vendor' | 'system';
  action: string;
  details: string;
  entityId?: string;
  aiGenerated: boolean;
}

export interface AIDecision {
  timestamp: Date;
  action: string;
  reasoning: string;
  confidence: number; // 0-100
}

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