'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
  AlertTriangle, Brain, RefreshCw, Plus, Trash2, Edit3,
  ChevronDown, ChevronUp, Zap, Shield, TrendingUp, TrendingDown,
  Minus, Clock, DollarSign, Activity, CheckCircle, XCircle,
  Save, X, BarChart3, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth/client';
import { createClient } from '@/lib/supabase/client';
import { format, differenceInYears, parseISO } from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Unit {
  id: string;
  unit_identifier: string;
  address: string;
  city?: string;
}

interface PmAsset {
  id: string;
  unit_id: string;
  landlord_id: string;
  asset_name: string;
  asset_type: string;
  brand?: string;
  model?: string;
  installation_year?: number;
  warranty_expiry?: string;
  environment_context: string;
  usage_intensity: string;
  last_service_date?: string;
  expected_lifespan_years?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface PmMaintenanceEvent {
  id: string;
  asset_id: string;
  event_date: string;
  issue_description: string;
  severity: string;
  cost?: number;
  resolution_time_days?: number;
  vendor_notes?: string;
  tenant_complaint_text?: string;
  resolved: boolean;
  created_at: string;
}

interface PmPrediction {
  id: string;
  asset_id: string;
  generated_at: string;
  failure_probability_6_months?: number;
  failure_probability_12_months?: number;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  preventative_replacement_recommended?: boolean;
  urgency_level?: string;
  risk_drivers?: string[];
  projected_financial_exposure?: number;
  confidence_score?: number;
  reasoning_summary?: string;
}

type Tab = 'registry' | 'analysis' | 'portfolio';

// ─── Constants ────────────────────────────────────────────────────────────────
const ASSET_TYPES = [
  { value: 'boiler', label: 'Boiler / Water Heater' },
  { value: 'hvac', label: 'HVAC / Air Conditioning' },
  { value: 'electrical', label: 'Electrical System' },
  { value: 'plumbing', label: 'Plumbing / Pipes' },
  { value: 'roof', label: 'Roof / Waterproofing' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'dishwasher', label: 'Dishwasher' },
  { value: 'refrigerator', label: 'Refrigerator' },
  { value: 'oven', label: 'Oven / Hob' },
  { value: 'elevator', label: 'Elevator / Lift' },
  { value: 'intercom', label: 'Intercom / Entry' },
  { value: 'windows', label: 'Windows / Glazing' },
  { value: 'water_heater', label: 'Water Heater' },
  { value: 'other', label: 'Other' },
];

const ENVIRONMENT_OPTIONS = [
  { value: 'urban', label: 'Urban' },
  { value: 'coastal', label: 'Coastal (+35% risk)' },
  { value: 'humid', label: 'Humid (+25% risk)' },
  { value: 'rural', label: 'Rural (-10% risk)' },
  { value: 'dry', label: 'Dry (-15% risk)' },
];

const USAGE_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High (+30% wear)' },
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const LIFESPAN_DEFAULTS: Record<string, number> = {
  boiler: 15, hvac: 15, plumbing: 30, electrical: 25, roof: 20,
  washing_machine: 10, dishwasher: 10, refrigerator: 12, oven: 15,
  elevator: 25, intercom: 15, windows: 20, water_heater: 12, other: 15,
};

const URGENCY_COLORS: Record<string, string> = {
  low: 'text-green-400 bg-green-400/10 border-green-400/20',
  moderate: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

// ─── Helper Components ────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; accent?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', accent ?? 'border-border')}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function UrgencyBadge({ level }: { level?: string }) {
  if (!level) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border', URGENCY_COLORS[level] ?? '')}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function ProbabilityBar({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-orange-500' : pct >= 20 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8">{pct}%</span>
    </div>
  );
}

// ─── Empty Asset Form Template ─────────────────────────────────────────────────
function emptyAsset(unitId: string, landlordId: string): Partial<PmAsset> {
  return {
    unit_id: unitId,
    landlord_id: landlordId,
    asset_name: '',
    asset_type: 'boiler',
    brand: '',
    model: '',
    installation_year: undefined,
    warranty_expiry: '',
    environment_context: 'urban',
    usage_intensity: 'medium',
    last_service_date: '',
    expected_lifespan_years: undefined,
    notes: '',
  };
}

function emptyEvent(assetId: string): Partial<PmMaintenanceEvent> {
  return {
    asset_id: assetId,
    event_date: format(new Date(), 'yyyy-MM-dd'),
    issue_description: '',
    severity: 'medium',
    cost: undefined,
    resolution_time_days: undefined,
    vendor_notes: '',
    tenant_complaint_text: '',
    resolved: true,
  };
}

