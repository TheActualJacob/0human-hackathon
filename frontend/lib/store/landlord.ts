import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type Tables = Database['public']['Tables'];
type Unit = Tables['units']['Row'];
type Tenant = Tables['tenants']['Row'];
type Lease = Tables['leases']['Row'];
type Payment = Tables['payments']['Row'];
type MaintenanceRequest = Tables['maintenance_requests']['Row'];
type MaintenanceWorkflow = Tables['maintenance_workflows']['Row'];
type Contractor = Tables['contractors']['Row'];

interface LandlordState {
  // Data
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  payments: Payment[];
  maintenanceRequests: MaintenanceRequest[];
  maintenanceWorkflows: MaintenanceWorkflow[];
  contractors: Contractor[];
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchLandlordData: (landlordId: string) => Promise<void>;
  createUnit: (unit: Partial<Unit>) => Promise<void>;
  updateUnit: (id: string, updates: Partial<Unit>) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  createLease: (lease: Partial<Lease>) => Promise<void>;
  updateLease: (id: string, updates: Partial<Lease>) => Promise<void>;
  createContractor: (contractor: Partial<Contractor>) => Promise<void>;
  updateContractor: (id: string, updates: Partial<Contractor>) => Promise<void>;
  generateInviteCode: (leaseId: string, email?: string) => Promise<string>;
}

const useLandlordStore = create<LandlordState>()(
  devtools(
    (set, get) => ({
      // Initial state
      units: [],
      tenants: [],
      leases: [],
      payments: [],
      maintenanceRequests: [],
      maintenanceWorkflows: [],
      contractors: [],
      loading: false,
      error: null,

      // Fetch all landlord data
      fetchLandlordData: async (landlordId: string) => {
        set({ loading: true, error: null });
        const supabase = createClient();

        try {
          // Fetch units for this landlord only
          const { data: units, error: unitsError } = await supabase
            .from('units')
            .select('*')
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

          if (unitsError) throw unitsError;

          // Fetch leases for landlord's units
          const unitIds = units?.map(u => u.id) || [];
          const { data: leases, error: leasesError } = await supabase
            .from('leases')
            .select('*')
            .in('unit_id', unitIds)
            .order('created_at', { ascending: false });

          if (leasesError) throw leasesError;

          // Fetch tenants for landlord's leases
          const leaseIds = leases?.map(l => l.id) || [];
          const { data: tenants, error: tenantsError } = await supabase
            .from('tenants')
            .select('*')
            .in('lease_id', leaseIds);

          if (tenantsError) throw tenantsError;

          // Fetch payments
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .in('lease_id', leaseIds)
            .order('created_at', { ascending: false });

          if (paymentsError) throw paymentsError;

          // Fetch maintenance requests
          const { data: maintenanceRequests, error: maintenanceError } = await supabase
            .from('maintenance_requests')
            .select('*')
            .in('lease_id', leaseIds)
            .order('created_at', { ascending: false });

          if (maintenanceError) throw maintenanceError;

          // Fetch maintenance workflows
          const requestIds = maintenanceRequests?.map(r => r.id) || [];
          const { data: maintenanceWorkflows, error: workflowsError } = await supabase
            .from('maintenance_workflows')
            .select('*')
            .in('maintenance_request_id', requestIds)
            .order('created_at', { ascending: false });

          if (workflowsError) throw workflowsError;

          // Fetch contractors for this landlord
          const { data: contractors, error: contractorsError } = await supabase
            .from('contractors')
            .select('*')
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

          if (contractorsError) throw contractorsError;

          set({
            units: units || [],
            leases: leases || [],
            tenants: tenants || [],
            payments: payments || [],
            maintenanceRequests: maintenanceRequests || [],
            maintenanceWorkflows: maintenanceWorkflows || [],
            contractors: contractors || [],
            loading: false
          });

        } catch (error: any) {
          console.error('Error fetching landlord data:', error);
          set({ error: error.message, loading: false });
        }
      },

      // Unit operations
      createUnit: async (unit: Partial<Unit>) => {
        const supabase = createClient();
        
        // ALWAYS get the current auth user to ensure we have the correct landlord_id
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          throw new Error('You must be logged in to create a property');
        }
        
        // Get the landlord ID — try auth_users mapping first, fall back to landlords.auth_user_id
        let landlordId: string | null = null;

        const { data: authUserData } = await supabase
          .from('auth_users')
          .select('entity_id')
          .eq('id', authUser.id)
          .eq('role', 'landlord')
          .single();

        if (authUserData?.entity_id) {
          landlordId = authUserData.entity_id;
        } else {
          // Fallback: look up landlord directly by auth_user_id
          const { data: landlordData } = await supabase
            .from('landlords')
            .select('id')
            .eq('auth_user_id', authUser.id)
            .single();
          landlordId = landlordData?.id ?? null;
        }

        if (!landlordId) {
          throw new Error('Could not find your landlord profile. Please contact support.');
        }

        // Ensure landlord_id is set
        const unitData = {
          ...unit,
          landlord_id: landlordId
        };
        
        console.log('Creating unit with data:', unitData);
        
        const { data, error } = await supabase
          .from('units')
          .insert(unitData)
          .select()
          .single();
        
        if (error) {
          console.error('Error creating unit:', error);
          set({ error: error.message });
          throw error;
        }
        
        console.log('Unit created successfully:', data);
        
        // Refetch data to include the new unit
        get().fetchLandlordData(landlordId);
        
        return data;
      },

      updateUnit: async (id: string, updates: Partial<Unit>) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('units')
          .update(updates)
          .eq('id', id);
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
        
        // Update local state
        set(state => ({
          units: state.units.map(u => u.id === id ? { ...u, ...updates } : u)
        }));
      },

      deleteUnit: async (id: string) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('units')
          .delete()
          .eq('id', id);
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
        
        // Update local state
        set(state => ({
          units: state.units.filter(u => u.id !== id)
        }));
      },

      // Lease operations
      createLease: async (lease: Partial<Lease>) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('leases')
          .insert(lease);
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
      },

      updateLease: async (id: string, updates: Partial<Lease>) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('leases')
          .update(updates)
          .eq('id', id);
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
        
        // Update local state
        set(state => ({
          leases: state.leases.map(l => l.id === id ? { ...l, ...updates } : l)
        }));
      },

      // Contractor operations
      createContractor: async (contractor: Partial<Contractor>) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('contractors')
          .insert(contractor);
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
      },

      updateContractor: async (id: string, updates: Partial<Contractor>) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('contractors')
          .update(updates)
          .eq('id', id);
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
        
        // Update local state
        set(state => ({
          contractors: state.contractors.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
      },

      // Generate invite code for tenant
      generateInviteCode: async (leaseId: string, email?: string) => {
        const supabase = createClient();
        
        // Get landlord ID from lease
        const { data: lease } = await supabase
          .from('leases')
          .select('landlord_id')
          .eq('id', leaseId)
          .single();

        if (!lease) throw new Error('Lease not found');

        const { data, error } = await supabase
          .from('tenant_invites')
          .insert({
            landlord_id: lease.landlord_id,
            lease_id: leaseId,
            email: email
          })
          .select('invite_code')
          .single();
        
        if (error) {
          set({ error: error.message });
          throw error;
        }
        
        return data.invite_code;
      },
    })
  )
);

export default useLandlordStore;