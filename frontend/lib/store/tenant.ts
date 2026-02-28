import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type Tables = Database['public']['Tables'];
type Tenant = Tables['tenants']['Row'];
type Lease = Tables['leases']['Row'];
type Unit = Tables['units']['Row'];
type Payment = Tables['payments']['Row'];
type MaintenanceRequest = Tables['maintenance_requests']['Row'];
type MaintenanceWorkflow = Tables['maintenance_workflows']['Row'];

interface TenantWithLease extends Tenant {
  leases: Lease & {
    units: Unit;
  };
}

interface TenantState {
  // Data
  tenantInfo: TenantWithLease | null;
  payments: Payment[];
  maintenanceRequests: MaintenanceRequest[];
  maintenanceWorkflows: MaintenanceWorkflow[];
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchTenantData: (tenantId: string) => Promise<void>;
  submitMaintenanceRequest: (request: {
    description: string;
    category?: string;
    urgency?: string;
    attachments?: string[];
  }) => Promise<void>;
  makePayment: (paymentId: string, amount: number) => Promise<void>;
  updateProfile: (updates: Partial<Tenant>) => Promise<void>;
}

const useTenantStore = create<TenantState>()(
  devtools(
    (set, get) => ({
      // Initial state
      tenantInfo: null,
      payments: [],
      maintenanceRequests: [],
      maintenanceWorkflows: [],
      loading: false,
      error: null,

      // Fetch all tenant data
      fetchTenantData: async (tenantId: string) => {
        set({ loading: true, error: null });
        const supabase = createClient();

        try {
          // Fetch specific tenant by ID
          const { data: tenant, error: tenantsError } = await supabase
            .from('tenants')
            .select(`
              *,
              leases (
                *,
                units (*)
              )
            `)
            .eq('id', tenantId)
            .maybeSingle();

          if (tenantsError) throw tenantsError;
          // No tenant record found — show empty dashboard rather than crashing
          if (!tenant) {
            set({ tenantInfo: null, payments: [], maintenanceRequests: [], maintenanceWorkflows: [], loading: false });
            return;
          }

          let payments: Payment[] = [];
          let maintenanceRequests: MaintenanceRequest[] = [];
          let maintenanceWorkflows: MaintenanceWorkflow[] = [];

          // Only fetch lease-related data if tenant has an active lease
          if (tenant.lease_id) {
            const { data: payData } = await supabase
              .from('payments')
              .select('*')
              .eq('lease_id', tenant.lease_id)
              .order('due_date', { ascending: false });

            payments = payData || [];

            const { data: maintData } = await supabase
              .from('maintenance_requests')
              .select('*')
              .eq('lease_id', tenant.lease_id)
              .order('created_at', { ascending: false });

            maintenanceRequests = maintData || [];

            const requestIds = maintenanceRequests.map(r => r.id);
            if (requestIds.length > 0) {
              const { data: wfData, error: workflowsError } = await supabase
                .from('maintenance_workflows')
                .select('*')
                .in('maintenance_request_id', requestIds)
                .order('created_at', { ascending: false });

              if (workflowsError) throw workflowsError;
              maintenanceWorkflows = wfData || [];
            }
          }

          set({
            tenantInfo: tenant as TenantWithLease,
            payments,
            maintenanceRequests,
            maintenanceWorkflows,
            loading: false
          });

        } catch (error: any) {
          console.error('Error fetching tenant data:', error);
          set({ error: error.message, loading: false });
        }
      },

      // Submit maintenance request
      submitMaintenanceRequest: async (request) => {
        const supabase = createClient();
        const tenantInfo = get().tenantInfo;
        
        if (!tenantInfo) {
          set({ error: 'No tenant information found' });
          return;
        }

        try {
          // Create maintenance request
          const { data, error } = await supabase
            .from('maintenance_requests')
            .insert({
              lease_id: tenantInfo.lease_id,
              description: request.description,
              category: request.category || 'other',
              urgency: request.urgency || 'routine',
              status: 'open'
            })
            .select()
            .single();

          if (error) throw error;

          // Create maintenance workflow
          await supabase
            .from('maintenance_workflows')
            .insert({
              maintenance_request_id: data.id,
              current_state: 'SUBMITTED',
              ai_analysis: {},
              state_history: []
            });

          // Refresh data
          await get().fetchTenantData(tenantInfo.id);
          
        } catch (error: any) {
          console.error('Error submitting maintenance request:', error);
          set({ error: error.message });
          throw error;
        }
      },

      // Make payment
      makePayment: async (paymentId: string, amount: number) => {
        const supabase = createClient();
        
        try {
          const { error } = await supabase
            .from('payments')
            .update({
              amount_paid: amount,
              payment_date: new Date().toISOString(),
              status: 'paid'
            })
            .eq('id', paymentId);

          if (error) throw error;

          // Update local state
          set(state => ({
            payments: state.payments.map(p => 
              p.id === paymentId 
                ? { ...p, amount_paid: amount, payment_date: new Date().toISOString(), status: 'paid' }
                : p
            )
          }));
          
        } catch (error: any) {
          console.error('Error making payment:', error);
          set({ error: error.message });
          throw error;
        }
      },

      // Update profile
      updateProfile: async (updates: Partial<Tenant>) => {
        const supabase = createClient();
        const tenantInfo = get().tenantInfo;
        
        if (!tenantInfo) {
          set({ error: 'No tenant information found' });
          return;
        }

        try {
          const { error } = await supabase
            .from('tenants')
            .update(updates)
            .eq('id', tenantInfo.id);

          if (error) throw error;

          // Update local state
          set(state => ({
            tenantInfo: state.tenantInfo ? { ...state.tenantInfo, ...updates } : null
          }));
          
        } catch (error: any) {
          console.error('Error updating profile:', error);
          set({ error: error.message });
          throw error;
        }
      },
    })
  )
);

export default useTenantStore;