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
        if (!landlordId || landlordId === 'undefined') {
          console.warn('fetchLandlordData called with invalid landlordId:', landlordId);
          set({ loading: false });
          return;
        }
        set({ loading: true, error: null });
        const supabase = createClient();

        try {
          console.log('Fetching data for landlordId:', landlordId);

          // Fetch units for this landlord only
          const { data: units, error: unitsError } = await supabase
            .from('units')
            .select('*')
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

          if (unitsError) {
            console.error('units query failed:', unitsError.message, unitsError.code, unitsError.details, unitsError.hint);
            throw unitsError;
          }
          console.log('Units fetched:', units?.length);

          const unitIds = units?.map(u => u.id) || [];

          // Only fetch dependent data if there are units
          let leases: any[] = [];
          let tenants: any[] = [];
          let payments: any[] = [];
          let maintenanceRequests: any[] = [];
          let maintenanceWorkflows: any[] = [];

          if (unitIds.length > 0) {
            const { data: leasesData, error: leasesError } = await supabase
              .from('leases')
              .select('*')
              .in('unit_id', unitIds)
              .order('created_at', { ascending: false });

            if (leasesError) throw leasesError;
            leases = leasesData || [];

            const leaseIds = leases.map(l => l.id);

            if (leaseIds.length > 0) {
              const [tenantsRes, paymentsRes, maintenanceRes] = await Promise.all([
                supabase.from('tenants').select('*').in('lease_id', leaseIds),
                supabase.from('payments').select('*').in('lease_id', leaseIds).order('created_at', { ascending: false }),
                supabase.from('maintenance_requests').select('*').in('lease_id', leaseIds).order('created_at', { ascending: false }),
              ]);

              if (tenantsRes.error) throw tenantsRes.error;
              if (paymentsRes.error) throw paymentsRes.error;
              if (maintenanceRes.error) throw maintenanceRes.error;

              tenants = tenantsRes.data || [];
              payments = paymentsRes.data || [];
              maintenanceRequests = maintenanceRes.data || [];

              const requestIds = maintenanceRequests.map(r => r.id);
              if (requestIds.length > 0) {
                const { data: workflowsData, error: workflowsError } = await supabase
                  .from('maintenance_workflows')
                  .select('*')
                  .in('maintenance_request_id', requestIds)
                  .order('created_at', { ascending: false });

                if (workflowsError) throw workflowsError;
                maintenanceWorkflows = workflowsData || [];
              }
            }
          }

          // Fetch contractors for this landlord (independent of units)
          const { data: contractors, error: contractorsError } = await supabase
            .from('contractors')
            .select('*')
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

          if (contractorsError) {
            console.error('contractors query failed:', contractorsError.message, contractorsError.code, contractorsError.details, contractorsError.hint);
            throw contractorsError;
          }

          set({
            units: units || [],
            leases,
            tenants,
            payments,
            maintenanceRequests,
            maintenanceWorkflows,
            contractors: contractors || [],
            loading: false
          });

        } catch (error: any) {
          console.error('Error fetching landlord data:', JSON.stringify(error, null, 2), 'message:', error?.message, 'code:', error?.code, 'details:', error?.details);
          set({ error: error?.message || 'Failed to fetch data', loading: false });
        }
      },

      // Unit operations
      createUnit: async (unit: Partial<Unit>) => {
        const supabase = createClient();
        
        // Get current auth user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          throw new Error('You must be logged in to create a property');
        }
        
        // Get the landlord ID from the auth_users table
        const { data: authUserData, error: authError } = await supabase
          .from('auth_users')
          .select('entity_id')
          .eq('id', authUser.id)
          .eq('role', 'landlord')
          .single();
          
        if (authError || !authUserData) {
          console.error('Auth user lookup error:', authError?.message, authError?.details);
          throw new Error('Could not find your landlord profile. Please contact support.');
        }

        // Step 1: Insert only the guaranteed base columns
        const baseData = {
          landlord_id: authUserData.entity_id,
          unit_identifier: unit.unit_identifier || 'New Property',
          address: unit.address || '',
          city: unit.city || '',
          country: unit.country || 'GB',
          jurisdiction: unit.jurisdiction || 'england_wales',
        };

        const { data, error } = await supabase
          .from('units')
          .insert(baseData)
          .select()
          .single();
        
        if (error) {
          console.error('Error creating unit:', error.message, error.code, error.details, error.hint);
          set({ error: error.message });
          throw new Error(error.message || 'Failed to insert unit');
        }

        // Step 2: Update with extended listing columns (may or may not exist in DB)
        const extendedFields: Record<string, any> = {};
        if (unit.listing_status !== undefined)      extendedFields.listing_status = unit.listing_status;
        if (unit.listing_description !== undefined) extendedFields.listing_description = unit.listing_description;
        if (unit.listing_created_at !== undefined)  extendedFields.listing_created_at = unit.listing_created_at;
        if (unit.rent_amount !== undefined)         extendedFields.rent_amount = unit.rent_amount;
        if (unit.security_deposit !== undefined)    extendedFields.security_deposit = unit.security_deposit;
        if (unit.available_date !== undefined)      extendedFields.available_date = unit.available_date;
        // Address + property detail fields
        if (unit.postcode !== undefined)            extendedFields.postcode = unit.postcode;
        if (unit.unit_type !== undefined)           extendedFields.unit_type = unit.unit_type;
        if (unit.bedrooms !== undefined)            extendedFields.bedrooms = unit.bedrooms;
        if (unit.bathrooms !== undefined)           extendedFields.bathrooms = unit.bathrooms;
        if (unit.square_footage !== undefined)      extendedFields.square_footage = unit.square_footage;

        if (Object.keys(extendedFields).length > 0) {
          const { error: updateError } = await supabase
            .from('units')
            .update(extendedFields)
            .eq('id', data.id);

          if (updateError) {
            // Column likely doesn't exist yet — log but don't block
            console.warn('Extended fields not saved (run MUST_RUN_MIGRATION.sql):', updateError.message);
          }
        }
        
        // Refetch data to include the new unit
        get().fetchLandlordData(authUserData.entity_id);
        
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