// ─── Asset Form Modal ─────────────────────────────────────────────────────────
function AssetFormModal({
  asset, onSave, onClose,
}: {
  asset: Partial<PmAsset>;
  onSave: (a: Partial<PmAsset>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<PmAsset>>(asset);
  const set = (key: keyof PmAsset, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-base">{asset.id ? 'Edit Asset' : 'Add Asset'}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Asset Name *</label>
            <input
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.asset_name ?? ''}
              onChange={e => set('asset_name', e.target.value)}
              placeholder="e.g. Main Boiler, Kitchen Dishwasher"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Asset Type *</label>
            <select
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.asset_type ?? 'boiler'}
              onChange={e => {
                set('asset_type', e.target.value);
                if (!form.expected_lifespan_years) {
                  set('expected_lifespan_years', LIFESPAN_DEFAULTS[e.target.value] ?? 15);
                }
              }}
            >
              {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Installation Year</label>
            <input
              type="number" min={1950} max={new Date().getFullYear()}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.installation_year ?? ''}
              onChange={e => set('installation_year', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 2015"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Brand</label>
            <input
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.brand ?? ''}
              onChange={e => set('brand', e.target.value)}
              placeholder="e.g. Vaillant"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Model</label>
            <input
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.model ?? ''}
              onChange={e => set('model', e.target.value)}
              placeholder="e.g. ecoTEC Pro 28"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Last Service Date</label>
            <input
              type="date"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.last_service_date ?? ''}
              onChange={e => set('last_service_date', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Warranty Expiry</label>
            <input
              type="date"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.warranty_expiry ?? ''}
              onChange={e => set('warranty_expiry', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Expected Lifespan (years)</label>
            <input
              type="number" min={1} max={50}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.expected_lifespan_years ?? ''}
              onChange={e => set('expected_lifespan_years', e.target.value ? Number(e.target.value) : undefined)}
              placeholder={String(LIFESPAN_DEFAULTS[form.asset_type ?? 'other'] ?? 15)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Environment</label>
            <select
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.environment_context ?? 'urban'}
              onChange={e => set('environment_context', e.target.value)}
            >
              {ENVIRONMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Usage Intensity</label>
            <select
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.usage_intensity ?? 'medium'}
              onChange={e => set('usage_intensity', e.target.value)}
            >
              {USAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea
              rows={2}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm resize-none"
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional context..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-border hover:bg-muted"
          >Cancel</button>
          <button
            onClick={() => { if (form.asset_name) onSave(form); }}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" /> Save Asset
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Form Modal ─────────────────────────────────────────────────────────
function EventFormModal({
  event, assetName, onSave, onClose,
}: {
  event: Partial<PmMaintenanceEvent>;
  assetName: string;
  onSave: (e: Partial<PmMaintenanceEvent>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<PmMaintenanceEvent>>(event);
  const set = (key: keyof PmMaintenanceEvent, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-base">{event.id ? 'Edit Event' : 'Log Repair Event'}</h3>
            <p className="text-xs text-muted-foreground">{assetName}</p>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date *</label>
            <input
              type="date"
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.event_date ?? ''}
              onChange={e => set('event_date', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
            <select
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.severity ?? 'medium'}
              onChange={e => set('severity', e.target.value)}
            >
              {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Issue Description *</label>
            <textarea
              rows={2}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm resize-none"
              value={form.issue_description ?? ''}
              onChange={e => set('issue_description', e.target.value)}
              placeholder="Describe the issue..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cost (€)</label>
            <input
              type="number" min={0}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.cost ?? ''}
              onChange={e => set('cost', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Resolution Days</label>
            <input
              type="number" min={0}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.resolution_time_days ?? ''}
              onChange={e => set('resolution_time_days', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="1"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Vendor Notes</label>
            <input
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.vendor_notes ?? ''}
              onChange={e => set('vendor_notes', e.target.value)}
              placeholder="Notes from contractor..."
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Tenant Complaint Text (if applicable)</label>
            <input
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm"
              value={form.tenant_complaint_text ?? ''}
              onChange={e => set('tenant_complaint_text', e.target.value)}
              placeholder="Original complaint from tenant..."
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="resolved"
              checked={form.resolved ?? true}
              onChange={e => set('resolved', e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="resolved" className="text-sm">Resolved</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-border hover:bg-muted">Cancel</button>
          <button
            onClick={() => { if (form.event_date && form.issue_description) onSave(form); }}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" /> Save Event
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PredictiveMaintenancePage() {
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [assets, setAssets] = useState<PmAsset[]>([]);
  const [events, setEvents] = useState<PmMaintenanceEvent[]>([]);
  const [predictions, setPredictions] = useState<PmPrediction[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('registry');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modals
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<PmAsset> | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<PmMaintenanceEvent> | null>(null);
  const [eventAssetId, setEventAssetId] = useState<string>('');

  // UI state
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [expandedPredictions, setExpandedPredictions] = useState<Set<string>>(new Set());

  // Memoize client — createClient() must not run on every render
  const supabase = useMemo(() => createClient(), []);

  // ─── Load Data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (lid: string) => {
    setLoading(true);
    try {
      const [unitsRes, assetsRes] = await Promise.all([
        supabase.from('units').select('id, unit_identifier, address, city').eq('landlord_id', lid),
        supabase.from('pm_assets').select('*').eq('landlord_id', lid).order('created_at', { ascending: false }),
      ]);

      const loadedUnits: Unit[] = unitsRes.data ?? [];
      const loadedAssets: PmAsset[] = assetsRes.data ?? [];

      setUnits(loadedUnits);
      setAssets(loadedAssets);
      // Functional update avoids needing selectedUnitId in deps
      if (loadedUnits.length > 0) {
        setSelectedUnitId(prev => prev || loadedUnits[0].id);
      }

      if (loadedAssets.length > 0) {
        const assetIds = loadedAssets.map(a => a.id);
        const [eventsRes, predsRes] = await Promise.all([
          supabase.from('pm_maintenance_events').select('*').in('asset_id', assetIds).order('event_date', { ascending: false }),
          supabase.from('pm_predictions').select('*').in('asset_id', assetIds).order('generated_at', { ascending: false }),
        ]);
        setEvents(eventsRes.data ?? []);
        // Keep only the latest prediction per asset
        const seenAssets = new Set<string>();
        const latestPreds: PmPrediction[] = [];
        for (const p of (predsRes.data ?? [])) {
          if (!seenAssets.has(p.asset_id)) {
            seenAssets.add(p.asset_id);
            latestPreds.push(p);
          }
        }
        setPredictions(latestPreds);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user?.entityId) {
        setLandlordId(user.entityId);
        loadAll(user.entityId);
      }
    });
  }, []);

  // ─── CRUD: Assets ───────────────────────────────────────────────────────────
  const handleSaveAsset = async (form: Partial<PmAsset>) => {
    if (!landlordId || !selectedUnitId) return;
    setSaveError(null);

    // Empty strings must become null for DATE/numeric columns or Supabase rejects the insert
    const nullify = (v: unknown) => (v === '' || v === undefined ? null : v);

    const payload: Record<string, unknown> = {
      unit_id: selectedUnitId,
      landlord_id: landlordId,
      asset_name: form.asset_name,
      asset_type: form.asset_type ?? 'other',
      brand: nullify(form.brand),
      model: nullify(form.model),
      installation_year: nullify(form.installation_year),
      warranty_expiry: nullify(form.warranty_expiry),
      environment_context: form.environment_context ?? 'urban',
      usage_intensity: form.usage_intensity ?? 'medium',
      last_service_date: nullify(form.last_service_date),
      expected_lifespan_years: nullify(form.expected_lifespan_years),
      notes: nullify(form.notes),
    };

    if (form.id) {
      const { error } = await supabase.from('pm_assets').update(payload).eq('id', form.id);
      if (error) { setSaveError(error.message); return; }
      setAssets(prev => prev.map(a => (a.id === form.id ? { ...a, ...payload, id: form.id } as PmAsset : a)));
    } else {
      const { data, error } = await supabase.from('pm_assets').insert(payload).select().single();
      if (error) { setSaveError(error.message); return; }
      if (data) setAssets(prev => [data as PmAsset, ...prev]);
    }
    setShowAssetModal(false);
    setEditingAsset(null);
  };

  const handleDeleteAsset = async (id: string) => {
    await supabase.from('pm_assets').delete().eq('id', id);
    setAssets(prev => prev.filter(a => a.id !== id));
    setEvents(prev => prev.filter(e => e.asset_id !== id));
    setPredictions(prev => prev.filter(p => p.asset_id !== id));
  };

  // ─── CRUD: Events ───────────────────────────────────────────────────────────
  const handleSaveEvent = async (form: Partial<PmMaintenanceEvent>) => {
    setSaveError(null);
    const nullify = (v: unknown) => (v === '' || v === undefined ? null : v);

    const payload: Record<string, unknown> = {
      asset_id: form.asset_id,
      event_date: form.event_date,
      issue_description: form.issue_description,
      severity: form.severity ?? 'medium',
      cost: nullify(form.cost),
      resolution_time_days: nullify(form.resolution_time_days),
      vendor_notes: nullify(form.vendor_notes),
      tenant_complaint_text: nullify(form.tenant_complaint_text),
      resolved: form.resolved ?? true,
    };

    if (form.id) {
      const { error } = await supabase.from('pm_maintenance_events').update(payload).eq('id', form.id);
      if (error) { setSaveError(error.message); return; }
      setEvents(prev => prev.map(e => (e.id === form.id ? { ...e, ...payload, id: form.id } as PmMaintenanceEvent : e)));
    } else {
      const { data, error } = await supabase.from('pm_maintenance_events').insert(payload).select().single();
      if (error) { setSaveError(error.message); return; }
      if (data) setEvents(prev => [data as PmMaintenanceEvent, ...prev]);
    }
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (id: string) => {
    await supabase.from('pm_maintenance_events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // ─── Run Analysis ───────────────────────────────────────────────────────────
  const handleRunAnalysis = async () => {
    if (!landlordId) return;
    const unitAssets = selectedUnitId
      ? assets.filter(a => a.unit_id === selectedUnitId)
      : assets;

    if (unitAssets.length === 0) {
      setAnalyzeError('No assets to analyse. Add assets first.');
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);

    const payload = {
      landlord_id: landlordId,
      unit_id: selectedUnitId || undefined,
      assets: unitAssets.map(a => ({
        ...a,
        maintenance_events: events.filter(e => e.asset_id === a.id),
      })),
    };

    try {
      const res = await fetch('/api/predictive-maintenance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');

      const newPreds: PmPrediction[] = data.predictions.map((p: PmPrediction & { generated_at?: string }) => ({
        ...p,
        id: crypto.randomUUID(),
        generated_at: new Date().toISOString(),
      }));

      setPredictions(prev => {
        const analysedIds = new Set(newPreds.map(p => p.asset_id));
        return [...newPreds, ...prev.filter(p => !analysedIds.has(p.asset_id))];
      });

      setActiveTab('analysis');
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Computed Metrics (memoized — not recalculated on every render) ──────────
  const portfolioExposure = useMemo(
    () => predictions.reduce((s, p) => s + (p.projected_financial_exposure ?? 0), 0),
    [predictions]
  );

  const highRiskCount = useMemo(
    () => predictions.filter(p => p.urgency_level === 'high' || p.urgency_level === 'critical').length,
    [predictions]
  );

  const avgRiskScore = useMemo(
    () => predictions.length > 0
      ? Math.round(predictions.reduce((s, p) => s + (p.failure_probability_12_months ?? 0), 0) / predictions.length * 100)
      : 0,
    [predictions]
  );

  const unitAssets = useMemo(
    () => assets.filter(a => a.unit_id === selectedUnitId),
    [assets, selectedUnitId]
  );

  const selectedUnit = useMemo(
    () => units.find(u => u.id === selectedUnitId),
    [units, selectedUnitId]
  );

  const riskByCategory = useMemo(
    () => ASSET_TYPES.map(t => {
      const categoryPreds = predictions.filter(p => {
        const asset = assets.find(a => a.id === p.asset_id);
        return asset?.asset_type === t.value;
      });
      if (categoryPreds.length === 0) return null;
      return {
        name: t.label.split(' ')[0],
        risk: Math.round(categoryPreds.reduce((s, p) => s + (p.failure_probability_12_months ?? 0), 0) / categoryPreds.length * 100),
        exposure: Math.round(categoryPreds.reduce((s, p) => s + (p.projected_financial_exposure ?? 0), 0)),
      };
    }).filter(Boolean) as Array<{ name: string; risk: number; exposure: number }>,
    [predictions, assets]
  );

  const topRiskAssets = useMemo(
    () => [...predictions]
      .sort((a, b) => (b.failure_probability_12_months ?? 0) - (a.failure_probability_12_months ?? 0))
      .slice(0, 5)
      .map(p => {
        const asset = assets.find(a => a.id === p.asset_id);
        const unit = units.find(u => u.id === asset?.unit_id);
        return { ...p, asset, unit };
      }),
    [predictions, assets, units]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-6 w-6 animate-spin text-primary mr-3" />
        <span className="text-muted-foreground">Loading predictive maintenance system…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Predictive Maintenance
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Forward-looking asset risk intelligence · Claude-powered
          </p>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={analyzing || assets.length === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            analyzing
              ? 'bg-primary/50 text-primary-foreground cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {analyzing
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analysing…</>
            : <><Zap className="h-4 w-4" /> Run Analysis</>}
        </button>
      </div>

      {analyzeError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {analyzeError}
        </div>
      )}

      {saveError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Save failed: {saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── KPI Summary ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Portfolio Risk Score"
          value={`${avgRiskScore}/100`}
          sub={avgRiskScore >= 70 ? 'Critical exposure' : avgRiskScore >= 40 ? 'Elevated risk' : 'Manageable risk'}
          icon={Activity}
          accent={avgRiskScore >= 70 ? 'border-red-500/50' : avgRiskScore >= 40 ? 'border-orange-500/50' : 'border-green-500/30'}
        />
        <KpiCard
          label="12-Month Exposure"
          value={`€${portfolioExposure.toLocaleString()}`}
          sub={`${predictions.length} assets tracked`}
          icon={DollarSign}
        />
        <KpiCard
          label="High-Risk Assets"
          value={String(highRiskCount)}
          sub={`of ${predictions.length} analysed`}
          icon={AlertTriangle}
          accent={highRiskCount > 0 ? 'border-orange-500/50' : 'border-border'}
        />
        <KpiCard
          label="Assets Registered"
          value={String(assets.length)}
          sub={`${units.length} properties`}
          icon={Shield}
        />
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────── */}
      <div className="border-b border-border flex gap-0">
        {([
          { id: 'registry', label: 'Asset Registry' },
          { id: 'analysis', label: 'Analysis Results' },
          { id: 'portfolio', label: 'Portfolio Intelligence' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-all',
              activeTab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB: ASSET REGISTRY
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Property selector + Add button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Property:</label>
              <select
                className="bg-muted border border-border rounded px-3 py-1.5 text-sm"
                value={selectedUnitId}
                onChange={e => setSelectedUnitId(e.target.value)}
              >
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.unit_identifier} — {u.address}
                  </option>
                ))}
              </select>
              {units.length === 0 && (
                <span className="text-xs text-muted-foreground">No properties found</span>
              )}
            </div>
            <button
              onClick={() => {
                if (!landlordId || !selectedUnitId) return;
                setEditingAsset(emptyAsset(selectedUnitId, landlordId));
                setShowAssetModal(true);
              }}
              disabled={!selectedUnitId}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add Asset
            </button>
          </div>

          {/* Asset table */}
          {unitAssets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium mb-1">No assets registered for this property</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add appliances, systems, and infrastructure to enable predictive risk analysis.
              </p>
              <button
                onClick={() => {
                  if (!landlordId || !selectedUnitId) return;
                  setEditingAsset(emptyAsset(selectedUnitId, landlordId));
                  setShowAssetModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 mx-auto"
              >
                <Plus className="h-4 w-4" /> Add First Asset
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Asset</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Age / Lifespan</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Last Service</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Environment</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Events</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Urgency</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {unitAssets.map(asset => {
                    const assetEvents = events.filter(e => e.asset_id === asset.id);
                    const prediction = predictions.find(p => p.asset_id === asset.id);
                    const age = asset.installation_year
                      ? new Date().getFullYear() - asset.installation_year
                      : null;
                    const lifespan = asset.expected_lifespan_years ?? LIFESPAN_DEFAULTS[asset.asset_type] ?? 15;
                    const isExpanded = expandedAssets.has(asset.id);
                    const isWarrantyActive = asset.warranty_expiry
                      ? new Date(asset.warranty_expiry) > new Date()
                      : false;

                    return (
                      <Fragment key={asset.id}>
                        <tr className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{asset.asset_name}</div>
                            {asset.brand && (
                              <div className="text-xs text-muted-foreground">{asset.brand} {asset.model}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {ASSET_TYPES.find(t => t.value === asset.asset_type)?.label ?? asset.asset_type}
                          </td>
                          <td className="px-4 py-3">
                            {age !== null ? (
                              <div>
                                <span className={cn(
                                  'font-mono text-sm',
                                  age / lifespan > 0.8 ? 'text-orange-400' : age / lifespan > 0.6 ? 'text-yellow-400' : 'text-green-400'
                                )}>
                                  {age}y
                                </span>
                                <span className="text-muted-foreground"> / {lifespan}y</span>
                                <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full', age / lifespan > 0.8 ? 'bg-orange-500' : age / lifespan > 0.6 ? 'bg-yellow-500' : 'bg-green-500')}
                                    style={{ width: `${Math.min(100, (age / lifespan) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">Unknown</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {asset.last_service_date
                              ? <span>{format(parseISO(asset.last_service_date), 'd MMM yyyy')}</span>
                              : <span className="text-muted-foreground">Never</span>}
                            {isWarrantyActive && (
                              <div className="flex items-center gap-1 mt-0.5 text-green-400">
                                <CheckCircle className="h-2.5 w-2.5" />
                                <span>Warranty</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="text-muted-foreground">{asset.environment_context}</div>
                            <div className="text-muted-foreground">{asset.usage_intensity} use</div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setExpandedAssets(s => {
                                  const n = new Set(s);
                                  n.has(asset.id) ? n.delete(asset.id) : n.add(asset.id);
                                  return n;
                                });
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <span className="font-mono">{assetEvents.length}</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <UrgencyBadge level={prediction?.urgency_level} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                title="Add repair event"
                                onClick={() => {
                                  setEventAssetId(asset.id);
                                  setEditingEvent(emptyEvent(asset.id));
                                  setShowEventModal(true);
                                }}
                                className="p-1 hover:text-primary text-muted-foreground transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Edit asset"
                                onClick={() => { setEditingAsset(asset); setShowAssetModal(true); }}
                                className="p-1 hover:text-primary text-muted-foreground transition-colors"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Delete asset"
                                onClick={() => handleDeleteAsset(asset.id)}
                                className="p-1 hover:text-red-400 text-muted-foreground transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded: maintenance events sub-table */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-muted/20 px-6 py-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                                    Repair History
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEventAssetId(asset.id);
                                      setEditingEvent(emptyEvent(asset.id));
                                      setShowEventModal(true);
                                    }}
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" /> Log event
                                  </button>
                                </div>
                                {assetEvents.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-2">No repair events logged yet.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground">
                                        <th className="text-left py-1 pr-4">Date</th>
                                        <th className="text-left py-1 pr-4">Issue</th>
                                        <th className="text-left py-1 pr-4">Severity</th>
                                        <th className="text-left py-1 pr-4">Cost</th>
                                        <th className="text-left py-1 pr-4">Days</th>
                                        <th className="text-left py-1 pr-4">Status</th>
                                        <th />
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                      {assetEvents.map(ev => (
                                        <tr key={ev.id} className="hover:bg-muted/10">
                                          <td className="py-1.5 pr-4 whitespace-nowrap">
                                            {format(parseISO(ev.event_date), 'd MMM yy')}
                                          </td>
                                          <td className="py-1.5 pr-4 max-w-48 truncate">{ev.issue_description}</td>
                                          <td className={cn('py-1.5 pr-4 font-medium', SEVERITY_COLORS[ev.severity])}>{ev.severity}</td>
                                          <td className="py-1.5 pr-4">{ev.cost ? `€${ev.cost}` : '—'}</td>
                                          <td className="py-1.5 pr-4">{ev.resolution_time_days ?? '—'}</td>
                                          <td className="py-1.5 pr-4">
                                            {ev.resolved
                                              ? <span className="text-green-400">Resolved</span>
                                              : <span className="text-red-400">Open</span>}
                                          </td>
                                          <td className="py-1.5">
                                            <div className="flex gap-1">
                                              <button
                                                onClick={() => { setEditingEvent(ev); setEventAssetId(ev.asset_id); setShowEventModal(true); }}
                                                className="hover:text-primary text-muted-foreground"
                                              >
                                                <Edit3 className="h-3 w-3" />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteEvent(ev.id)}
                                                className="hover:text-red-400 text-muted-foreground"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Run analysis CTA */}
          {unitAssets.length > 0 && predictions.filter(p => unitAssets.some(a => a.id === p.asset_id)).length === 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Assets registered · Analysis not yet run</p>
                <p className="text-xs text-muted-foreground">Run predictive analysis to generate failure probabilities and cost exposure.</p>
              </div>
              <button
                onClick={handleRunAnalysis}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Brain className="h-4 w-4" /> Run Analysis
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: ANALYSIS RESULTS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Property:</label>
              <select
                className="bg-muted border border-border rounded px-3 py-1.5 text-sm"
                value={selectedUnitId}
                onChange={e => setSelectedUnitId(e.target.value)}
              >
                <option value="">All Properties</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.unit_identifier} — {u.address}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {analyzing
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analysing…</>
                : <><RefreshCw className="h-3.5 w-3.5" /> Re-run Analysis</>}
            </button>
          </div>

          {predictions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium mb-1">No predictions yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Register assets and run analysis to generate risk predictions.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Asset</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">6M Failure</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">12M Failure</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Cost Range</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Exposure</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Urgency</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Confidence</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Action</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {predictions
                    .filter(p => !selectedUnitId || assets.find(a => a.id === p.asset_id)?.unit_id === selectedUnitId)
                    .sort((a, b) => (b.failure_probability_12_months ?? 0) - (a.failure_probability_12_months ?? 0))
                    .map(pred => {
                      const asset = assets.find(a => a.id === pred.asset_id);
                      const unit = units.find(u => u.id === asset?.unit_id);
                      const isExpanded = expandedPredictions.has(pred.asset_id);
                      const prob12 = pred.failure_probability_12_months ?? 0;
                      const replaceCost = (pred.estimated_cost_max ?? 1000) * 1.5;
                      const waitCost = prob12 * (pred.estimated_cost_max ?? 1000) * 1.8;
                      const roiReplace = waitCost > replaceCost;

                      if (!asset) return null;

                      return (
                        <Fragment key={pred.asset_id}>
                          <tr key={pred.asset_id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{asset.asset_name}</div>
                              <div className="text-xs text-muted-foreground">{unit?.unit_identifier}</div>
                            </td>
                            <td className="px-4 py-3 w-32">
                              <ProbabilityBar value={pred.failure_probability_6_months} />
                            </td>
                            <td className="px-4 py-3 w-32">
                              <ProbabilityBar value={pred.failure_probability_12_months} />
                            </td>
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                              {pred.estimated_cost_min !== undefined
                                ? `€${pred.estimated_cost_min.toLocaleString()} – €${pred.estimated_cost_max?.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {pred.projected_financial_exposure
                                ? <span className={cn(pred.projected_financial_exposure > 2000 ? 'text-red-400' : pred.projected_financial_exposure > 800 ? 'text-orange-400' : 'text-green-400')}>
                                    €{pred.projected_financial_exposure.toLocaleString()}
                                  </span>
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <UrgencyBadge level={pred.urgency_level} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs">
                                {pred.confidence_score !== undefined
                                  ? `${Math.round(pred.confidence_score * 100)}%`
                                  : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {pred.preventative_replacement_recommended
                                ? <span className="text-orange-400 font-medium">Replace Now</span>
                                : <span className="text-green-400">Monitor</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setExpandedPredictions(s => {
                                  const n = new Set(s);
                                  n.has(pred.asset_id) ? n.delete(pred.asset_id) : n.add(pred.asset_id);
                                  return n;
                                })}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded: detail panel */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="bg-muted/10 px-6 py-4">
                                <div className="grid grid-cols-3 gap-4">
                                  {/* Reasoning */}
                                  <div className="col-span-2 space-y-3">
                                    <div>
                                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                        Claude Reasoning
                                      </h4>
                                      <p className="text-sm leading-relaxed">{pred.reasoning_summary}</p>
                                    </div>
                                    {pred.risk_drivers && pred.risk_drivers.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                                          Risk Drivers
                                        </h4>
                                        <ul className="space-y-1">
                                          {pred.risk_drivers.map((d, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                              <AlertTriangle className="h-3 w-3 text-orange-400 mt-0.5 flex-shrink-0" />
                                              {d}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  {/* ROI Comparison */}
                                  <div className="rounded-lg border border-border bg-card p-4">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                      Preventative ROI Analysis
                                    </h4>
                                    <div className="space-y-3">
                                      <div className={cn(
                                        'rounded p-3 border',
                                        roiReplace ? 'border-orange-500/30 bg-orange-500/5' : 'border-border bg-muted/20'
                                      )}>
                                        <div className="text-xs text-muted-foreground mb-1">Option A: Replace Now</div>
                                        <div className="text-lg font-bold font-mono">€{Math.round(replaceCost).toLocaleString()}</div>
                                        <div className="text-xs text-muted-foreground">Fixed planned cost</div>
                                      </div>
                                      <div className={cn(
                                        'rounded p-3 border',
                                        !roiReplace ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
                                      )}>
                                        <div className="text-xs text-muted-foreground mb-1">Option B: Wait (risk-weighted)</div>
                                        <div className="text-lg font-bold font-mono">€{Math.round(waitCost).toLocaleString()}</div>
                                        <div className="text-xs text-muted-foreground">{Math.round(prob12 * 100)}% × emergency cost</div>
                                      </div>
                                      <div className={cn(
                                        'rounded p-3 text-center font-medium text-sm',
                                        roiReplace
                                          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                      )}>
                                        {roiReplace
                                          ? `Replace saves €${Math.round(waitCost - replaceCost).toLocaleString()}`
                                          : `Wait saves €${Math.round(replaceCost - waitCost).toLocaleString()}`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: PORTFOLIO INTELLIGENCE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Top 5 risk assets */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold">Top Risk Assets — Portfolio</h3>
              <p className="text-xs text-muted-foreground">Ranked by 12-month failure probability</p>
            </div>
            {topRiskAssets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Run analysis to generate portfolio rankings.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {topRiskAssets.map((item, i) => (
                  <div key={item.asset_id} className="flex items-center gap-4 px-5 py-3">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      i === 0 ? 'bg-red-500/20 text-red-400' :
                      i === 1 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.asset?.asset_name}</div>
                      <div className="text-xs text-muted-foreground">{item.unit?.unit_identifier} · {item.unit?.address}</div>
                    </div>
                    <div className="w-28">
                      <ProbabilityBar value={item.failure_probability_12_months} />
                    </div>
                    <UrgencyBadge level={item.urgency_level} />
                    <div className="text-sm font-mono text-right w-24">
                      {item.projected_financial_exposure
                        ? <span className="text-orange-400">€{Math.round(item.projected_financial_exposure).toLocaleString()}</span>
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk by category chart */}
          {riskByCategory.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">12-Month Failure Risk by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={riskByCategory} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#ccc' }} />
                    <Tooltip
                      formatter={(v) => [`${v ?? 0}%`, 'Risk'] as [string, string]}
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '6px' }}
                    />
                    <Bar dataKey="risk" radius={[0, 4, 4, 0]}>
                      {riskByCategory.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.risk >= 70 ? '#ef4444' : entry.risk >= 40 ? '#f97316' : entry.risk >= 20 ? '#eab308' : '#22c55e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">Financial Exposure by Category (€)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={riskByCategory} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `€${v}`} tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#ccc' }} />
                    <Tooltip
                      formatter={(v) => [`€${Number(v ?? 0).toLocaleString()}`, 'Exposure'] as [string, string]}
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '6px' }}
                    />
                    <Bar dataKey="exposure" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Property risk ranking */}
          {units.length > 0 && predictions.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold">Property Risk Ranking</h3>
              </div>
              <div className="divide-y divide-border">
                {units.map(unit => {
                  const unitPreds = predictions.filter(p => assets.find(a => a.id === p.asset_id)?.unit_id === unit.id);
                  if (unitPreds.length === 0) return null;
                  const unitScore = Math.round(unitPreds.reduce((s, p) => s + (p.failure_probability_12_months ?? 0), 0) / unitPreds.length * 100);
                  const unitExposure = unitPreds.reduce((s, p) => s + (p.projected_financial_exposure ?? 0), 0);
                  const highRisk = unitPreds.filter(p => p.urgency_level === 'high' || p.urgency_level === 'critical').length;

                  return (
                    <div key={unit.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{unit.unit_identifier}</div>
                        <div className="text-xs text-muted-foreground">{unit.address} · {unit.city}</div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className={cn(
                            'text-lg font-bold font-mono',
                            unitScore >= 70 ? 'text-red-400' : unitScore >= 40 ? 'text-orange-400' : 'text-green-400'
                          )}>
                            {unitScore}
                          </div>
                          <div className="text-xs text-muted-foreground">risk score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-mono">€{Math.round(unitExposure).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">exposure</div>
                        </div>
                        <div className="text-center">
                          <div className={cn('text-sm font-mono', highRisk > 0 ? 'text-orange-400' : 'text-green-400')}>
                            {highRisk}
                          </div>
                          <div className="text-xs text-muted-foreground">high-risk</div>
                        </div>
                        <button
                          onClick={() => { setSelectedUnitId(unit.id); setActiveTab('registry'); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}

          {predictions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-medium mb-1">No portfolio data yet</p>
              <p className="text-sm text-muted-foreground">Register assets and run analysis to populate portfolio intelligence.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      {showAssetModal && editingAsset && (
        <AssetFormModal
          asset={editingAsset}
          onSave={handleSaveAsset}
          onClose={() => { setShowAssetModal(false); setEditingAsset(null); }}
        />
      )}

      {showEventModal && editingEvent && (
        <EventFormModal
          event={editingEvent}
          assetName={assets.find(a => a.id === eventAssetId)?.asset_name ?? 'Asset'}
          onSave={handleSaveEvent}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}
