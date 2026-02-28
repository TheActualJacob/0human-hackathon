import { create } from 'zustand';
import { 
  Tenant, 
  MaintenanceTicket, 
  Vendor, 
  Lease, 
  RentPayment, 
  ActivityItem 
} from '@/types';

interface AppState {
  // Agent Configuration
  agentMode: 'active' | 'passive' | 'off';
  autonomyLevel: number; // 0-100

  // Data
  tickets: MaintenanceTicket[];
  tenants: Tenant[];
  vendors: Vendor[];
  leases: Lease[];
  rentPayments: RentPayment[];
  
  // UI State
  activityFeed: ActivityItem[];
  selectedTicket: string | null;
  selectedTenant: string | null;
  
  // Actions
  setAgentMode: (mode: 'active' | 'passive' | 'off') => void;
  setAutonomyLevel: (level: number) => void;
  
  // Ticket Actions
  addTicket: (ticket: MaintenanceTicket) => void;
  updateTicket: (ticketId: string, updates: Partial<MaintenanceTicket>) => void;
  classifyTicket: (ticketId: string) => void;
  assignVendor: (ticketId: string, vendorId: string) => void;
  
  // Activity Actions
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  
  // Selection Actions
  setSelectedTicket: (ticketId: string | null) => void;
  setSelectedTenant: (tenantId: string | null) => void;
  
  // Rent Actions
  updateRentPayment: (paymentId: string, updates: Partial<RentPayment>) => void;
  sendRentReminder: (tenantId: string) => void;
  applyLateFee: (paymentId: string, fee: number) => void;
}

const useStore = create<AppState>((set, get) => ({
  // Initial State
  agentMode: 'active',
  autonomyLevel: 78,
  tickets: [],
  tenants: [],
  vendors: [],
  leases: [],
  rentPayments: [],
  activityFeed: [],
  selectedTicket: null,
  selectedTenant: null,
  
  // Agent Actions
  setAgentMode: (mode) => set({ agentMode: mode }),
  setAutonomyLevel: (level) => set({ autonomyLevel: level }),
  
  // Ticket Actions
  addTicket: (ticket) => {
    set((state) => ({ 
      tickets: [...state.tickets, ticket] 
    }));
    
    get().addActivity({
      type: 'maintenance',
      action: 'Ticket Created',
      details: `New maintenance ticket created for unit ${ticket.unit}`,
      entityId: ticket.id,
      aiGenerated: false
    });
  },
  
  updateTicket: (ticketId, updates) => {
    set((state) => ({
      tickets: state.tickets.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      )
    }));
  },
  
  classifyTicket: (ticketId) => {
    const ticket = get().tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    // Simulate AI classification
    const classifications = {
      plumbing: ['leak', 'water', 'pipe', 'drain', 'sink', 'toilet', 'faucet'],
      electrical: ['light', 'outlet', 'switch', 'power', 'electricity'],
      hvac: ['heat', 'cold', 'air', 'ac', 'temperature', 'thermostat'],
      appliance: ['refrigerator', 'stove', 'dishwasher', 'washer', 'dryer']
    };
    
    let category: MaintenanceTicket['category'] = 'general';
    let urgency: MaintenanceTicket['urgency'] = 'medium';
    
    const desc = ticket.description.toLowerCase();
    
    // Determine category
    for (const [cat, keywords] of Object.entries(classifications)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        category = cat as MaintenanceTicket['category'];
        break;
      }
    }
    
    // Determine urgency
    if (desc.includes('emergency') || desc.includes('flooding') || desc.includes('no power')) {
      urgency = 'emergency';
    } else if (desc.includes('urgent') || desc.includes('leak')) {
      urgency = 'high';
    } else if (desc.includes('minor') || desc.includes('small')) {
      urgency = 'low';
    }
    
    const aiDecision = {
      timestamp: new Date(),
      action: 'Classified Issue',
      reasoning: `Analyzed description and classified as ${category} with ${urgency} priority`,
      confidence: 85
    };
    
    get().updateTicket(ticketId, {
      category,
      urgency,
      aiClassified: true,
      aiDecisions: [...(ticket.aiDecisions || []), aiDecision]
    });
    
    get().addActivity({
      type: 'maintenance',
      action: 'AI Classification',
      details: `Issue classified as ${category} with ${urgency} urgency`,
      entityId: ticketId,
      aiGenerated: true
    });
  },
  
  assignVendor: (ticketId, vendorId) => {
    const ticket = get().tickets.find(t => t.id === ticketId);
    const vendor = get().vendors.find(v => v.id === vendorId);
    
    if (!ticket || !vendor) return;
    
    const aiDecision = {
      timestamp: new Date(),
      action: 'Vendor Assignment',
      reasoning: `Selected ${vendor.name} based on specialty match and ${vendor.avgResponseTime}h response time`,
      confidence: 92
    };
    
    get().updateTicket(ticketId, {
      vendorId,
      vendorName: vendor.name,
      status: 'assigned',
      estimatedCost: vendor.avgCost,
      aiDecisions: [...(ticket.aiDecisions || []), aiDecision]
    });
    
    get().addActivity({
      type: 'vendor',
      action: 'Vendor Assigned',
      details: `${vendor.name} assigned to ticket #${ticketId}`,
      entityId: ticketId,
      aiGenerated: true
    });
  },
  
  // Activity Actions
  addActivity: (activity) => {
    const newActivity: ActivityItem = {
      ...activity,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    
    set((state) => ({
      activityFeed: [newActivity, ...state.activityFeed].slice(0, 50) // Keep last 50
    }));
  },
  
  // Selection Actions
  setSelectedTicket: (ticketId) => set({ selectedTicket: ticketId }),
  setSelectedTenant: (tenantId) => set({ selectedTenant: tenantId }),
  
  // Rent Actions
  updateRentPayment: (paymentId, updates) => {
    set((state) => ({
      rentPayments: state.rentPayments.map((payment) =>
        payment.id === paymentId ? { ...payment, ...updates } : payment
      )
    }));
  },
  
  sendRentReminder: (tenantId) => {
    const tenant = get().tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    
    get().addActivity({
      type: 'rent',
      action: 'Rent Reminder Sent',
      details: `AI sent rent reminder to ${tenant.name} at unit ${tenant.unit}`,
      entityId: tenantId,
      aiGenerated: true
    });
  },
  
  applyLateFee: (paymentId, fee) => {
    get().updateRentPayment(paymentId, { lateFee: fee });
    
    const payment = get().rentPayments.find(p => p.id === paymentId);
    if (payment) {
      get().addActivity({
        type: 'rent',
        action: 'Late Fee Applied',
        details: `$${fee} late fee applied to ${payment.tenantName}'s rent payment`,
        entityId: paymentId,
        aiGenerated: true
      });
    }
  }
}));

export default useStore;