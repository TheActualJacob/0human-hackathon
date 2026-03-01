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

    // 2. Create landlord record, or link to existing one if email already exists
    let landlord;
    const { data: existingLandlord } = await supabase
      .from('landlords')
      .select()
      .eq('email', data.email)
      .single();

    if (existingLandlord) {
      // Link auth user to the existing landlord record
      const { data: updated, error: updateErr } = await supabase
        .from('landlords')
        .update({ auth_user_id: authData.user.id })
        .eq('id', existingLandlord.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      landlord = updated;
    } else {
      const { data: newLandlord, error: landlordError } = await supabase
        .from('landlords')
        .insert({
          auth_user_id: authData.user.id,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
          whatsapp_number: data.whatsappNumber
        })
        .select()
        .single();
      if (landlordError) throw landlordError;
      landlord = newLandlord;
    }

    // 3. Create auth_users mapping
    const { error: mappingError } = await supabase
      .from('auth_users')
      .insert({
        id: authData.user.id,
        role: 'landlord',
        entity_id: landlord.id
      });

    if (mappingError) throw mappingError;

    return { user: authData.user, landlord };
  } catch (error: any) {
    // If we're here, something failed after the auth user was created.
    // We should ideally clean up, but for now, just log clearly.
    throw error;
  }
}

// Sign up as tenant (with or without invite code)
export async function signUpTenant(data: {
  email: string;
  password: string;
  fullName: string;
  whatsappNumber: string;
  inviteCode?: string;
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
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        auth_user_id: authData.user.id,
        full_name: data.fullName,
        email: data.email,
        whatsapp_number: data.whatsappNumber,
        is_primary_tenant: true
      })
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
    
    // Reduced wait time for faster login
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Ensure session is active
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Failed to establish session after login');
    }
    
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
    
    // Clear any local storage or cookies that might persist
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      // Clear all cookies by setting their expiry to the past
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Get current user with role and entity data
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // 1. Get auth user from session (fastest)
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    // 2. Get user role and entity from our custom table
    const { data: authUser, error } = await supabase
      .from('auth_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !authUser) {
      console.warn('Auth user record not found for user ID:', user.id);
      return null;
    }

    // 3. Get entity data based on role
    let entity = null;
    if (authUser.role === 'landlord') {
      const { data } = await supabase
        .from('landlords')
        .select('*')
        .eq('id', authUser.entity_id)
        .maybeSingle();
      entity = data;
    } else if (authUser.role === 'tenant') {
      const { data } = await supabase
        .from('tenants')
        .select('*, leases(*)')
        .eq('id', authUser.entity_id)
        .maybeSingle();
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