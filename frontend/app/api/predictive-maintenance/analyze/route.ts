import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface MaintenanceEvent {
  id: string;
  event_date: string;
  issue_description: string;
  severity: string;
  cost?: number;
  resolution_time_days?: number;
  vendor_notes?: string;
  tenant_complaint_text?: string;
  resolved: boolean;
}

interface AssetPayload {
  id: string;
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
  maintenance_events: MaintenanceEvent[];
}

interface TenantSignal {
  complaint_text: string;
  submitted_at: string;
}

interface PredictionResult {
  asset_id: string;
  failure_probability_6_months: number;
  failure_probability_12_months: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
  preventative_replacement_recommended: boolean;
  urgency_level: 'low' | 'moderate' | 'high' | 'critical';
  risk_drivers: string[];
  projected_financial_exposure: number;
  confidence_score: number;
  reasoning_summary: string;
}

// Expected lifespan defaults by asset type (years)
const LIFESPAN_DEFAULTS: Record<string, number> = {
  boiler: 15,
  hvac: 15,
  plumbing: 30,
  electrical: 25,
  roof: 20,
  washing_machine: 10,
  dishwasher: 10,
  refrigerator: 12,
  oven: 15,
  elevator: 25,
  intercom: 15,
  windows: 20,
  water_heater: 12,
  other: 15,
};

// Environmental risk multipliers
const ENV_MULTIPLIERS: Record<string, number> = {
  coastal: 1.35,
  humid: 1.25,
  urban: 1.0,
  rural: 0.9,
  dry: 0.85,
};

// Usage intensity multipliers
const USAGE_MULTIPLIERS: Record<string, number> = {
  high: 1.3,
  medium: 1.0,
  low: 0.8,
};

