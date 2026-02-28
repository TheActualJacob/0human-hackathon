'use client';

import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient();

export type UserRole = 'landlord' | 'tenant';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  entityId: string;
  entity?: any; // Landlord or Tenant data
}

// Sign up as landlord
export async function signUpLandlord(data: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  whatsappNumber?: string;
  companyName?: string;
}) {
  try {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: 'landlord'
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // 2. Create landlord record WITH auth_user_id from the start
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .insert({
        auth_user_id: authData.user.id,  // Set this from the beginning!
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        whatsapp_number: data.whatsappNumber
      })
      .select()
      .single();

    if (landlordError) throw landlordError;

    // 3. Create auth_users mapping
    const { error: mappingError } = await supabase
      .from('auth_users')
      .insert({
        id: authData.user.id,
        role: 'landlord',
        entity_id: landlord.id
      });

    if (mappingError) throw mappingError;

    // 4. Update landlord record with auth_user_id to ensure it's linked
    const { error: updateError } = await supabase
      .from('landlords')
      .update({ auth_user_id: authData.user.id })
      .eq('id', landlord.id);
      
    if (updateError) {
      console.error('Failed to update landlord auth_user_id:', updateError);
    }

    return { user: authData.user, landlord };
  } catch (error: any) {
    // If we're here, something failed after the auth user was created.
    // We should ideally clean up, but for now, just log clearly.
    throw error;
  }
}

// Sign up as tenant with invite code
export async function signUpTenant(data: {
  email: string;
  password: string;
  fullName: string;
  whatsappNumber: string;
  inviteCode?: string; // Now optional for backward compatibility
  profileData?: {
    employmentStatus?: string;
    monthlyIncome?: string;
    currentEmployer?: string;
    employmentDuration?: string;
    hasRentalHistory?: boolean;
    currentAddress?: string;
    reasonForMoving?: string;
    hasPets?: boolean;
    petDetails?: string;
    preferredMoveInDate?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
}) {
  try {
    // If invite code is provided, use the old flow
    if (data.inviteCode) {
      // 1. Verify invite code
      const { data: invite, error: inviteError } = await supabase
        .from('tenant_invites')
        .select('*, leases(*)')
        .eq('invite_code', data.inviteCode.toUpperCase())
        .is('used_at', null)
        .single();

      if (inviteError || !invite) {
        throw new Error('Invalid or expired invite code');
      }

      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('Invite code has expired');
      }

      // 2. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            role: 'tenant'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // 3. Create tenant record WITH lease_id from invite
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          auth_user_id: authData.user.id,
          lease_id: invite.lease_id,
          full_name: data.fullName,
          email: data.email,
          whatsapp_number: data.whatsappNumber,
          is_primary_tenant: true
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 4. Create auth_users mapping
      const { error: mappingError } = await supabase
        .from('auth_users')
        .insert({
          id: authData.user.id,
          role: 'tenant',
          entity_id: tenant.id
        });

      if (mappingError) throw mappingError;

      // 5. Mark invite as used
      await supabase
        .from('tenant_invites')
        .update({
          used_at: new Date().toISOString(),
          used_by: authData.user.id
        })
        .eq('id', invite.id);

      return { user: authData.user, tenant };
    }
    
    // New flow without invite code
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: 'tenant'
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // 2. Create tenant record without lease_id
    const tenantData: any = {
      auth_user_id: authData.user.id,
      full_name: data.fullName,
      email: data.email,
      whatsapp_number: data.whatsappNumber,
      is_primary_tenant: true
    };

    // Store profile data if provided (might need a new column or separate table)
    if (data.profileData) {
      tenantData.profile_data = data.profileData;
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert(tenantData)
      .select()
      .single();

    if (tenantError) throw tenantError;

    // 3. Create auth_users mapping
    const { error: mappingError } = await supabase
      .from('auth_users')
      .insert({
        id: authData.user.id,
        role: 'tenant',
        entity_id: tenant.id
      });

    if (mappingError) throw mappingError;

    return { user: authData.user, tenant };
  } catch (error) {
    console.error('Tenant signup error:', error);
    throw error;
  }
}

// Sign in
export async function signIn(email: string, password: string) {
  try {
    console.log('Attempting sign in with:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase auth error:', error);
      throw error;
    }
    
    // Wait a moment for the session to be fully established and cookies to be set
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Force a session refresh to ensure cookies are updated
    await supabase.auth.getSession();
    
    console.log('Sign in successful:', data);
    return data;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Get current user with role and entity data
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user role and entity
    const { data: authUser, error } = await supabase
      .from('auth_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !authUser) return null;

    // Get entity data based on role
    let entity = null;
    if (authUser.role === 'landlord') {
      const { data } = await supabase
        .from('landlords')
        .select('*')
        .eq('id', authUser.entity_id)
        .single();
      entity = data;
    } else if (authUser.role === 'tenant') {
      const { data } = await supabase
        .from('tenants')
        .select('*, leases(*)')
        .eq('id', authUser.entity_id)
        .single();
      entity = data;
    }

    return {
      id: user.id,
      email: user.email!,
      role: authUser.role as UserRole,
      entityId: authUser.entity_id,
      entity
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// Get session
export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Subscribe to auth changes
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

// Validate invite code
export async function validateInviteCode(code: string) {
  try {
    const { data, error } = await supabase
      .from('tenant_invites')
      .select('*, leases(*, units(*))')
      .eq('invite_code', code.toUpperCase())
      .is('used_at', null)
      .single();

    if (error || !data) {
      return { valid: false, message: 'Invalid invite code' };
    }

    if (new Date(data.expires_at) < new Date()) {
      return { valid: false, message: 'Invite code has expired' };
    }

    return { 
      valid: true, 
      invite: data,
      lease: data.leases,
      unit: data.leases?.units
    };
  } catch (error) {
    console.error('Validate invite error:', error);
    return { valid: false, message: 'Error validating invite code' };
  }
}

// Redirect based on user role
export function useRoleRedirect() {
  const router = useRouter();

  return async () => {
    const user = await getCurrentUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (user.role === 'landlord') {
      router.push('/landlord/dashboard');
    } else if (user.role === 'tenant') {
      router.push('/tenant/dashboard');
    }
  };
}