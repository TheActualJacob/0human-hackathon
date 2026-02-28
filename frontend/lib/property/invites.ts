import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type PropertyInvite = Database['public']['Tables']['property_invites']['Row'];

export async function createPropertyInvite(data: {
  unitId: string;
  landlordId: string;
  email: string;
  message?: string;
}) {
  const supabase = createClient();
  
  try {
    // Create the invite
    const { data: invite, error } = await supabase
      .from('property_invites')
      .insert({
        unit_id: data.unitId,
        landlord_id: data.landlordId,
        email: data.email,
        message: data.message
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Generate invite link
    const inviteLink = `${window.location.origin}/properties/${data.unitId}?invite=${invite.token}`;
    
    // In a real app, this would send an email via backend
    // For now, we'll just return the link
    console.log('Email would be sent to:', data.email);
    console.log('Invite link:', inviteLink);
    
    return {
      success: true,
      invite,
      inviteLink,
      message: 'Invitation created successfully'
    };
  } catch (error) {
    console.error('Error creating invite:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invite'
    };
  }
}

export async function validatePropertyInvite(token: string): Promise<{
  valid: boolean;
  invite?: PropertyInvite;
  unitId?: string;
  message?: string;
}> {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('property_invites')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();
    
    if (error || !data) {
      return { valid: false, message: 'Invalid invitation link' };
    }
    
    // Check if invite is expired
    if (new Date(data.expires_at!) < new Date()) {
      return { valid: false, message: 'This invitation has expired' };
    }
    
    return {
      valid: true,
      invite: data,
      unitId: data.unit_id
    };
  } catch (error) {
    console.error('Error validating invite:', error);
    return { valid: false, message: 'Error validating invitation' };
  }
}

export async function markInviteAsUsed(inviteId: string) {
  const supabase = createClient();
  
  try {
    const { error } = await supabase
      .from('property_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', inviteId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error marking invite as used:', error);
    return { success: false, error };
  }
}

export async function getPropertyInvites(unitId: string) {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('property_invites')
      .select('*')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching invites:', error);
    return [];
  }
}