function buildAssetPrompt(asset: AssetPayload, tenantSignals: TenantSignal[]): string {
  const currentYear = new Date().getFullYear();
  const age = asset.installation_year ? currentYear - asset.installation_year : null;
  const lifespan = asset.expected_lifespan_years ?? LIFESPAN_DEFAULTS[asset.asset_type] ?? 15;
  const lifeFraction = age !== null ? age / lifespan : null;
  const envMultiplier = ENV_MULTIPLIERS[asset.environment_context] ?? 1.0;
  const usageMultiplier = USAGE_MULTIPLIERS[asset.usage_intensity] ?? 1.0;

  const daysSinceService = asset.last_service_date
    ? Math.floor((Date.now() - new Date(asset.last_service_date).getTime()) / (1000 * 86400))
    : null;

  const warrantyStatus = asset.warranty_expiry
    ? new Date(asset.warranty_expiry) > new Date() ? 'in_warranty' : 'out_of_warranty'
    : 'unknown';

  const totalRepairCost = asset.maintenance_events.reduce((s, e) => s + (e.cost ?? 0), 0);
  const repairCount = asset.maintenance_events.length;
  const recentRepairs = asset.maintenance_events.filter(e => {
    const d = new Date(e.event_date);
    return d > new Date(Date.now() - 365 * 86400 * 1000);
  });

  const assetJson = {
    asset_metadata: {
      name: asset.asset_name,
      type: asset.asset_type,
      brand: asset.brand ?? 'unknown',
      model: asset.model ?? 'unknown',
      installation_year: asset.installation_year ?? 'unknown',
      age_years: age,
      expected_lifespan_years: lifespan,
      life_fraction_consumed: lifeFraction !== null ? Math.round(lifeFraction * 100) / 100 : null,
      warranty_status: warrantyStatus,
      warranty_expiry: asset.warranty_expiry ?? null,
      days_since_last_service: daysSinceService,
      notes: asset.notes ?? null,
    },
    environmental_context: {
      environment: asset.environment_context,
      usage_intensity: asset.usage_intensity,
      environmental_risk_multiplier: envMultiplier,
      usage_risk_multiplier: usageMultiplier,
      combined_risk_multiplier: Math.round(envMultiplier * usageMultiplier * 100) / 100,
    },
    repair_history: {
      total_repair_events: repairCount,
      total_repair_cost_eur: totalRepairCost,
      repairs_in_last_12_months: recentRepairs.length,
      events: asset.maintenance_events.map(e => ({
        date: e.event_date,
        issue: e.issue_description,
        severity: e.severity,
        cost_eur: e.cost ?? null,
        resolution_days: e.resolution_time_days ?? null,
        vendor_notes: e.vendor_notes ?? null,
        tenant_complaint: e.tenant_complaint_text ?? null,
        resolved: e.resolved,
      })),
    },
    tenant_signals: tenantSignals.map(s => ({
      complaint: s.complaint_text,
      date: s.submitted_at,
    })),
  };

  return `You are a property asset risk analyst. Analyse the following asset data and return a strict JSON prediction object.

ASSET DATA:
${JSON.stringify(assetJson, null, 2)}

INSTRUCTIONS:
- Quantify failure probability using age vs lifespan, repair frequency, environmental exposure, and usage intensity
- Higher combined_risk_multiplier = faster degradation
- High repair frequency in last 12 months = elevated failure risk
- Assets approaching or exceeding expected lifespan have significantly higher failure probability
- Consider whether deferred servicing increases risk
- Tenant complaints are early warning signals — weight them appropriately
- Estimated cost range must reflect emergency repair (worst case) vs planned repair (best case)
- projected_financial_exposure = failure_probability_12_months × estimated_cost_max
- confidence_score reflects data quality: 0.5 if age/history unknown, up to 0.95 if full data available
- reasoning_summary must be specific (cite age, repair count, multipliers) — no vague statements
- Avoid hedging language like "may" or "might" — use probability ranges

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "failure_probability_6_months": <0.0–1.0>,
  "failure_probability_12_months": <0.0–1.0>,
  "estimated_cost_min": <number in EUR>,
  "estimated_cost_max": <number in EUR>,
  "preventative_replacement_recommended": <boolean>,
  "urgency_level": <"low"|"moderate"|"high"|"critical">,
  "risk_drivers": [<string>, ...],
  "projected_financial_exposure": <number in EUR>,
  "confidence_score": <0.0–1.0>,
  "reasoning_summary": <string, 2–4 sentences, specific and quantified>
}`;
}

async function analyseAsset(
  client: Anthropic,
  asset: AssetPayload,
  tenantSignals: TenantSignal[]
): Promise<PredictionResult> {
  const prompt = buildAssetPrompt(asset, tenantSignals);

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  let parsed: Omit<PredictionResult, 'asset_id'>;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = {
      failure_probability_6_months: 0.3,
      failure_probability_12_months: 0.5,
      estimated_cost_min: 200,
      estimated_cost_max: 1500,
      preventative_replacement_recommended: false,
      urgency_level: 'moderate',
      risk_drivers: ['Insufficient data for precise prediction'],
      projected_financial_exposure: 750,
      confidence_score: 0.4,
      reasoning_summary: 'Unable to parse structured prediction. Default moderate-risk values assigned.',
    };
  }

  return { asset_id: asset.id, ...parsed };
}

