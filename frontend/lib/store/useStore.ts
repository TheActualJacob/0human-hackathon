import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Landlord,
  Unit,
  UnitAttributes,
  UnitStatus,
  UnitDocument,
  UnitAppliance,
  Lease,
  Tenant,
  Payment,
  PaymentPlan,
  MaintenanceRequest,
  MaintenanceIssue,
  Contractor,
  Conversation,
  ConversationContext,
  Dispute,
  LegalAction,
  LandlordNotification,
  AgentAction,
  UnitWithDetails,
  LeaseWithTenants,
  MaintenanceRequestWithDetails,
} from '@/types';

type Tables = Database['public']['Tables'];

interface AppState {
  // Agent Configuration
  agentMode: 'active' | 'passive' | 'off';
  autonomyLevel: number;

  // Core Entities
  landlords: Landlord[];
  units: Unit[];
  unitAttributes: UnitAttributes[];
  unitStatus: UnitStatus[];
  unitDocuments: UnitDocument[];
  unitAppliances: UnitAppliance[];
  leases: Lease[];
  tenants: Tenant[];
  payments: Payment[];
  paymentPlans: PaymentPlan[];
  maintenanceRequests: MaintenanceRequest[];
  maintenanceIssues: MaintenanceIssue[];
  contractors: Contractor[];
  conversations: Conversation[];
  conversationContexts: ConversationContext[];
  disputes: Dispute[];
  legalActions: LegalAction[];
  landlordNotifications: LandlordNotification[];
  agentActions: AgentAction[];
  
  // UI State
  selectedUnit: string | null;
  selectedLease: string | null;
  selectedMaintenanceRequest: string | null;
  selectedDispute: string | null;
  selectedConversation: string | null;
  loading: boolean;
  error: string | null;
  
  // Real-time subscriptions
  subscriptions: RealtimeChannel[];
  
  // Actions
  setAgentMode: (mode: 'active' | 'passive' | 'off') => void;
  setAutonomyLevel: (level: number) => void;
  
  // Data fetching
  fetchData: () => Promise<void>;
  
  // Real-time subscriptions
  setupSubscriptions: () => void;
  cleanupSubscriptions: () => void;
  
  // Landlord Actions
  addLandlord: (landlord: Tables['landlords']['Insert']) => Promise<void>;
  updateLandlord: (landlordId: string, updates: Tables['landlords']['Update']) => Promise<void>;
  
  // Unit Actions
  addUnit: (unit: Tables['units']['Insert']) => Promise<void>;
  updateUnit: (unitId: string, updates: Tables['units']['Update']) => Promise<void>;
  
  // Maintenance Actions
  addMaintenanceRequest: (request: Tables['maintenance_requests']['Insert']) => Promise<void>;
  updateMaintenanceRequest: (requestId: string, updates: Tables['maintenance_requests']['Update']) => Promise<void>;
  addMaintenanceIssue: (issue: Tables['maintenance_issues']['Insert']) => Promise<void>;
  updateMaintenanceIssue: (issueId: string, updates: Tables['maintenance_issues']['Update']) => Promise<void>;
  
  // Payment Actions
  updatePayment: (paymentId: string, updates: Tables['payments']['Update']) => Promise<void>;
  addPaymentPlan: (plan: Tables['payment_plans']['Insert']) => Promise<void>;
  
  // Legal Actions
  addDispute: (dispute: Tables['disputes']['Insert']) => Promise<void>;
  updateDispute: (disputeId: string, updates: Tables['disputes']['Update']) => Promise<void>;
  addLegalAction: (action: Tables['legal_actions']['Insert']) => Promise<void>;
  
  // Conversation Actions
  addConversation: (conversation: Tables['conversations']['Insert']) => Promise<void>;
  updateConversationContext: (leaseId: string, updates: Tables['conversation_context']['Update']) => Promise<void>;
  
  // Notification Actions
  addLandlordNotification: (notification: Tables['landlord_notifications']['Insert']) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  
  // Agent Actions
  logAgentAction: (action: Tables['agent_actions']['Insert']) => Promise<void>;
  
