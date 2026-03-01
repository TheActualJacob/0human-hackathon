'use client';

import { createClient } from '@/lib/supabase/client';

const BACKEND = '/api/backend';

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LandlordTerms {
  min_acceptable_rent: number;
  preferred_duration_months: number;
  concessions?: string;
  auto_negotiate: boolean;
}

export interface NegotiationRound {
  id: string;
  tenant_message: string;
  ai_suggested_response: string;
  classification: 'accepting' | 'negotiating' | 'resistant' | 'unclear';
  sentiment_label: 'positive' | 'neutral' | 'negative';
  ai_suggested_counter_rent: number | null;
  ai_new_renewal_probability: number;
  created_at: string;
}

export interface OfferSummary {
  id: string | null;
  status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired' | null;
  proposed_rent: number | null;
  lease_duration_months: number | null;
  sent_at: string | null;
  responded_at: string | null;
  channel: string | null;
}

export type RenewalPhase =
  | 'not_started'
  | 'negotiating'
  | 'concluded_renewed'
  | 'concluded_failed';

export interface DashboardLease {
  lease_id: string;
  tenant_name: string;
  tenant_email: string | null;
  tenant_whatsapp: string | null;
  property: string;
  current_rent: number;
  end_date: string;
  renewal_probability: number;
  recommended_increase_pct: number | null;
  projected_revenue_12m: number;
  revenue_at_risk: number;
  risk_color: 'green' | 'amber' | 'red';
  confidence_score: number | null;
  phase: RenewalPhase;
  latest_offer: OfferSummary | null;
  negotiation_rounds: number;
  last_contact_at: string | null;
  transcript: NegotiationRound[];
}

export interface RenewalDashboard {
  landlord_id: string;
  total_active_leases: number;
  total_at_risk_revenue: number;
  total_renewal_opportunity: number;
  leases: DashboardLease[];
}

export interface SimulationResult {
  lease_id: string;
  score: Record<string, unknown>;
  recommended_scenario: {
    increase_pct: number;
    projected_renewal_probability: number;
    projected_revenue_12m: number;
    expected_value: number;
    risk_label: string;
  };
  top_scenarios: Array<{
    increase_pct: number;
    projected_renewal_probability: number;
    projected_revenue_12m: number;
    expected_value: number;
    risk_label: string;
    is_recommended: boolean;
  }>;
  revenue_delta_vs_no_increase: number;
  vacancy_breakeven_months: number | null;
  turnover_cost_estimate: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function getRenewalDashboard(landlordId: string): Promise<RenewalDashboard> {
  const res = await authFetch(`/renewals/dashboard?landlord_id=${landlordId}`);
  if (!res.ok) throw new Error(res.statusText || 'Dashboard fetch failed');
  return res.json();
}

export async function getSimulation(leaseId: string, marketRent?: number): Promise<SimulationResult> {
  const params = marketRent ? `?market_rent=${marketRent}` : '';
  const res = await authFetch(`/renewals/leases/${leaseId}/simulation${params}`);
  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

/**
 * Landlord sets terms upfront, then the agent takes over and negotiates with
 * the tenant via WhatsApp autonomously.
 */
export async function initiateRenewal(
  leaseId: string,
  terms: LandlordTerms,
  marketRent?: number,
): Promise<{ offer_id: string; proposed_rent: number; sent: boolean }> {
  const res = await authFetch(`/renewals/leases/${leaseId}/initiate`, {
    method: 'POST',
    body: JSON.stringify({ market_rent: marketRent ?? null, terms }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Failed to start negotiation');
  }
  return res.json();
}

export async function sendFollowUp(offerId: string): Promise<{ sent: boolean }> {
  const res = await authFetch(`/renewals/offers/${offerId}/follow-up`, { method: 'POST' });
  if (!res.ok) throw new Error('Follow-up failed');
  return res.json();
}
