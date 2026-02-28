import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserRole } from './client';

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserWithRole() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error('getUserWithRole: Auth error:', authError);
    return null;
  }
  
  if (!user) {
    console.log('getUserWithRole: No user session found');
    return null;
  }

  const { data: authUser, error: roleError } = await supabase
    .from('auth_users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (roleError || !authUser) {
    console.warn('getUserWithRole: No role mapping found for user:', user.id);
    return null;
  }

  return {
    ...user,
    role: authUser.role as UserRole,
    entityId: authUser.entity_id
  };
}

export async function requireAuth(role?: UserRole) {
  try {
    const user = await getUserWithRole();

    if (!user) {
      console.log('requireAuth: No user found, redirecting to login');
      redirect('/auth/login');
    }

    if (role && user.role !== role) {
      console.log(`requireAuth: Role mismatch. Expected ${role}, got ${user.role}`);
      redirect('/unauthorized');
    }

    return user;
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('requireAuth error:', error);
    redirect('/auth/login');
  }
}

export async function requireLandlord() {
  return requireAuth('landlord');
}

export async function requireTenant() {
  return requireAuth('tenant');
}

export async function getLandlordData(userId: string) {
  const supabase = await createClient();
  
  const { data: authUser } = await supabase
    .from('auth_users')
    .select('entity_id')
    .eq('id', userId)
    .eq('role', 'landlord')
    .single();

  if (!authUser) return null;

  const { data: landlord } = await supabase
    .from('landlords')
    .select('*')
    .eq('id', authUser.entity_id)
    .single();

  return landlord;
}

export async function getTenantData(userId: string) {
  const supabase = await createClient();
  
  const { data: authUser } = await supabase
    .from('auth_users')
    .select('entity_id')
    .eq('id', userId)
    .eq('role', 'tenant')
    .single();

  if (!authUser) return null;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*, leases(*)')
    .eq('id', authUser.entity_id)
    .single();

  return tenant;
}