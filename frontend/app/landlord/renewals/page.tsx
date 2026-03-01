'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from '@/lib/auth/client';
import {
  getRenewalDashboard,
  initiateRenewal,
  sendFollowUp,
  type RenewalDashboard,
  type DashboardLease,
  type LandlordTerms,
  type NegotiationRound,
} from '@/lib/api/renewals';
import {
  CheckCircle2, XCircle, MessageSquare, Clock, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Bot, User, Euro,
  Zap, TrendingUp, Building2, Phone,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'never';
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Phase badge ────────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: DashboardLease['phase'] }) {
  const configs = {
    not_started: { label: 'Not Started', icon: <Clock className="w-3 h-3" />, cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
    negotiating: { label: 'Agent Negotiating', icon: <Bot className="w-3 h-3 animate-pulse" />, cls: 'bg-blue-950 text-blue-300 border-blue-800' },
    concluded_renewed: { label: 'Renewed ✓', icon: <CheckCircle2 className="w-3 h-3" />, cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
    concluded_failed: { label: 'Re-listing', icon: <XCircle className="w-3 h-3" />, cls: 'bg-red-950 text-red-300 border-red-800' },
  } as const;
  const { label, icon, cls } = configs[phase];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cls}`}>
      {icon}{label}
    </span>
  );
}

// ── Transcript ─────────────────────────────────────────────────────────────────

function TranscriptPanel({ transcript }: { transcript: NegotiationRound[] }) {
  if (transcript.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-500 text-sm">
        No responses yet — waiting for tenant to reply.
      </div>
    );
  }

  const sentimentColor = { positive: 'text-emerald-400', neutral: 'text-zinc-400', negative: 'text-red-400' };
  const classColors = {
    accepting: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    negotiating: 'bg-amber-950 text-amber-300 border-amber-800',
    resistant: 'bg-red-950 text-red-300 border-red-800',
    unclear: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };

  return (
    <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
      {transcript.map((round, i) => (
        <div key={round.id || i} className="space-y-2">
          {/* Tenant message */}
          <div className="flex gap-3">
            <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-500">Tenant</span>
                <span className={`text-xs ${sentimentColor[round.sentiment_label]}`}>
                  {round.sentiment_label}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded border ${classColors[round.classification]}`}>
                  {round.classification}
                </span>
                <span className="text-xs text-zinc-600">{fmtDate(round.created_at)}</span>
              </div>
              <div className="bg-zinc-800 rounded-xl rounded-tl-sm px-3 py-2 text-sm text-zinc-200">
                {round.tenant_message}
              </div>
            </div>
          </div>

          {/* Agent response */}
          {round.ai_suggested_response && (
            <div className="flex gap-3 flex-row-reverse">
              <div className="shrink-0 w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-blue-300" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-row-reverse">
                  <span className="text-xs text-zinc-500">AI Agent</span>
                  {round.ai_suggested_counter_rent && (
                    <span className="text-xs text-amber-400">
                      Counter: €{round.ai_suggested_counter_rent.toFixed(0)}/mo
                    </span>
                  )}
                </div>
                <div className="bg-blue-950 border border-blue-900 rounded-xl rounded-tr-sm px-3 py-2 text-sm text-blue-100">
                  {round.ai_suggested_response}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Set Terms Modal ────────────────────────────────────────────────────────────

interface SetTermsModalProps {
  lease: DashboardLease;
  onClose: () => void;
  onSubmit: (terms: LandlordTerms) => Promise<void>;
}

function SetTermsModal({ lease, onClose, onSubmit }: SetTermsModalProps) {
  const [minRent, setMinRent] = useState<string>(String(Math.round(lease.current_rent * 1.03)));
  const [duration, setDuration] = useState<string>('12');
  const [concessions, setConcessions] = useState<string>('');
  const [autoNegotiate, setAutoNegotiate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recIncrease = lease.recommended_increase_pct ?? 3;
  const suggestedRent = Math.round(lease.current_rent * (1 + recIncrease / 100));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const min = parseFloat(minRent);
    if (isNaN(min) || min <= 0) { setError('Enter a valid minimum rent'); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        min_acceptable_rent: min,
        preferred_duration_months: parseInt(duration),
        concessions: concessions.trim() || undefined,
        auto_negotiate: autoNegotiate,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start negotiation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Set Agent Terms</h2>
              <p className="text-xs text-zinc-500">{lease.tenant_name} · {lease.property}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Min rent */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Minimum acceptable rent
              <span className="text-zinc-600 font-normal ml-1">(agent will never go below this)</span>
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="number"
                min={1}
                step={10}
                value={minRent}
                onChange={e => setMinRent(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. 1200"
                required
              />
            </div>
            <div className="flex gap-3 mt-1.5">
              <button type="button" onClick={() => setMinRent(String(lease.current_rent))}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Current €{lease.current_rent.toFixed(0)}
              </button>
              <span className="text-zinc-700">·</span>
              <button type="button" onClick={() => setMinRent(String(suggestedRent))}
                className="text-xs text-blue-500 hover:text-blue-300 transition-colors">
                Suggested €{suggestedRent} (+{recIncrease.toFixed(1)}%)
              </button>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Preferred lease duration</label>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
            </select>
          </div>

          {/* Concessions */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Concessions you are willing to offer
              <span className="text-zinc-600 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={concessions}
              onChange={e => setConcessions(e.target.value)}
              rows={2}
              placeholder="e.g. Repaint bedroom if signing 24 months, replace dishwasher..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
            />
          </div>

          {/* Auto-negotiate toggle */}
          <div className="flex items-start gap-3 bg-zinc-800 rounded-lg p-3">
            <input
              id="auto"
              type="checkbox"
              checked={autoNegotiate}
              onChange={e => setAutoNegotiate(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-500"
            />
            <label htmlFor="auto" className="cursor-pointer">
              <div className="text-sm text-white font-medium">Fully autonomous negotiation</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Agent will negotiate back-and-forth with the tenant without interrupting you. You'll only hear when a deal is reached or the tenant declines.
              </div>
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Starting…</>
              ) : (
                <><Bot className="w-3.5 h-3.5" />Start Agent Negotiation</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lease Card ─────────────────────────────────────────────────────────────────

interface LeaseCardProps {
  lease: DashboardLease;
  onInitiate: (lease: DashboardLease) => void;
  onFollowUp: (offerId: string) => void;
}

function LeaseCard({ lease, onInitiate, onFollowUp }: LeaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const days = daysUntil(lease.end_date);

  const riskColors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`shrink-0 w-2 h-2 mt-2 rounded-full ${riskColors[lease.risk_color]}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">{lease.tenant_name}</span>
                <PhaseBadge phase={lease.phase} />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-500">
                <Building2 className="w-3 h-3" />
                <span>{lease.property}</span>
                {lease.tenant_whatsapp && (
                  <>
                    <span>·</span>
                    <Phone className="w-3 h-3" />
                    <span>{lease.tenant_whatsapp}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-semibold text-white">
              €{(lease.latest_offer?.proposed_rent ?? lease.current_rent).toFixed(0)}
              <span className="text-xs text-zinc-500 font-normal">/mo</span>
            </div>
            {lease.latest_offer?.proposed_rent && (
              <div className="text-xs text-zinc-500">
                was €{lease.current_rent.toFixed(0)}
              </div>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="text-xs text-zinc-500">
            <span className="text-zinc-300 font-medium">{Math.abs(days)}d</span>{' '}
            {days > 0 ? 'until expiry' : 'past expiry'}
          </div>
          {lease.renewal_probability !== undefined && (
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-zinc-300 font-medium">{(lease.renewal_probability * 100).toFixed(0)}%</span>
              <span>renewal prob.</span>
            </div>
          )}
          {lease.phase === 'negotiating' && lease.last_contact_at && (
            <div className="text-xs text-zinc-500">
              Last contact: <span className="text-zinc-300">{timeAgo(lease.last_contact_at)}</span>
            </div>
          )}
          {lease.phase === 'negotiating' && lease.negotiation_rounds > 0 && (
            <div className="text-xs text-zinc-500">
              <span className="text-blue-400 font-medium">{lease.negotiation_rounds}</span> round{lease.negotiation_rounds !== 1 ? 's' : ''}
            </div>
          )}
          {lease.phase === 'concluded_renewed' && lease.latest_offer?.responded_at && (
            <div className="text-xs text-emerald-400">
              Agreed {fmtDate(lease.latest_offer.responded_at)} · {lease.latest_offer.lease_duration_months}mo
            </div>
          )}
          {lease.phase === 'concluded_failed' && lease.latest_offer?.responded_at && (
            <div className="text-xs text-red-400">
              Declined {fmtDate(lease.latest_offer.responded_at)}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          {lease.phase === 'not_started' && (
            <button
              onClick={() => onInitiate(lease)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Bot className="w-3 h-3" />
              Set Terms & Start Agent
            </button>
          )}

          {lease.phase === 'negotiating' && lease.latest_offer?.id && (
            <button
              onClick={() => onFollowUp(lease.latest_offer!.id!)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              Send Follow-up
            </button>
          )}

          {lease.transcript.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-colors ml-auto"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide' : 'View'} transcript ({lease.negotiation_rounds})
            </button>
          )}
        </div>
      </div>

      {/* Transcript panel */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Negotiation Transcript</span>
            <span className="text-xs text-zinc-600">— read only, agent negotiated autonomously</span>
          </div>
          <TranscriptPanel transcript={lease.transcript} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LeaseRenewalsPage() {
  const [dashboard, setDashboard] = useState<RenewalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [termsTarget, setTermsTarget] = useState<DashboardLease | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user?.entityId) throw new Error('Not authenticated');
      const data = await getRenewalDashboard(user.entityId);
      setDashboard(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Dashboard fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  async function handleInitiate(terms: LandlordTerms) {
    if (!termsTarget) return;
    await initiateRenewal(termsTarget.lease_id, terms);
    await fetchDashboard();
  }

  async function handleFollowUp(offerId: string) {
    setFollowUpLoading(offerId);
    try { await sendFollowUp(offerId); }
    finally { setFollowUpLoading(null); }
  }

  // Group leases by phase
  const byPhase = (phase: DashboardLease['phase']) =>
    (dashboard?.leases ?? []).filter(l => l.phase === phase);

  const negotiating = byPhase('negotiating');
  const renewed = byPhase('concluded_renewed');
  const failed = byPhase('concluded_failed');
  const notStarted = byPhase('not_started').filter(l => daysUntil(l.end_date) <= 120);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading renewal dashboard…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-zinc-300 mb-4">{error}</p>
          <button onClick={fetchDashboard}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Lease Renewals</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Agent negotiates directly with tenants via WhatsApp. You set the terms once.
            </p>
          </div>
          <button onClick={fetchDashboard}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Negotiating', value: negotiating.length, icon: <Bot className="w-4 h-4 text-blue-400" />, color: 'text-blue-400' },
            { label: 'Renewed', value: renewed.length, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-400' },
            { label: 'Re-listing', value: failed.length, icon: <XCircle className="w-4 h-4 text-red-400" />, color: 'text-red-400' },
            { label: 'Awaiting Terms', value: notStarted.length, icon: <Clock className="w-4 h-4 text-amber-400" />, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-zinc-500">{s.label}</span></div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Revenue summary */}
        {dashboard && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-8 flex gap-6 flex-wrap">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Revenue at risk</div>
              <div className="text-xl font-semibold text-red-400">€{dashboard.total_at_risk_revenue.toLocaleString('en-IE', { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Renewal opportunity</div>
              <div className="text-xl font-semibold text-emerald-400">€{dashboard.total_renewal_opportunity.toLocaleString('en-IE', { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Active leases</div>
              <div className="text-xl font-semibold text-zinc-200">{dashboard.total_active_leases}</div>
            </div>
          </div>
        )}

        {/* Agent negotiating */}
        {negotiating.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              Agent Negotiating ({negotiating.length})
            </h2>
            <div className="space-y-3">
              {negotiating.map(l => (
                <LeaseCard key={l.lease_id} lease={l} onInitiate={setTermsTarget}
                  onFollowUp={id => { setFollowUpLoading(id); handleFollowUp(id); }} />
              ))}
            </div>
          </section>
        )}

        {/* Not started (expiring within 120 days) */}
        {notStarted.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Set Terms to Start ({notStarted.length})
              <span className="text-zinc-600 normal-case tracking-normal font-normal">— expiring within 120 days</span>
            </h2>
            <div className="space-y-3">
              {notStarted.map(l => (
                <LeaseCard key={l.lease_id} lease={l} onInitiate={setTermsTarget}
                  onFollowUp={id => handleFollowUp(id)} />
              ))}
            </div>
          </section>
        )}

        {/* Concluded: Renewed */}
        {renewed.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Renewed ({renewed.length})
            </h2>
            <div className="space-y-3">
              {renewed.map(l => (
                <LeaseCard key={l.lease_id} lease={l} onInitiate={setTermsTarget}
                  onFollowUp={id => handleFollowUp(id)} />
              ))}
            </div>
          </section>
        )}

        {/* Concluded: Failed */}
        {failed.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              Re-listing ({failed.length})
            </h2>
            <div className="space-y-3">
              {failed.map(l => (
                <LeaseCard key={l.lease_id} lease={l} onInitiate={setTermsTarget}
                  onFollowUp={id => handleFollowUp(id)} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!negotiating.length && !notStarted.length && !renewed.length && !failed.length && (
          <div className="text-center py-16 text-zinc-500">
            <Building2 className="w-10 h-10 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg font-medium text-zinc-400 mb-1">No leases need attention</p>
            <p className="text-sm">Leases expiring in the next 120 days will appear here.</p>
          </div>
        )}

      </div>

      {/* Set Terms Modal */}
      {termsTarget && (
        <SetTermsModal
          lease={termsTarget}
          onClose={() => setTermsTarget(null)}
          onSubmit={handleInitiate}
        />
      )}
    </div>
  );
}
