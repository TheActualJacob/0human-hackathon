import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Tables = Database['public']['Tables'];
type Tenant = Tables['tenants']['Row'];
type MaintenanceTicket = Tables['maintenance_tickets']['Row'];
type Vendor = Tables['vendors']['Row'];
type Lease = Tables['leases']['Row'];
type RentPayment = Tables['rent_payments']['Row'];
type ActivityItem = Tables['activity_feed']['Row'];

interface AppState {
  // Agent Configuration
  agentMode: 'active' | 'passive' | 'off';
  autonomyLevel: number;

  // Data
  tickets: MaintenanceTicket[];
  tenants: Tenant[];
  vendors: Vendor[];
  leases: Lease[];
  rentPayments: RentPayment[];
  activityFeed: ActivityItem[];
  
  // UI State
  selectedTicket: string | null;
  selectedTenant: string | null;
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
  
  // Ticket Actions
  addTicket: (ticket: Tables['maintenance_tickets']['Insert']) => Promise<void>;
  updateTicket: (ticketId: string, updates: Tables['maintenance_tickets']['Update']) => Promise<void>;
  
  // Activity Actions
  addActivity: (activity: Tables['activity_feed']['Insert']) => Promise<void>;
  
  // Selection Actions
  setSelectedTicket: (ticketId: string | null) => void;
  setSelectedTenant: (tenantId: string | null) => void;
  
  // Rent Actions
  updateRentPayment: (paymentId: string, updates: Tables['rent_payments']['Update']) => Promise<void>;
}

const supabase = createClient();

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
      const [tenantsRes, ticketsRes, vendorsRes, leasesRes, paymentsRes, activitiesRes] = await Promise.all([
        supabase.from('tenants').select('*').order('name'),
        supabase.from('maintenance_tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').order('name'),
        supabase.from('leases').select('*').order('end_date'),
        supabase.from('rent_payments').select('*').order('due_date', { ascending: false }),
        supabase.from('activity_feed').select('*').order('timestamp', { ascending: false }).limit(50)
      ]);

      if (tenantsRes.error) throw tenantsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;
      if (vendorsRes.error) throw vendorsRes.error;
      if (leasesRes.error) throw leasesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      set({
        tenants: tenantsRes.data || [],
        tickets: ticketsRes.data || [],
        vendors: vendorsRes.data || [],
        leases: leasesRes.data || [],
        rentPayments: paymentsRes.data || [],
        activityFeed: activitiesRes.data || [],
        loading: false
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      set({ error: error.message, loading: false });
    }
  },
  
  // Ticket Actions
  addTicket: async (ticket) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .insert(ticket)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({ 
        tickets: [data, ...state.tickets] 
      }));
      
      // Add activity
      await get().addActivity({
        type: 'maintenance',
        action: 'Ticket Created',
        details: `New maintenance ticket created for unit ${ticket.unit}`,
        entity_id: data.id,
        ai_generated: false
      });
    } catch (error) {
      console.error('Error adding ticket:', error);
      set({ error: error.message });
    }
  },
  
  updateTicket: async (ticketId, updates) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        tickets: state.tickets.map((ticket) =>
          ticket.id === ticketId ? data : ticket
        )
      }));
    } catch (error) {
      console.error('Error updating ticket:', error);
      set({ error: error.message });
    }
  },
  
  // Activity Actions
  addActivity: async (activity) => {
    try {
      const { data, error } = await supabase
        .from('activity_feed')
        .insert(activity)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        activityFeed: [data, ...state.activityFeed].slice(0, 50)
      }));
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  },
  
  // Selection Actions
  setSelectedTicket: (ticketId) => set({ selectedTicket: ticketId }),
  setSelectedTenant: (tenantId) => set({ selectedTenant: tenantId }),
  
  // Rent Actions
  updateRentPayment: async (paymentId, updates) => {
    try {
      const { data, error } = await supabase
        .from('rent_payments')
        .update(updates)
        .eq('id', paymentId)
        .select()
        .single();
      
      if (error) throw error;
      
      set((state) => ({
        rentPayments: state.rentPayments.map((payment) =>
          payment.id === paymentId ? data : payment
        )
      }));
    } catch (error) {
      console.error('Error updating payment:', error);
      set({ error: error.message });
    }
  },
  
  // Real-time subscriptions
  setupSubscriptions: () => {
    const subscriptions: RealtimeChannel[] = [];
    
    // Subscribe to maintenance tickets changes
    const ticketsChannel = supabase
      .channel('maintenance-tickets-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'maintenance_tickets' },
        (payload) => {
          console.log('Ticket change received:', payload);
          // Refresh tickets data
          get().fetchData();
        }
      )
      .subscribe();
    
    subscriptions.push(ticketsChannel);
    
    // Subscribe to activity feed changes
    const activityChannel = supabase
      .channel('activity-feed-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        (payload) => {
          console.log('New activity:', payload);
          // Add new activity to the feed
          if (payload.new) {
            set((state) => ({
              activityFeed: [payload.new as ActivityItem, ...state.activityFeed].slice(0, 50)
            }));
          }
        }
      )
      .subscribe();
    
    subscriptions.push(activityChannel);
    
    // Subscribe to rent payments changes
    const paymentsChannel = supabase
      .channel('rent-payments-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rent_payments' },
        (payload) => {
          console.log('Payment change received:', payload);
          get().fetchData();
        }
      )
      .subscribe();
    
    subscriptions.push(paymentsChannel);
    
    set({ subscriptions });
  },
  
  cleanupSubscriptions: () => {
    const { subscriptions } = get();
    subscriptions.forEach(channel => {
      supabase.removeChannel(channel);
    });
    set({ subscriptions: [] });
  }
}));

export default useStore;