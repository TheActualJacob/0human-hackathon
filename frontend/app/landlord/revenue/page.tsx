'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  RefreshCw, ChevronDown, CheckCircle, AlertCircle, Info,
  DollarSign, BarChart3, Zap, Database, MapPin, Thermometer, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth/client';
import { createClient } from '@/lib/supabase/client';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Scenario {
  label: string; price: number; vacancy_risk: number;
  annual_revenue: number; net_after_vacancy?: number;
  revenue_delta: number; risk_level: 'low' | 'moderate' | 'high';
}
interface Recommendation {
  optimal_listing_price: number; recommended_renewal_increase_percent: number;
  vacancy_risk_score: number; projected_days_on_market: [number, number];
  projected_annual_revenue_delta: number; market_trend: 'tightening' | 'stable' | 'softening';
  confidence_score: number; market_percentile: number;
  reasoning_summary: string; seasonal_note?: string;
  alternative_scenarios: Scenario[];
}
interface Alert {
  alert_type: string; severity: 'info' | 'warning' | 'critical';
  title: string; body: string; revenue_impact: number;
}
interface Comp {
  rent: number; bedrooms: number; bathrooms?: number;
  sqft?: number; sqm?: number; address?: string;
  source_url?: string;
  distance_km: number; days_on_market: number;
  similarity_score: number; status?: string; data_source?: string;
}
interface ElasticityPoint {
  priceDeltaPct: number; vacancyRisk: number;
  annualRevenue: number; netAfterVacancy?: number;
}
interface MarketStats {
  median: number; mean: number; p25: number; p75: number;
  avgDom: number; stdDev?: number; currentRent: number;
  percentile: number; sampleSize?: number;
}
interface Unit {
  id: string; address?: string; unit_identifier?: string;
  city?: string; bedrooms?: number;
}
interface AnalysisMeta {
  data_source: string; data_source_key: string; geocoded: boolean;
  warning: string | null; fetched_at: string; sample_size: number;
  coverage_radius_km?: number;
  season: { adjustment: number; label: string };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt     = (n: number) => `£${Math.abs(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const fmtSign = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(n)}`;
const fmtK    = (n: number) => n >= 1000 ? `£${(Math.abs(n) / 1000).toFixed(1)}k` : fmt(n);

// ─── Colour helpers ───────────────────────────────────────────────────────────
const vacColor  = (s: number) => s >= 70 ? 'text-red-400' : s >= 50 ? 'text-orange-400' : s >= 30 ? 'text-amber-400' : 'text-emerald-400';
const vacLabel  = (s: number) => s >= 70 ? 'Severe' : s >= 50 ? 'High' : s >= 30 ? 'Moderate' : 'Low';
const trendCol  = (t?: string) => t === 'tightening' ? 'text-emerald-400' : t === 'softening' ? 'text-red-400' : 'text-amber-400';
const deltaCol  = (n: number) => n >= 0 ? 'text-emerald-400' : 'text-red-400';

// ─── Chart tooltip ────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1.5 text-[10px]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>
          {p.name}:{' '}
          {p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('net')
            ? fmtK(p.value)
            : p.name?.toLowerCase().includes('risk')
            ? `${p.value}%`
            : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Reusable card ────────────────────────────────────────────────────────────
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
    {children}
  </div>
);

const CardTitle = ({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: React.ReactNode }) => (
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
    {right && <div className="text-xs text-muted-foreground">{right}</div>}
  </div>
);

// ─── Stat pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
    <span className={cn("text-sm font-bold leading-none", valueClass ?? 'text-foreground')}>{value}</span>
  </div>
);