async function analyseComplaint(
  client: Anthropic,
  complaintText: string,
  availableAssets: AssetPayload[]
): Promise<{ mapped_asset_category: string; escalation_probability: number; risk_impact: string }> {
  const assetTypes = [...new Set(availableAssets.map(a => a.asset_type))].join(', ');

  const prompt = `A tenant submitted this complaint: "${complaintText}"

Available asset categories: ${assetTypes || 'boiler, hvac, plumbing, electrical, roof, appliances'}

Return ONLY valid JSON:
{
  "mapped_asset_category": <most likely affected asset type from the list>,
  "escalation_probability": <0.0–1.0 likelihood this becomes a major failure>,
  "risk_impact": <"low"|"moderate"|"high"|"critical">
}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 200,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { mapped_asset_category: 'other', escalation_probability: 0.3, risk_impact: 'moderate' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      landlord_id,
      unit_id,
      assets,
      tenant_signals = [],
      analyse_complaints = false,
    }: {
      landlord_id: string;
      unit_id?: string;
      assets: AssetPayload[];
      tenant_signals?: TenantSignal[];
      analyse_complaints?: boolean;
    } = body;

    if (!landlord_id) {
      return NextResponse.json({ error: 'landlord_id required' }, { status: 400 });
    }
    if (!assets || assets.length === 0) {
      return NextResponse.json({ error: 'No assets provided' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const supabase = getSupabase();

    // Analyse each asset in sequence (rate limit friendly)
    const predictions: PredictionResult[] = [];
    for (const asset of assets) {
      const result = await analyseAsset(client, asset, tenant_signals);
      predictions.push(result);
    }

    // Persist predictions to database
    const rows = predictions.map(p => ({
      asset_id: p.asset_id,
      failure_probability_6_months: p.failure_probability_6_months,
      failure_probability_12_months: p.failure_probability_12_months,
      estimated_cost_min: p.estimated_cost_min,
      estimated_cost_max: p.estimated_cost_max,
      preventative_replacement_recommended: p.preventative_replacement_recommended,
      urgency_level: p.urgency_level,
      risk_drivers: p.risk_drivers,
      projected_financial_exposure: p.projected_financial_exposure,
      confidence_score: p.confidence_score,
      reasoning_summary: p.reasoning_summary,
      raw_response: p as unknown as Record<string, unknown>,
    }));

    const { error: insertError } = await supabase.from('pm_predictions').insert(rows);
    if (insertError) {
      console.error('Failed to persist predictions:', insertError);
    }

    // Optionally analyse tenant complaints
    let complaintAnalyses: Array<{
      complaint_text: string;
      mapped_asset_category: string;
      escalation_probability: number;
      risk_impact: string;
    }> = [];

    if (analyse_complaints && tenant_signals.length > 0) {
      for (const signal of tenant_signals) {
        const analysis = await analyseComplaint(client, signal.complaint_text, assets);
        complaintAnalyses.push({ complaint_text: signal.complaint_text, ...analysis });
      }

      if (unit_id && complaintAnalyses.length > 0) {
        const signalRows = complaintAnalyses.map(ca => ({
          unit_id,
          complaint_text: ca.complaint_text,
          mapped_asset_category: ca.mapped_asset_category,
          escalation_probability: ca.escalation_probability,
          risk_impact: ca.risk_impact,
        }));
        await supabase.from('pm_tenant_signals').insert(signalRows);
      }
    }

    // Compute portfolio aggregates
    const totalExposure = predictions.reduce((s, p) => s + (p.projected_financial_exposure ?? 0), 0);
    const highRiskCount = predictions.filter(p =>
      p.urgency_level === 'high' || p.urgency_level === 'critical'
    ).length;
    const avgRiskScore = predictions.length > 0
      ? Math.round(
          (predictions.reduce((s, p) => s + (p.failure_probability_12_months ?? 0), 0) /
            predictions.length) * 100
        )
      : 0;

    return NextResponse.json({
      predictions,
      complaint_analyses: complaintAnalyses,
      portfolio_summary: {
        total_assets_analysed: predictions.length,
        portfolio_risk_score: avgRiskScore,
        total_12m_exposure: Math.round(totalExposure),
        high_risk_asset_count: highRiskCount,
        critical_assets: predictions
          .filter(p => p.urgency_level === 'critical' || p.urgency_level === 'high')
          .sort((a, b) => (b.failure_probability_12_months ?? 0) - (a.failure_probability_12_months ?? 0))
          .slice(0, 5)
          .map(p => ({
            asset_id: p.asset_id,
            urgency: p.urgency_level,
            exposure: p.projected_financial_exposure,
          })),
      },
    });
  } catch (error) {
    console.error('Predictive maintenance API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