  // Selection Actions
  setSelectedUnit: (unitId: string | null) => void;
  setSelectedLease: (leaseId: string | null) => void;
  setSelectedMaintenanceRequest: (requestId: string | null) => void;
  setSelectedDispute: (disputeId: string | null) => void;
  setSelectedConversation: (conversationId: string | null) => void;
  
  // Helper functions
  getUnitWithDetails: (unitId: string) => UnitWithDetails | null;
  getLeaseWithTenants: (leaseId: string) => LeaseWithTenants | null;
  getMaintenanceRequestWithDetails: (requestId: string) => MaintenanceRequestWithDetails | null;
}

const supabase = createClient();

const useStore = create<AppState>((set, get) => ({
  // Initial State
  agentMode: 'active',
  autonomyLevel: 78,
  landlords: [],
  units: [],
  unitAttributes: [],
  unitStatus: [],
  unitDocuments: [],
  unitAppliances: [],
  leases: [],
  tenants: [],
  payments: [],
  paymentPlans: [],
  maintenanceRequests: [],
  maintenanceIssues: [],
  contractors: [],
  conversations: [],
  conversationContexts: [],
  disputes: [],
  legalActions: [],
  landlordNotifications: [],
  agentActions: [],
  selectedUnit: null,
  selectedLease: null,
  selectedMaintenanceRequest: null,
  selectedDispute: null,
  selectedConversation: null,
  loading: false,
  error: null,
  subscriptions: [],
  
  // Agent Actions
  setAgentMode: (mode) => set({ agentMode: mode }),
  setAutonomyLevel: (level) => set({ autonomyLevel: level }),
  
  // Data fetching
  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      // Fetch all data in parallel
      const [
        landlordsRes,
        unitsRes,
        unitAttributesRes,
        unitStatusRes,
        unitDocumentsRes,
        unitAppliancesRes,
        leasesRes,
        tenantsRes,
        paymentsRes,
        paymentPlansRes,
        maintenanceRequestsRes,
        maintenanceIssuesRes,
        contractorsRes,
        conversationsRes,
        conversationContextsRes,
        disputesRes,
        legalActionsRes,
        landlordNotificationsRes,
        agentActionsRes,
      ] = await Promise.all([
        supabase.from('landlords').select('*').order('full_name'),
        supabase.from('units').select('*').order('unit_identifier'),
        supabase.from('unit_attributes').select('*'),
        supabase.from('unit_status').select('*'),
        supabase.from('unit_documents').select('*').order('expiry_date'),
        supabase.from('unit_appliances').select('*'),
        supabase.from('leases').select('*').order('start_date', { ascending: false }),
        supabase.from('tenants').select('*').order('full_name'),
        supabase.from('payments').select('*').order('due_date', { ascending: false }),
        supabase.from('payment_plans').select('*').order('start_date', { ascending: false }),
        supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('maintenance_issues').select('*').order('last_reported_at', { ascending: false }),
        supabase.from('contractors').select('*').order('name'),
        supabase.from('conversations').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('conversation_context').select('*'),
        supabase.from('disputes').select('*').order('opened_at', { ascending: false }),
        supabase.from('legal_actions').select('*').order('issued_at', { ascending: false }),
        supabase.from('landlord_notifications').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('agent_actions').select('*').order('timestamp', { ascending: false }).limit(50),
      ]);

      // Check for errors
      if (landlordsRes.error) throw landlordsRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (unitAttributesRes.error) throw unitAttributesRes.error;
      if (unitStatusRes.error) throw unitStatusRes.error;
      if (unitDocumentsRes.error) throw unitDocumentsRes.error;
      if (unitAppliancesRes.error) throw unitAppliancesRes.error;
      if (leasesRes.error) throw leasesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (paymentPlansRes.error) throw paymentPlansRes.error;
      if (maintenanceRequestsRes.error) throw maintenanceRequestsRes.error;
      if (maintenanceIssuesRes.error) throw maintenanceIssuesRes.error;
      if (contractorsRes.error) throw contractorsRes.error;
      if (conversationsRes.error) throw conversationsRes.error;
      if (conversationContextsRes.error) throw conversationContextsRes.error;
      if (disputesRes.error) throw disputesRes.error;
      if (legalActionsRes.error) throw legalActionsRes.error;
      if (landlordNotificationsRes.error) throw landlordNotificationsRes.error;
      if (agentActionsRes.error) throw agentActionsRes.error;

      set({
        landlords: landlordsRes.data || [],
        units: unitsRes.data || [],
        unitAttributes: unitAttributesRes.data || [],
        unitStatus: unitStatusRes.data || [],
        unitDocuments: unitDocumentsRes.data || [],
        unitAppliances: unitAppliancesRes.data || [],
        leases: leasesRes.data || [],
        tenants: tenantsRes.data || [],
        payments: paymentsRes.data || [],
        paymentPlans: paymentPlansRes.data || [],
        maintenanceRequests: maintenanceRequestsRes.data || [],
        maintenanceIssues: maintenanceIssuesRes.data || [],
        contractors: contractorsRes.data || [],
        conversations: conversationsRes.data || [],
        conversationContexts: conversationContextsRes.data || [],
        disputes: disputesRes.data || [],
        legalActions: legalActionsRes.data || [],
        landlordNotifications: landlordNotificationsRes.data || [],
        agentActions: agentActionsRes.data || [],
        loading: false
      });
    } catch (error: any) {
      console.error('Error fetching data:', error);
      set({ error: error.message, loading: false });
    }
  },
  
  // Landlord Actions
  addLandlord: async (landlord) => {
    try {
      const { data, error } = await supabase
        .from('landlords')
        .insert(landlord)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        landlords: [...state.landlords, data] 
      }));
    } catch (error: any) {
      console.error('Error adding landlord:', error);
      set({ error: error.message });
    }
  },
  
  updateLandlord: async (landlordId, updates) => {
    try {
      const { data, error } = await supabase
        .from('landlords')
        .update(updates)
        .eq('id', landlordId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        landlords: state.landlords.map((landlord) =>
          landlord.id === landlordId ? data : landlord
        )
      }));
    } catch (error: any) {
      console.error('Error updating landlord:', error);
      set({ error: error.message });
    }
  },
  
  // Unit Actions
  addUnit: async (unit) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .insert(unit)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        units: [...state.units, data] 
      }));
    } catch (error: any) {
      console.error('Error adding unit:', error);
      set({ error: error.message });
    }
  },
  
  updateUnit: async (unitId, updates) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .update(updates)
        .eq('id', unitId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        units: state.units.map((unit) =>
          unit.id === unitId ? data : unit
        )
      }));
    } catch (error: any) {
      console.error('Error updating unit:', error);
      set({ error: error.message });
    }
  },
  
  // Maintenance Actions
  addMaintenanceRequest: async (request) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .insert(request)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        maintenanceRequests: [data, ...state.maintenanceRequests] 
      }));
      
      // Log agent action
      await get().logAgentAction({
        lease_id: request.lease_id,
        action_category: 'maintenance',
        action_description: `New maintenance request created: ${request.description}`,
        confidence_score: 0.95
      });
    } catch (error: any) {
      console.error('Error adding maintenance request:', error);
      set({ error: error.message });
    }
  },
  
  updateMaintenanceRequest: async (requestId, updates) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        maintenanceRequests: state.maintenanceRequests.map((request) =>
          request.id === requestId ? data : request
        )
      }));
    } catch (error: any) {
      console.error('Error updating maintenance request:', error);
      set({ error: error.message });
    }
  },
  
  addMaintenanceIssue: async (issue) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_issues')
        .insert(issue)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        maintenanceIssues: [data, ...state.maintenanceIssues] 
      }));
    } catch (error: any) {
      console.error('Error adding maintenance issue:', error);
      set({ error: error.message });
    }
  },
  
  updateMaintenanceIssue: async (issueId, updates) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_issues')
        .update(updates)
        .eq('id', issueId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        maintenanceIssues: state.maintenanceIssues.map((issue) =>
          issue.id === issueId ? data : issue
        )
      }));
    } catch (error: any) {
      console.error('Error updating maintenance issue:', error);
      set({ error: error.message });
    }
  },
  
  // Payment Actions
  updatePayment: async (paymentId, updates) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', paymentId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        payments: state.payments.map((payment) =>
          payment.id === paymentId ? data : payment
        )
      }));
    } catch (error: any) {
      console.error('Error updating payment:', error);
      set({ error: error.message });
    }
  },
  
  addPaymentPlan: async (plan) => {
    try {
      const { data, error } = await supabase
        .from('payment_plans')
        .insert(plan)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        paymentPlans: [data, ...state.paymentPlans] 
      }));
    } catch (error: any) {
      console.error('Error adding payment plan:', error);
      set({ error: error.message });
    }
  },
  
  // Legal Actions
  addDispute: async (dispute) => {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .insert(dispute)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        disputes: [data, ...state.disputes] 
      }));
    } catch (error: any) {
      console.error('Error adding dispute:', error);
      set({ error: error.message });
    }
  },
  
  updateDispute: async (disputeId, updates) => {
    try {
      const { data, error } = await supabase
        .from('disputes')
        .update(updates)
        .eq('id', disputeId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        disputes: state.disputes.map((dispute) =>
          dispute.id === disputeId ? data : dispute
        )
      }));
    } catch (error: any) {
      console.error('Error updating dispute:', error);
      set({ error: error.message });
    }
  },
  
  addLegalAction: async (action) => {
    try {
      const { data, error } = await supabase
        .from('legal_actions')
        .insert(action)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        legalActions: [data, ...state.legalActions] 
      }));
      
      // Log agent action
      await get().logAgentAction({
        lease_id: action.lease_id,
        action_category: 'legal',
        action_description: `Legal action initiated: ${action.action_type}`,
        confidence_score: 0.85
      });
    } catch (error: any) {
      console.error('Error adding legal action:', error);
      set({ error: error.message });
    }
  },
  
  // Conversation Actions
  addConversation: async (conversation) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert(conversation)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        conversations: [data, ...state.conversations].slice(0, 100) 
      }));
    } catch (error: any) {
      console.error('Error adding conversation:', error);
      set({ error: error.message });
    }
  },
  
  updateConversationContext: async (leaseId, updates) => {
    try {
      const { data, error } = await supabase
        .from('conversation_context')
        .update(updates)
        .eq('lease_id', leaseId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        conversationContexts: state.conversationContexts.map((context) =>
          context.lease_id === leaseId ? data : context
        )
      }));
    } catch (error: any) {
      console.error('Error updating conversation context:', error);
      set({ error: error.message });
    }
  },
  
  // Notification Actions
  addLandlordNotification: async (notification) => {
    try {
      const { data, error } = await supabase
        .from('landlord_notifications')
        .insert(notification)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        landlordNotifications: [data, ...state.landlordNotifications].slice(0, 50) 
      }));
    } catch (error: any) {
      console.error('Error adding notification:', error);
      set({ error: error.message });
    }
  },
  
  markNotificationRead: async (notificationId) => {
    try {
      const { data, error } = await supabase
        .from('landlord_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        landlordNotifications: state.landlordNotifications.map((notification) =>
          notification.id === notificationId ? data : notification
        )
      }));
    } catch (error: any) {
      console.error('Error marking notification read:', error);
      set({ error: error.message });
    }
  },
  
  // Agent Actions
  logAgentAction: async (action) => {
    try {
      const { data, error } = await supabase
        .from('agent_actions')
        .insert(action)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        agentActions: [data, ...state.agentActions].slice(0, 50)
      }));
    } catch (error: any) {
      console.error('Error logging agent action:', error);
    }
  },
  
  // Selection Actions
  setSelectedUnit: (unitId) => set({ selectedUnit: unitId }),
  setSelectedLease: (leaseId) => set({ selectedLease: leaseId }),
  setSelectedMaintenanceRequest: (requestId) => set({ selectedMaintenanceRequest: requestId }),
  setSelectedDispute: (disputeId) => set({ selectedDispute: disputeId }),
  setSelectedConversation: (conversationId) => set({ selectedConversation: conversationId }),
  
  // Real-time subscriptions
  setupSubscriptions: () => {
    const subscriptions: RealtimeChannel[] = [];
    
    // Subscribe to maintenance requests
    const maintenanceChannel = supabase
      .channel('maintenance-requests-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'maintenance_requests' },
        (payload) => {
          console.log('Maintenance request change:', payload);
          get().fetchData();
        }
      )
      .subscribe();
    subscriptions.push(maintenanceChannel);
    
    // Subscribe to conversations
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('New conversation:', payload);
          if (payload.new) {
            set((state) => ({
              conversations: [payload.new as Conversation, ...state.conversations].slice(0, 100)
            }));
          }
        }
      )
      .subscribe();
    subscriptions.push(conversationsChannel);
    
    // Subscribe to payments
    const paymentsChannel = supabase
      .channel('payments-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          console.log('Payment change:', payload);
          get().fetchData();
        }
      )
      .subscribe();
    subscriptions.push(paymentsChannel);
    
    // Subscribe to landlord notifications
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'landlord_notifications' },
        (payload) => {
          console.log('New notification:', payload);
          if (payload.new) {
            set((state) => ({
              landlordNotifications: [payload.new as LandlordNotification, ...state.landlordNotifications].slice(0, 50)
            }));
          }
        }
      )
      .subscribe();
    subscriptions.push(notificationsChannel);
    
    // Subscribe to disputes
    const disputesChannel = supabase
      .channel('disputes-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'disputes' },
        (payload) => {
          console.log('Dispute change:', payload);
          get().fetchData();
        }
      )
      .subscribe();
    subscriptions.push(disputesChannel);
    
    set({ subscriptions });
  },
  
  cleanupSubscriptions: () => {
    const { subscriptions } = get();
    subscriptions.forEach(channel => {
      supabase.removeChannel(channel);
    });
    set({ subscriptions: [] });
  },
  
  // Helper functions
  getUnitWithDetails: (unitId) => {
    const state = get();
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return null;
    
    return {
      ...unit,
      attributes: state.unitAttributes.find(a => a.unit_id === unitId) || null,
      status: state.unitStatus.find(s => s.unit_id === unitId) || null,
      documents: state.unitDocuments.filter(d => d.unit_id === unitId),
      appliances: state.unitAppliances.filter(a => a.unit_id === unitId),
      current_lease: state.leases.find(l => l.unit_id === unitId && l.status === 'active') || null
    };
  },
  
  getLeaseWithTenants: (leaseId) => {
    const state = get();
    const lease = state.leases.find(l => l.id === leaseId);
    if (!lease) return null;
    
    return {
      ...lease,
      tenants: state.tenants.filter(t => t.lease_id === leaseId),
      unit: state.units.find(u => u.id === lease.unit_id)
    };
  },
  
  getMaintenanceRequestWithDetails: (requestId) => {
    const state = get();
    const request = state.maintenanceRequests.find(r => r.id === requestId);
    if (!request) return null;
    
    const lease = state.leases.find(l => l.id === request.lease_id);
    if (!lease) return { ...request, lease: null, contractor: null, chronic_issue: null };
    
    return {
      ...request,
      lease: {
        ...lease,
        tenants: state.tenants.filter(t => t.lease_id === lease.id),
        unit: state.units.find(u => u.id === lease.unit_id)
      },
      contractor: request.contractor_id ? state.contractors.find(c => c.id === request.contractor_id) || null : null,
      chronic_issue: request.maintenance_issue_id ? state.maintenanceIssues.find(i => i.id === request.maintenance_issue_id) || null : null
    };
  }
}));

export default useStore;