// ─── Risk badge ───────────────────────────────────────────────────────────────
const RiskBadge = ({ level }: { level: string }) => (
  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
    level === 'high'     ? 'bg-red-500/15 text-red-400' :
    level === 'moderate' ? 'bg-amber-500/15 text-amber-400' :
                           'bg-emerald-500/15 text-emerald-400'
  )}>
    {level.charAt(0).toUpperCase() + level.slice(1)} risk
  </span>
);

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const [units, setUnits]                   = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [landlordId, setLandlordId]         = useState<string>('');
  const [loading, setLoading]               = useState(false);
  const [initialLoad, setInitialLoad]       = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [comps, setComps]                   = useState<Comp[]>([]);
  const [elasticityCurve, setElasticityCurve] = useState<ElasticityPoint[]>([]);
  const [stats, setStats]                   = useState<MarketStats | null>(null);
  const [alerts, setAlerts]                 = useState<Alert[]>([]);
  const [history, setHistory]               = useState<any[]>([]);
  const [meta, setMeta]                     = useState<AnalysisMeta | null>(null);
  const [dismissed, setDismissed]           = useState<Set<string>>(new Set());
  const [updatingListing, setUpdatingListing] = useState(false);
  const [listingUpdated, setListingUpdated] = useState(false);

  const updateListing = useCallback(async () => {
    if (!selectedUnitId || !recommendation) return;
    setUpdatingListing(true);
    try {
      const sb = createClient();
      const p  = recommendation.optimal_listing_price;
      await sb.from('units').update({ rent_amount: p }).eq('id', selectedUnitId);
      await sb.from('leases').update({ monthly_rent: p }).eq('unit_id', selectedUnitId).eq('status', 'active');
      setListingUpdated(true);
      if (stats) setStats({ ...stats, currentRent: p });
      setTimeout(() => setListingUpdated(false), 4000);
    } catch (e) { console.error(e); } finally { setUpdatingListing(false); }
  }, [selectedUnitId, recommendation, stats]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user?.entityId) return;
      setLandlordId(user.entityId);
      const sb = createClient();
      const { data } = await sb.from('units')
        .select('id, address, unit_identifier, city, bedrooms')
        .eq('landlord_id', user.entityId).order('created_at', { ascending: false });
      const loaded = data ?? [];
      setUnits(loaded);
      if (loaded.length) setSelectedUnitId(loaded[0].id);
      setInitialLoad(false);
    })();
  }, []);

  useEffect(() => {
    if (!landlordId) return;
    fetch(`/api/revenue-intelligence/analyze?landlordId=${landlordId}`)
      .then(r => r.json()).then(d => setHistory(d.recommendations ?? []));
  }, [landlordId]);

  const runAnalysis = useCallback(async () => {
    if (!selectedUnitId || !landlordId) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch('/api/revenue-intelligence/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: selectedUnitId, landlordId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      setRecommendation(data.recommendation);
      setComps(data.comps ?? []);
      setElasticityCurve(data.elasticityCurve ?? []);
      setStats(data.stats ?? null);
      setAlerts(data.alerts ?? []);
      setMeta(data.meta ?? null);
      fetch(`/api/revenue-intelligence/analyze?landlordId=${landlordId}`)
        .then(r => r.json()).then(d => setHistory(d.recommendations ?? []));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [selectedUnitId, landlordId]);

  // Clear when unit changes
  useEffect(() => {
    setRecommendation(null); setComps([]); setElasticityCurve([]);
    setStats(null); setAlerts([]); setMeta(null);
    setListingUpdated(false); setError(null);
  }, [selectedUnitId]);

  const selectedUnit   = units.find(u => u.id === selectedUnitId);
  const confidencePct  = recommendation ? Math.round(recommendation.confidence_score * 100) : 0;
  const activeAlerts   = alerts.filter(a => !dismissed.has(a.title));

  const positioningData = [
    ...comps.map((c, i) => ({ name: `${i + 1}`, rent: c.rent, isYou: false })),
    ...(stats ? [{ name: 'You', rent: stats.currentRent, isYou: true }] : []),
  ].sort((a, b) => a.rent - b.rent);

  const histData = [...history]
    .filter(r => r.unit_id === selectedUnitId).reverse().slice(-8)
    .map((r, i) => ({ label: `#${i + 1}`, optimal: r.optimal_listing_price, current: r.current_rent }));

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (initialLoad) return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading portfolio…
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border bg-card">

        {/* Title row */}
        <div className="flex items-center justify-between px-6 py-3.5">
          <div>
            <h1 className="text-base font-semibold text-foreground">Revenue Intelligence</h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI pricing · vacancy risk · market strategy</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedUnitId}
                onChange={e => setSelectedUnitId(e.target.value)}
                className="appearance-none bg-secondary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {units.map(u => (
                  <option key={u.id} value={u.id} className="bg-card">
                    {u.unit_identifier || u.address || 'Unit'}{u.city ? ` · ${u.city}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={runAnalysis}
              disabled={loading || !selectedUnitId}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                loading
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_16px_rgba(245,158,11,0.25)]"
              )}
            >
              {loading
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
                : <><Zap className="h-3.5 w-3.5" /> Run Analysis</>}
            </button>
          </div>
        </div>

        {/* KPI strip */}
        {recommendation && stats && (
          <div className="flex items-center gap-px border-t border-border overflow-x-auto">
            {/* Optimal — highlighted */}
            <div className="flex-shrink-0 px-5 py-3 bg-amber-500/8 border-r border-amber-500/15">
              <p className="text-[10px] text-amber-500/70 font-medium uppercase tracking-wider mb-1">AI Optimal</p>
              <p className="text-xl font-bold text-amber-400 leading-none">
                {fmt(recommendation.optimal_listing_price)}
                <span className="text-sm font-normal text-amber-500/60 ml-1">/mo</span>
              </p>
            </div>

            {[
              { label: 'Current Rent', value: `${fmt(stats.currentRent)}/mo`, cls: 'text-foreground/70' },
              {
                label: 'Market Rank',
                value: `${recommendation.market_percentile}th percentile`,
                cls: recommendation.market_percentile > 75 ? 'text-red-400' : recommendation.market_percentile < 25 ? 'text-cyan-400' : 'text-emerald-400',
              },
              {
                label: 'Market Trend',
                value: recommendation.market_trend.charAt(0).toUpperCase() + recommendation.market_trend.slice(1),
                cls: trendCol(recommendation.market_trend),
              },
              {
                label: 'Vacancy Risk',
                value: `${vacLabel(recommendation.vacancy_risk_score)} · ${recommendation.vacancy_risk_score}/100`,
                cls: vacColor(recommendation.vacancy_risk_score),
              },
              {
                label: 'Annual Delta',
                value: fmtSign(recommendation.projected_annual_revenue_delta) + '/yr',
                cls: deltaCol(recommendation.projected_annual_revenue_delta),
              },
              {
                label: 'Confidence',
                value: `${confidencePct}%`,
                cls: confidencePct >= 70 ? 'text-emerald-400' : 'text-amber-400',
              },
              { label: 'Market Median', value: `${fmt(stats.median)}/mo`, cls: 'text-muted-foreground' },
              {
                label: 'Avg DOM',
                value: `${Math.round(stats.avgDom)} days`,
                cls: stats.avgDom < 12 ? 'text-emerald-400' : stats.avgDom < 25 ? 'text-amber-400' : 'text-red-400',
              },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex-shrink-0 px-5 py-3 border-r border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
                <p className={cn("text-sm font-semibold leading-none", cls)}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Meta row */}
        {meta && (
          <div className="flex items-center gap-4 px-6 py-2 border-t border-border/50 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-500/70">
              <Database className="h-3 w-3" />
              {meta.data_source}
            </span>
            {meta.geocoded && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {meta.sample_size} comps · {meta.coverage_radius_km ?? 10}km radius
              </span>
            )}
            {meta.season && (
              <span className={cn("inline-flex items-center gap-1.5 text-[11px]",
                meta.season.adjustment > 5 ? 'text-orange-400/70' : meta.season.adjustment < -4 ? 'text-emerald-500/60' : 'text-muted-foreground/60'
              )}>
                <Thermometer className="h-3 w-3" />
                {meta.season.label} · {meta.season.adjustment > 0 ? '+' : ''}{meta.season.adjustment}% vacancy
              </span>
            )}
            {meta.fetched_at && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 ml-auto">
                <Clock className="h-3 w-3" />
                {new Date(meta.fetched_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {meta.warning && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-500/60">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {meta.warning.length > 80 ? meta.warning.slice(0, 80) + '…' : meta.warning}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && !recommendation && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Brain className="h-8 w-8 text-amber-400 mx-auto animate-pulse" />
            <div>
              <p className="text-sm font-medium text-foreground/70">Analyzing market data…</p>
              <p className="text-xs text-muted-foreground mt-1">Fetching Numbeo · modeling vacancy risk · generating strategy</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ready state ──────────────────────────────────────────────────── */}
      {!recommendation && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <BarChart3 className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Ready to analyze</p>
              {selectedUnit && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedUnit.unit_identifier || selectedUnit.address}
                  {selectedUnit.city ? ` · ${selectedUnit.city}` : ''}
                  {selectedUnit.bedrooms ? ` · ${selectedUnit.bedrooms} bed` : ''}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Pulls live Numbeo market data, models vacancy risk, and generates a Claude-powered pricing strategy for this property.
            </p>
            <button
              onClick={runAnalysis}
              disabled={!selectedUnitId}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground text-black text-sm font-semibold rounded-xl transition-all"
            >
              <Zap className="h-4 w-4" /> Run Analysis
            </button>
          </div>
        </div>
      )}

      {/* ══ DASHBOARD ════════════════════════════════════════════════════════ */}
      {recommendation && stats && !loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 grid grid-cols-12 gap-4">

            {/* ── Left: charts (8 cols) ──────────────────────────────────── */}
            <div className="col-span-8 space-y-4">

              {/* Market Positioning */}
              <Card>
                <CardTitle
                  sub="Your unit vs comparable listings, sorted by price"
                  right={`${comps.length} comps`}
                >
                  Market Positioning
                </CardTitle>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={positioningData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 6" stroke="oklch(0.5 0 0 / 0.1)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={stats.median} stroke="#f59e0b" strokeDasharray="4 6" strokeWidth={1}
                      label={{ value: `Median ${fmt(stats.median)}`, position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                    <Bar dataKey="rent" name="Monthly Rent" radius={[3, 3, 0, 0]}>
                      {positioningData.map((entry, i) => (
                        <rect key={i} fill={entry.isYou ? '#f59e0b' : 'oklch(0.5 0 0 / 0.2)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border">
                  {[
                    { label: 'P25',       val: fmt(stats.p25),                             cls: 'text-muted-foreground' },
                    { label: 'Median',    val: fmt(stats.median),                          cls: 'text-amber-400' },
                    { label: 'P75',       val: fmt(stats.p75),                             cls: 'text-muted-foreground' },
                    { label: 'Your Rent', val: fmt(stats.currentRent),                     cls: 'text-foreground' },
                    { label: 'AI Target', val: fmt(recommendation.optimal_listing_price),  cls: 'text-emerald-400' },
                  ].map(({ label, val, cls }) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground/70 font-medium">{label}</p>
                      <p className={cn("text-xs font-bold mt-0.5", cls)}>{val}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Elasticity + Scenario — side by side */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardTitle sub="Vacancy risk vs revenue at different prices">
                    Price Elasticity
                  </CardTitle>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={elasticityCurve} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="oklch(0.5 0 0 / 0.1)" vertical={false} />
                      <XAxis dataKey="priceDeltaPct" tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                        tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="l" tickFormatter={v => `${v}%`} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="r" orientation="right" tickFormatter={fmtK} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine yAxisId="l" x={0} stroke="oklch(0.5 0 0 / 0.15)" />
                      <Line yAxisId="l" type="monotone" dataKey="vacancyRisk" name="Vacancy Risk" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line yAxisId="r" type="monotone" dataKey="netAfterVacancy" name="Net Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <CardTitle sub="Net annual revenue by pricing strategy">
                    Scenario Revenue
                  </CardTitle>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={recommendation.alternative_scenarios.map(s => ({
                        label: s.label.split(':')[0].slice(0, 14),
                        net: s.net_after_vacancy ?? s.annual_revenue,
                      }))}
                      margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="2 6" stroke="oklch(0.5 0 0 / 0.1)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="net" name="Net Revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* History */}
              {histData.length > 1 && (
                <Card>
                  <CardTitle sub="AI optimal price vs your current rent over time" right={`${histData.length} analyses`}>
                    Recommendation History
                  </CardTitle>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={histData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="oklch(0.5 0 0 / 0.1)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="optimal" name="AI Optimal" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                      <Line type="monotone" dataKey="current" name="Current Rent" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Comparables table */}
              <Card>
                <CardTitle right={
                  <span className="flex items-center gap-2">
                    {(() => {
                      const LIVE = ['Spitogatos','xe.gr','Rentola','Findallrentals','Kugli','Craigslist','OpenRent','HousingAnywhere','Blueground'];
                      const liveCount = comps.filter(c => LIVE.some(s => (c as any).data_source?.includes(s))).length;
                      const synthCount = comps.filter(c => (c as any).data_source?.includes('Numbeo')).length;
                      if (liveCount > 0 && synthCount > 0) return (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/80 text-[9px] font-semibold uppercase tracking-wider border border-blue-500/20">
                          ◑ {liveCount} live + {synthCount} est.
                        </span>
                      );
                      if (liveCount > 0) return (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold uppercase tracking-wider border border-emerald-500/20">
                          ● {liveCount} live listings
                        </span>
                      );
                      return (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 text-[9px] font-semibold uppercase tracking-wider border border-amber-500/20">
                          ◌ Market estimates
                        </span>
                      );
                    })()}
                    <span className="text-muted-foreground/70">{comps.length} comps · sorted by match</span>
                  </span>
                }>
                  Comparable Listings
                </CardTitle>
                {comps.some(c => (c as any).data_source?.includes('Numbeo')) && (
                  <div className="mx-0 mb-3 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-amber-400/70 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {comps.some(c => ['Spitogatos','xe.gr','Rentola','Findallrentals','Kugli','Craigslist','OpenRent','HousingAnywhere','Blueground'].some(s => (c as any).data_source?.includes(s)))
                        ? <>Live listings supplemented with <span className="text-amber-400/80">Numbeo market estimates</span> (amber <span className="text-amber-400/80">Est</span> badge) to give Claude enough data for accurate recommendations.</>
                        : <>No live listings found. Showing <span className="text-amber-400/80">Numbeo market estimates</span> — statistically modelled from community price data. <span className="text-muted-foreground/70">Click any row to view source.</span></>
                      }
                    </p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {['Area / Source', 'Rent', 'Beds · Baths', 'Size', 'Dist', 'DOM', 'Match'].map(h => (
                          <th key={h} className="text-left pb-2.5 pr-4 text-[10px] text-muted-foreground font-medium uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...comps].sort((a, b) => b.similarity_score - a.similarity_score).map((c, i) => {
                        const sqm       = (c as any).sqm ?? (c.sqft ? Math.round(c.sqft / 10.764) : null);
                        const addr      = (c as any).address ?? '—';
                        const sourceUrl = (c as any).source_url as string | undefined;
                        const src       = (c as any).data_source as string | undefined;
                        const LIVE_SOURCES = ['Spitogatos','xe.gr','Rentola','Findallrentals','Kugli','Craigslist','OpenRent','HousingAnywhere','Blueground'];
                        const isLive    = LIVE_SOURCES.some(s => src?.includes(s));
                        const srcLabel  = src?.includes('Spitogatos') ? 'SG' : src?.includes('xe.gr') ? 'XE' : src?.includes('Rentola') ? 'RT' : src?.includes('Findallrentals') ? 'FA' : src?.includes('Kugli') ? 'KG' : src?.includes('Craigslist') ? 'CL' : src?.includes('OpenRent') ? 'OR' : src?.includes('HousingAnywhere') ? 'HA' : src?.includes('Blueground') ? 'BG' : 'Est';
                        const srcColor  = isLive ? 'text-emerald-400/60 border-emerald-500/20 bg-emerald-500/5' : 'text-muted-foreground/60 border-border bg-muted/40';
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 pr-4 max-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-[8px] font-semibold px-1 py-0.5 rounded border flex-shrink-0", srcColor)}>
                                  {srcLabel}
                                </span>
                                {sourceUrl ? (
                                  <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={isLive ? `View real listing: ${addr} ↗` : `View market data source for ${addr} ↗`}
                                    className="truncate text-muted-foreground hover:text-amber-400 underline decoration-dotted underline-offset-2 decoration-border hover:decoration-amber-400/50 transition-colors cursor-pointer"
                                  >
                                    {addr.length > 24 ? addr.slice(0, 24) + '…' : addr}
                                    <span className="ml-0.5 text-[9px] text-muted-foreground/50">↗</span>
                                  </a>
                                ) : (
                                  <span className="truncate text-muted-foreground" title={addr}>
                                    {addr.length > 24 ? addr.slice(0, 24) + '…' : addr}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 font-semibold text-foreground whitespace-nowrap">
                              {fmt(c.rent)}<span className="text-muted-foreground font-normal">/mo</span>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                              {c.bedrooms ?? '?'}bd{c.bathrooms != null ? ` · ${c.bathrooms}ba` : ''}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{sqm ? `${sqm} m²` : '—'}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{c.distance_km} km</td>
                            <td className={cn("py-2.5 pr-4 whitespace-nowrap font-medium", c.days_on_market === 0 ? 'text-emerald-400' : 'text-muted-foreground')}>
                              {c.days_on_market === 0 ? 'New' : `${c.days_on_market}d`}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", c.similarity_score >= 80 ? 'bg-emerald-500' : c.similarity_score >= 60 ? 'bg-amber-500' : 'bg-muted-foreground/30')}
                                    style={{ width: `${c.similarity_score}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground/70 w-4 text-right">{c.similarity_score}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* ── Right: intelligence panel (4 cols) ───────────────────── */}
            <div className="col-span-4 space-y-4">

              {/* AI Strategy */}
              <Card className="border-amber-500/15 bg-amber-500/[0.03]">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold">AI Strategy</h3>
                  <span className={cn("ml-auto text-xs font-medium px-2 py-0.5 rounded-full",
                    confidencePct >= 70 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                  )}>
                    {confidencePct}% confidence
                  </span>
                </div>

                {/* Recommended price */}
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 mb-4">
                  <p className="text-[10px] text-amber-500/60 font-medium uppercase tracking-wider mb-1">Recommended Listing Price</p>
                  <p className="text-2xl font-bold text-amber-400 leading-none">
                    {fmt(recommendation.optimal_listing_price)}
                    <span className="text-base font-normal text-amber-500/50 ml-1">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    +{recommendation.recommended_renewal_increase_percent}% renewal · {recommendation.projected_days_on_market[0]}–{recommendation.projected_days_on_market[1]} days to let
                  </p>
                </div>

                {/* Reasoning */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-4 pl-3 border-l-2 border-border">
                  {recommendation.reasoning_summary}
                </p>

                {/* 2×2 metrics */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: 'Revenue Delta', val: fmtSign(recommendation.projected_annual_revenue_delta) + '/yr', cls: deltaCol(recommendation.projected_annual_revenue_delta) },
                    { label: 'Confidence',    val: `${confidencePct}%`,                                            cls: confidencePct >= 70 ? 'text-emerald-400' : 'text-amber-400' },
                    { label: 'Vacancy Risk',  val: `${recommendation.vacancy_risk_score}/100`,                     cls: vacColor(recommendation.vacancy_risk_score) },
                    { label: 'Market',        val: recommendation.market_trend.charAt(0).toUpperCase() + recommendation.market_trend.slice(1), cls: trendCol(recommendation.market_trend) },
                  ].map(({ label, val, cls }) => (
                    <div key={label} className="rounded-lg bg-muted/50 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground/70 font-medium mb-1">{label}</p>
                      <p className={cn("text-sm font-bold leading-none", cls)}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Confidence bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-muted-foreground/70 mb-1.5">
                    <span>Model confidence</span><span>{confidencePct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div
                      className={cn("h-full rounded-full transition-all", confidencePct >= 75 ? 'bg-emerald-500' : confidencePct >= 50 ? 'bg-amber-500' : 'bg-orange-500')}
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                </div>

                {/* Apply button */}
                {listingUpdated ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-emerald-400 font-medium">
                      Updated to {fmt(recommendation.optimal_listing_price)}/mo
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={updateListing}
                    disabled={updatingListing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground text-black text-sm font-semibold transition-all"
                  >
                    {updatingListing
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Updating…</>
                      : <><DollarSign className="h-3.5 w-3.5" /> Apply {fmt(recommendation.optimal_listing_price)}/mo</>}
                  </button>
                )}
              </Card>

              {/* Alerts */}
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold">Alerts</h3>
                  {activeAlerts.length > 0 && (
                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                      {activeAlerts.length}
                    </span>
                  )}
                </div>
                {activeAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-400/70">
                    <CheckCircle className="h-4 w-4" />
                    No active alerts
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeAlerts.map((alert, i) => (
                      <div key={i} className={cn("rounded-xl border p-3 relative",
                        alert.severity === 'critical' ? 'border-red-500/20 bg-red-500/[0.04]' :
                        alert.severity === 'warning'  ? 'border-amber-500/20 bg-amber-500/[0.04]' :
                                                        'border-cyan-500/20 bg-cyan-500/[0.04]'
                      )}>
                        <div className="flex items-start gap-2">
                          {alert.severity === 'critical'
                            ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                            : alert.severity === 'warning'
                            ? <AlertCircle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                            : <Info className="h-3.5 w-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />}
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-xs font-semibold text-foreground/80">{alert.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{alert.body}</p>
                            {alert.revenue_impact !== 0 && (
                              <p className={cn("text-[11px] font-semibold mt-1", deltaCol(alert.revenue_impact))}>
                                {fmtSign(alert.revenue_impact)}/yr
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => setDismissed(p => new Set([...p, alert.title]))}
                            className="absolute top-2.5 right-2.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground"
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Scenarios */}
              <Card>
                <CardTitle>Strategy Scenarios</CardTitle>
                <div className="space-y-2">
                  {recommendation.alternative_scenarios.map((s, i) => (
                    <div key={i} className={cn("rounded-xl border p-3",
                      s.risk_level === 'high'     ? 'border-red-500/15 bg-red-500/[0.03]' :
                      s.risk_level === 'moderate' ? 'border-amber-500/15 bg-amber-500/[0.03]' :
                                                    'border-emerald-500/15 bg-emerald-500/[0.03]'
                    )}>
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-xs font-semibold text-foreground/80">{s.label}</p>
                        <RiskBadge level={s.risk_level} />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Price',   val: fmt(s.price),                                  cls: 'text-foreground/70' },
                          { label: 'Vacancy', val: `${s.vacancy_risk}%`,                          cls: vacColor(s.vacancy_risk) },
                          { label: 'Net/yr',  val: fmtK(s.net_after_vacancy ?? s.annual_revenue), cls: 'text-foreground/70' },
                        ].map(({ label, val, cls }) => (
                          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
                            <p className="text-[9px] text-muted-foreground/60 font-medium mb-0.5">{label}</p>
                            <p className={cn("text-xs font-bold", cls)}>{val}</p>
                          </div>
                        ))}
                      </div>
                      {s.revenue_delta !== 0 && (
                        <p className={cn("text-[11px] font-medium mt-2", deltaCol(s.revenue_delta))}>
                          {fmtSign(s.revenue_delta)}/yr vs current
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Market stats */}
              <Card>
                <CardTitle>Market Statistics</CardTitle>
                <div className="space-y-0 divide-y divide-border">
                  {[
                    { label: 'Median Rent',    val: fmt(stats.median) + '/mo' },
                    { label: 'Market Average', val: fmt(Math.round(stats.mean)) + '/mo' },
                    { label: 'P25',            val: fmt(stats.p25) + '/mo' },
                    { label: 'P75',            val: fmt(stats.p75) + '/mo' },
                    { label: 'Avg Days on Market', val: `${Math.round(stats.avgDom)} days` },
                    { label: 'Price Std Dev',  val: `±${fmt(Math.round(stats.stdDev ?? 0))}` },
                    { label: 'Sample Size',    val: `${comps.length} properties` },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between items-center py-2">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-semibold text-foreground/70">{val}</span>
                    </div>
                  ))}
                </div>
                {recommendation.seasonal_note && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-amber-500/60 font-medium">Seasonal note: </span>
                      {recommendation.seasonal_note}
                    </p>
                  </div>
                )}
              </Card>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
