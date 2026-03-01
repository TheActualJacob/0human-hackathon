import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { getMarketDataProvider } from '@/lib/marketData';
import type { RentalComp, MarketDataResult } from '@/lib/marketData';
import { geocodeAddress } from '@/lib/marketData/geocoder';

// ─── Country inference (mirrors scraper.ts) ───────────────────────────────────
const GREEK_CITIES = new Set([
  'athens', 'athina', 'attica', 'papagou', 'cholargos', 'agia paraskevi',
  'glyfada', 'vouliagmeni', 'kifisia', 'marousi', 'halandri', 'chalandri',
  'nea smyrni', 'kallithea', 'piraeus', 'peiraeus', 'thessaloniki',
  'heraklion', 'patras', 'volos', 'larissa', 'rhodes', 'chania', 'corfu',
  'zakynthos', 'santorini', 'mykonos', 'crete', 'zografou', 'pagkrati',
  'ampelokipoi', 'kipseli', 'exarchia', 'kolonaki', 'monastiraki',
  'psyrri', 'koukaki', 'ilioupoli', 'dafni', 'vyronas', 'kaisariani',
]);

function inferCountryFromCity(city: string, storedCountry: string): string {
  const key = city.toLowerCase().trim();
  if (GREEK_CITIES.has(key) || [...GREEK_CITIES].some(c => key.includes(c))) return 'GR';
  if (storedCountry && !['GB', 'UK', ''].includes(storedCountry.toUpperCase())) {
    return storedCountry.toUpperCase();
  }
  return 'GB';
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Market Statistics ────────────────────────────────────────────────────────
interface MarketStats {
  median: number;
  mean: number;
  p25: number;
  p75: number;
  avgDom: number;
  stdDev: number;
  coeffVariation: number;
  currentRent: number;
  percentile: number;
  sampleSize: number;
}

function weightedMedian(items: Array<{ value: number; weight: number }>): number {
  if (!items.length) return 0;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const totalW = sorted.reduce((s, x) => s + x.weight, 0);
  let cum = 0;
  for (const { value, weight } of sorted) {
    cum += weight;
    if (cum >= totalW / 2) return value;
  }
  return sorted[sorted.length - 1].value;
}

function computeMarketStats(comps: RentalComp[], currentRent: number): MarketStats {
  if (!comps.length) {
    return { median: currentRent, mean: currentRent, p25: currentRent * 0.9, p75: currentRent * 1.1, avgDom: 14, stdDev: 0, coeffVariation: 0, currentRent, percentile: 50, sampleSize: 0 };
  }
  const rents = comps.map(c => c.rent).sort((a, b) => a - b);
  const n = rents.length;
  const mean = rents.reduce((s, r) => s + r, 0) / n;
  const median = n % 2 === 0 ? (rents[n / 2 - 1] + rents[n / 2]) / 2 : rents[Math.floor(n / 2)];
  const p25 = rents[Math.floor(n * 0.25)];
  const p75 = rents[Math.floor(n * 0.75)];
  const variance = rents.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const coeffVariation = mean > 0 ? stdDev / mean : 0;
  const avgDom = comps.reduce((s, c) => s + c.days_on_market, 0) / n;
  const below = rents.filter(r => r < currentRent).length;
  const percentile = Math.round((below / n) * 100);
  return { median, mean, p25, p75, avgDom, stdDev, coeffVariation, currentRent, percentile, sampleSize: n };
}

// ─── Hedonic Pricing Model ────────────────────────────────────────────────────
// Adjusts every comp for bedroom count and sqm, then applies distance-weighted
// regression to produce a property-specific optimal price — like a proper quant model.
interface HedonicResult {
  hedonic_price: number;
  price_per_sqm: number | null;
  bedroom_adjusted_median: number;
  sqm_adjusted_price: number | null;
  bedroom_premium_pct: number;
  method: 'sqm+bedroom' | 'bedroom_only' | 'weighted_median';
  model_confidence: number;
  comp_breakdown: Array<{ rent: number; adj_rent: number; weight: number; beds: number; sqm: number | null }>;
}

function buildHedonicModel(comps: RentalComp[], subjectBedrooms: number, subjectSqm: number | null): HedonicResult {
  const empty: HedonicResult = { hedonic_price: 0, price_per_sqm: null, bedroom_adjusted_median: 0, sqm_adjusted_price: null, bedroom_premium_pct: 0, method: 'weighted_median', model_confidence: 0, comp_breakdown: [] };
  if (!comps.length) return empty;

  // Standard bedroom scaling factors (2BR = 1.00 baseline)
  const STD: Record<number, number> = { 0: 0.60, 1: 0.78, 2: 1.00, 3: 1.28, 4: 1.55, 5: 1.80 };
  const stdF = (b: number) => STD[Math.min(b, 5)] ?? 1.80;

  // ── Step 1: Empirical bedroom medians from comps ──────────────────────
  const rentByBeds = new Map<number, number[]>();
  for (const c of comps) {
    const b = c.bedrooms ?? 2;
    if (!rentByBeds.has(b)) rentByBeds.set(b, []);
    rentByBeds.get(b)!.push(c.rent);
  }
  const medByBeds = new Map<number, number>();
  for (const [b, rents] of rentByBeds) {
    const s = [...rents].sort((a, z) => a - z);
    medByBeds.set(b, s.length % 2 === 0 ? (s[s.length/2-1] + s[s.length/2]) / 2 : s[Math.floor(s.length/2)]);
  }
  const subjectMed = medByBeds.get(subjectBedrooms);

  // Empirically adjust comp rent → what it would be at subject's bedroom count
  const bedroomAdj = (compBeds: number, compRent: number): number => {
    const compMed = medByBeds.get(compBeds);
    if (subjectMed && compMed && compMed > 0) return compRent * (subjectMed / compMed);
    return compRent * (stdF(subjectBedrooms) / stdF(compBeds));
  };

  // ── Step 2: Per-comp weights (distance × similarity × bedroom proximity) ─
  const weighted = comps.map(c => {
    const dist_w = Math.exp(-Math.pow((c.distance_km ?? 2) / 5, 2));   // Gaussian, 5km bandwidth
    const bed_w  = Math.exp(-Math.abs((c.bedrooms ?? 2) - subjectBedrooms) * 0.7);
    const sim_w  = (c.similarity_score ?? 50) / 100;
    const weight = dist_w * bed_w * sim_w;
    const adj_rent = bedroomAdj(c.bedrooms ?? 2, c.rent);
    return { c, weight, adj_rent };
  });

  // ── Step 3: Weighted median of bedroom-adjusted rents ────────────────
  const bedroom_adjusted_median = weightedMedian(weighted.map(x => ({ value: x.adj_rent, weight: x.weight })));

  // ── Step 4: Sqm-based model ─────────────────────────────────────────
  const withSqm = weighted.filter(x => x.c.sqm && x.c.sqm > 10);
  let price_per_sqm: number | null = null;
  let sqm_adjusted_price: number | null = null;

  if (withSqm.length >= 2) {
    const wSumW   = withSqm.reduce((s, x) => s + x.weight, 0);
    // Weighted mean price_per_sqm (on bedroom-adjusted rent)
    price_per_sqm = withSqm.reduce((s, x) => s + (x.adj_rent / x.c.sqm!) * x.weight, 0) / wSumW;

    if (subjectSqm && subjectSqm > 10) {
      // Per-comp: scale comp to subject's exact sqm, penalise size divergence
      const sizeAdjusted = withSqm.map(x => {
        const sizeRatio = Math.min(subjectSqm, x.c.sqm!) / Math.max(subjectSqm, x.c.sqm!);
        const size_w    = sizeRatio ** 1.5;                             // reward similar sizes
        const adj       = (x.c.rent / x.c.sqm!) * subjectSqm * (stdF(subjectBedrooms) / stdF(x.c.bedrooms ?? 2));
        return { adj, weight: x.weight * size_w };
      });
      const num = sizeAdjusted.reduce((s, x) => s + x.adj * x.weight, 0);
      const den = sizeAdjusted.reduce((s, x) => s + x.weight, 0);
      sqm_adjusted_price = den > 0 ? num / den : null;
    }
  }

  // ── Step 5: Blend sqm model + bedroom model ──────────────────────────
  let hedonic_price: number;
  let method: HedonicResult['method'];
  if (sqm_adjusted_price && subjectSqm) {
    hedonic_price = Math.round(sqm_adjusted_price * 0.60 + bedroom_adjusted_median * 0.40);
    method = 'sqm+bedroom';
  } else {
    hedonic_price = Math.round(bedroom_adjusted_median);
    method = withSqm.length >= 2 ? 'bedroom_only' : 'weighted_median';
  }

  // ── Step 6: Bedroom premium vs overall market median ─────────────────
  const allRents  = comps.map(c => c.rent).sort((a, b) => a - b);
  const n = allRents.length;
  const overallMed = n % 2 === 0 ? (allRents[n/2-1] + allRents[n/2]) / 2 : allRents[Math.floor(n/2)];
  const bedroom_premium_pct = overallMed > 0 ? Math.round((bedroom_adjusted_median / overallMed - 1) * 100) : 0;

  // Model confidence: rewards sqm coverage and bedroom variety
  const sqmCoverage    = withSqm.length / comps.length;
  const bedsVariety    = medByBeds.size;
  const model_confidence = Math.min(0.95, 0.40 + sqmCoverage * 0.25 + Math.min(bedsVariety, 3) * 0.05 + (sqm_adjusted_price ? 0.2 : 0));

  return {
    hedonic_price,
    price_per_sqm:           price_per_sqm ? Math.round(price_per_sqm * 100) / 100 : null,
    bedroom_adjusted_median: Math.round(bedroom_adjusted_median),
    sqm_adjusted_price:      sqm_adjusted_price ? Math.round(sqm_adjusted_price) : null,
    bedroom_premium_pct,
    method,
    model_confidence,
    comp_breakdown: weighted.map(x => ({
      rent:     x.c.rent,
      adj_rent: Math.round(x.adj_rent),
      weight:   Math.round(x.weight * 100) / 100,
      beds:     x.c.bedrooms ?? 2,
      sqm:      x.c.sqm ?? null,
    })),
  };
}

// ─── Confidence Scoring ───────────────────────────────────────────────────────
function computeConfidence(stats: MarketStats, isLiveData: boolean, hedonicConfidence = 0): number {
  const n = stats.sampleSize;
  if (n === 0) return 0.35;
  const sizeScore = Math.min(1, 0.4 + (n / 15) * 0.5);
  const cvScore   = Math.max(0.4, 1 - (stats.coeffVariation / 0.30) * 0.6);
  const dataBonus = isLiveData ? 0.1 : 0;
  const marketScore = sizeScore * cvScore + dataBonus;
  // Blend market confidence with hedonic model quality
  return Math.min(0.97, Math.round((marketScore * 0.6 + hedonicConfidence * 0.4) * 100) / 100);
}

// ─── Seasonality Coefficient ──────────────────────────────────────────────────
// Returns a vacancy risk adjustment (positive = higher risk) for current month
function seasonalityAdjustment(): { adjustment: number; label: string } {
  const month = new Date().getMonth(); // 0=Jan
  // Peak demand: Mar–Jun, Sep–Oct → low vacancy risk
  // Slow period: Nov–Jan → high vacancy risk
  const seasonal: Record<number, { adj: number; label: string }> = {
    0:  { adj: +12, label: 'January (slow leasing season)' },
    1:  { adj: +6,  label: 'February (slow leasing season)' },
    2:  { adj: -8,  label: 'March (spring demand surge)' },
    3:  { adj: -10, label: 'April (spring demand peak)' },
    4:  { adj: -8,  label: 'May (spring demand peak)' },
    5:  { adj: -5,  label: 'June (summer transition)' },
    6:  { adj: -3,  label: 'July (summer stable)' },
    7:  { adj: -3,  label: 'August (summer stable)' },
    8:  { adj: -7,  label: 'September (autumn demand surge)' },
    9:  { adj: -5,  label: 'October (autumn demand)' },
    10: { adj: +8,  label: 'November (market cooling)' },
    11: { adj: +14, label: 'December (slowest leasing month)' },
  };
  return { adjustment: seasonal[month]?.adj ?? 0, label: seasonal[month]?.label ?? '' };
}

// ─── ADOM-Based Vacancy Risk ──────────────────────────────────────────────────
// Vacancy risk based on real absorption rate, seasonality, and price positioning
function computeVacancyRisk(stats: MarketStats, percentile: number): number {
  const season = seasonalityAdjustment();

  // Base: ADOM absorption signal (calibrated to days-on-market bands)
  let base: number;
  if (stats.avgDom < 5)       base = 15;   // extremely tight market
  else if (stats.avgDom < 10) base = 25;
  else if (stats.avgDom < 18) base = 38;
  else if (stats.avgDom < 30) base = 52;
  else if (stats.avgDom < 45) base = 65;
  else                         base = 78;   // very slow absorption

  // Price positioning adjustment: above 80th percentile = harder to lease
  const pricePenalty = percentile > 80 ? (percentile - 80) * 0.8 : percentile < 20 ? -10 : 0;

  // Seasonal adjustment
  const total = base + pricePenalty + season.adjustment;
  return Math.min(100, Math.max(5, Math.round(total)));
}

// ─── Elasticity Curve ─────────────────────────────────────────────────────────
// Price delta → vacancy risk + projected annual revenue
// Incorporates vacancy cost: each % vacancy risk = lost rent days
function buildElasticityCurve(baseVacancyRisk: number, currentRent: number): Array<{
  priceDeltaPct: number;
  vacancyRisk: number;
  annualRevenue: number;
  netAfterVacancy: number;
}> {
  const season = seasonalityAdjustment();

  return [-15, -10, -5, 0, 5, 10, 15, 20].map(delta => {
    const newRent = currentRent * (1 + delta / 100);
    // Risk increases super-linearly above 0 (rent increases hit harder than cuts help)
    const riskDelta = delta >= 0 ? delta * 2.5 : delta * 1.5;
    const vacancyRisk = Math.min(100, Math.max(5, Math.round(baseVacancyRisk + riskDelta + season.adjustment * 0.3)));
    // Vacancy cost: expected vacant months = (vacancyRisk / 100) * 1.5 months/year
    const expectedVacantMonths = (vacancyRisk / 100) * 1.5;
    const annualRevenue = Math.round(newRent * 12);
    const netAfterVacancy = Math.round(newRent * (12 - expectedVacantMonths));
    return { priceDeltaPct: delta, vacancyRisk, annualRevenue, netAfterVacancy };
  });
}

// ─── Claude Analysis ──────────────────────────────────────────────────────────
function getCurrencySymbol(city: string, country?: string): string {
  const c = (country ?? '').toUpperCase();
  if (c === 'GR' || c === 'DE' || c === 'NL' || c === 'FR' || c === 'ES' || c === 'IT' || c === 'PT' || c === 'AT' || c === 'BE') return '€';
  if (c === 'US') return '$';
  if (c === 'GB' || c === 'UK') return '£';
  const key = city.toLowerCase();
  if (GREEK_CITIES.has(key) || [...GREEK_CITIES].some(k => key.includes(k))) return '€';
  return '£';
}

async function callClaude(
  unit: any,
  currentRent: number,
  comps: RentalComp[],
  stats: MarketStats,
  hedonic: HedonicResult,
  vacancyRisk: number,
  confidence: number,
  dataSourceKey: string,
  dataSourceLabel: string,
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const anthropic = new Anthropic({ apiKey });
  const season = seasonalityAdjustment();
  const isLiveData = dataSourceKey !== 'fallback';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const inferredCountry = inferCountryFromCity(unit.city ?? '', unit.country ?? 'GB');
  const sym = getCurrencySymbol(unit.city ?? '', inferredCountry);
  const subjectSqm: number | null = unit.sqm ?? unit.size_sqm ?? null;

  const systemPrompt = `You are a Senior Portfolio Asset Manager and quantitative pricing analyst specialising in residential real estate revenue optimisation. You are given the output of a hedonic pricing model — a proper regression-based estimate that accounts for size (m²), bedroom count, and distance — as your primary signal.

DECISION FRAMEWORK:
1. The hedonic model price is your anchor. It accounts for property-specific characteristics. Do not deviate from it without quantified justification.
2. Adjust the hedonic price for absorption/vacancy risk: if ADOM is high, apply a 2–5% discount; if market is tight, capture 2–4% upside.
3. Vacancy cost: (vacancyRisk/100 × 1.5 months × newRent) must be subtracted from any revenue projection.
4. All numbers in your response must be derivable from the data provided. No invented figures.
5. Return only valid JSON — no markdown, no prose outside the JSON object.`;

  const absSignal = stats.avgDom < 10 ? 'tight (fast absorption)' : stats.avgDom < 20 ? 'stable' : stats.avgDom < 35 ? 'softening (slow absorption)' : 'very soft (poor absorption)';
  const methodLabel = hedonic.method === 'sqm+bedroom' ? 'Size + Bedroom regression' : hedonic.method === 'bedroom_only' ? 'Bedroom-adjusted regression' : 'Distance-weighted median';

  const userMessage = `Analyse this rental unit and produce pricing recommendations. Today: ${today}.

SUBJECT PROPERTY:
- Address: ${unit.address ?? 'N/A'}, ${unit.city ?? 'N/A'}
- Bedrooms: ${unit.bedrooms ?? 2} | Bathrooms: ${unit.bathrooms ?? 1} | Size: ${subjectSqm ? `${subjectSqm}m²` : 'unknown'}
- Property type: ${unit.unit_type ?? unit.property_type ?? 'apartment'}
- Current rent: ${sym}${currentRent}/month

HEDONIC MODEL OUTPUT (primary pricing signal — accounts for size, bedrooms, distance):
- Method: ${methodLabel} (confidence: ${Math.round(hedonic.model_confidence * 100)}%)
- Hedonic optimal price: ${sym}${hedonic.hedonic_price}/month
- Bedroom-adjusted weighted median: ${sym}${hedonic.bedroom_adjusted_median}/month${hedonic.price_per_sqm ? `\n- Market price per m²: ${sym}${hedonic.price_per_sqm}/m²` : ''}${hedonic.sqm_adjusted_price ? `\n- Size-adjusted estimate (${subjectSqm}m²): ${sym}${hedonic.sqm_adjusted_price}/month` : ''}
- This property's ${unit.bedrooms ?? 2}-bed premium vs overall market: ${hedonic.bedroom_premium_pct >= 0 ? '+' : ''}${hedonic.bedroom_premium_pct}%

PER-COMP BREAKDOWN (bedroom & size adjusted):
${hedonic.comp_breakdown.map((x, i) => {
  const c = comps[i];
  return `  [${i+1}] ${sym}${x.rent}/mo raw → ${sym}${x.adj_rent}/mo adj | ${x.beds}BR | ${x.sqm ? `${x.sqm}m²` : '?m²'} | ${c?.distance_km ?? '?'}km | weight=${x.weight}`;
}).join('\n')}

MARKET CONTEXT:
- Raw comps: Median ${sym}${Math.round(stats.median)}/mo | P25 ${sym}${stats.p25}/mo | P75 ${sym}${stats.p75}/mo
- Current rent percentile (unadjusted): ${stats.percentile}th of ${stats.sampleSize} comps
- Absorption: ${absSignal} | Avg ADOM: ${Math.round(stats.avgDom)} days | CV: ${(stats.coeffVariation * 100).toFixed(1)}%
- Season: ${season.label} (${season.adjustment > 0 ? '+' : ''}${season.adjustment} pts vacancy risk)
- Data source: ${dataSourceLabel}

VACANCY RISK: ${vacancyRisk}/100
OVERALL CONFIDENCE: ${Math.round(confidence * 100)}%

ROI FRAMEWORK: For each scenario, calculate net_delta as:
(newRent - currentRent) × 12 - (vacancyRisk/100 × 1.5 months × newRent)
Only recommend increases if net ROI is positive after accounting for vacancy cost.

Return this exact JSON:
{
  "optimal_listing_price": <number>,
  "recommended_renewal_increase_percent": <number, can be 0 or negative>,
  "vacancy_risk_score": <number 0-100>,
  "projected_days_on_market": [<min>, <max>],
  "projected_annual_revenue_delta": <number, accounts for vacancy cost>,
  "market_trend": "<tightening|stable|softening>",
  "confidence_score": <number 0-1>,
  "market_percentile": <number 0-100>,
  "reasoning_summary": "<2-3 sentences citing specific numbers from the data>",
  "absorption_signal": "<one of: tightening|stable|softening>",
  "seasonal_note": "<brief note on seasonal impact>",
  "alternative_scenarios": [
    {
      "label": "<e.g. Occupancy-First: Hold at £X>",
      "price": <number>,
      "vacancy_risk": <number>,
      "annual_revenue": <number>,
      "net_after_vacancy": <number>,
      "revenue_delta": <number net of vacancy cost>,
      "risk_level": "<low|moderate|high>"
    },
    {
      "label": "<e.g. Market Rate: £X>",
      "price": <number>,
      "vacancy_risk": <number>,
      "annual_revenue": <number>,
      "net_after_vacancy": <number>,
      "revenue_delta": <number>,
      "risk_level": "<low|moderate|high>"
    },
    {
      "label": "<e.g. Upside Capture: £X>",
      "price": <number>,
      "vacancy_risk": <number>,
      "annual_revenue": <number>,
      "net_after_vacancy": <number>,
      "revenue_delta": <number>,
      "risk_level": "<low|moderate|high>"
    }
  ]
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1400,
        temperature: 0.1 as any,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      if (attempt === 2) break;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return null;
}

// ─── City price index (used when no comps are available) ─────────────────────
const CITY_PRICE_INDEX: Record<string, { medianPcm: number; currency: string }> = {
  london: { medianPcm: 2200, currency: '£' }, manchester: { medianPcm: 1300, currency: '£' },
  birmingham: { medianPcm: 1100, currency: '£' }, edinburgh: { medianPcm: 1400, currency: '£' },
  bristol: { medianPcm: 1350, currency: '£' }, leeds: { medianPcm: 1050, currency: '£' },
  athens: { medianPcm: 750, currency: '€' }, papagou: { medianPcm: 800, currency: '€' },
  cholargos: { medianPcm: 780, currency: '€' }, 'agia paraskevi': { medianPcm: 900, currency: '€' },
  glyfada: { medianPcm: 1100, currency: '€' }, kifisia: { medianPcm: 1200, currency: '€' },
  thessaloniki: { medianPcm: 550, currency: '€' }, amsterdam: { medianPcm: 1800, currency: '€' },
  berlin: { medianPcm: 1400, currency: '€' }, munich: { medianPcm: 2000, currency: '€' },
};

function getCityMedian(city: string, bedrooms: number): number {
  const key = city.toLowerCase().trim();
  let entry = CITY_PRICE_INDEX[key];
  if (!entry) {
    // Partial match
    for (const [k, v] of Object.entries(CITY_PRICE_INDEX)) {
      if (key.includes(k) || k.includes(key)) { entry = v; break; }
    }
  }
  const basePcm = entry?.medianPcm ?? 900;
  // Bedroom scalar: 1-bed = 80%, 2-bed = 100%, 3-bed = 130%
  const scalar = 0.6 + Math.min(bedrooms, 4) * 0.2;
  return Math.round(basePcm * scalar);
}

// ─── Fallback analysis (no Claude) ───────────────────────────────────────────
function buildFallbackAnalysis(
  currentRent: number,
  stats: MarketStats,
  hedonic: HedonicResult,
  vacancyRisk: number,
  confidence: number,
  city?: string,
  bedrooms?: number,
  country?: string,
): any {
  const season = seasonalityAdjustment();
  const sym = getCurrencySymbol(city ?? '', country);
  const cityGuess = city ? getCityMedian(city, bedrooms ?? 1) : null;
  // Use hedonic price if available, otherwise fall back to median or city index
  const optimal = hedonic.hedonic_price > 0
    ? hedonic.hedonic_price
    : stats.sampleSize > 0
      ? Math.round(stats.median * 1.01)
      : (cityGuess ?? currentRent);
  const rawDelta = (optimal - currentRent) * 12;
  // Deduct vacancy cost
  const vacancyCost = (vacancyRisk / 100) * 1.5 * optimal;
  const netDelta = Math.round(rawDelta - vacancyCost);

  return {
    optimal_listing_price: optimal,
    recommended_renewal_increase_percent: stats.percentile < 50 ? 3 : 1.5,
    vacancy_risk_score: vacancyRisk,
    projected_days_on_market: [Math.round(stats.avgDom * 0.7), Math.round(stats.avgDom * 1.5)],
    projected_annual_revenue_delta: netDelta,
    market_trend: stats.avgDom < 10 ? 'tightening' : stats.avgDom > 25 ? 'softening' : 'stable',
    confidence_score: confidence,
    market_percentile: stats.percentile,
    absorption_signal: stats.avgDom < 10 ? 'tightening' : stats.avgDom > 25 ? 'softening' : 'stable',
    seasonal_note: `${season.label} — vacancy risk ${season.adjustment > 0 ? 'elevated' : 'reduced'} by ${Math.abs(season.adjustment)} points.`,
    reasoning_summary: stats.sampleSize > 0
      ? `Current rent of ${sym}${currentRent}/mo sits at the ${stats.percentile}th percentile of ${stats.sampleSize} comparable listings. Market ADOM is ${Math.round(stats.avgDom)} days. Moving to the optimal price of ${sym}${optimal}/mo generates an estimated net gain of ${sym}${Math.abs(netDelta).toLocaleString()} annually after vacancy cost.`
      : `No live comps found — optimal price of ${sym}${optimal}/mo is estimated from the ${city ?? 'local'} city market index (${bedrooms ?? 1}-bed benchmark). Run analysis again once scraping is restored for real-market numbers.`,
    alternative_scenarios: [
      { label: `Hold: ${sym}${currentRent}`, price: currentRent, vacancy_risk: Math.max(5, vacancyRisk - 5), annual_revenue: currentRent * 12, net_after_vacancy: Math.round(currentRent * (12 - (vacancyRisk / 100) * 1.5)), revenue_delta: 0, risk_level: 'low' },
      { label: `AI Optimal: ${sym}${optimal}`, price: optimal, vacancy_risk: vacancyRisk, annual_revenue: optimal * 12, net_after_vacancy: Math.round(optimal * (12 - (vacancyRisk / 100) * 1.5)), revenue_delta: netDelta, risk_level: 'moderate' },
      { label: `Aggressive: ${sym}${Math.round(currentRent * 1.08)}`, price: Math.round(currentRent * 1.08), vacancy_risk: Math.min(95, vacancyRisk + 20), annual_revenue: Math.round(currentRent * 1.08) * 12, net_after_vacancy: Math.round(currentRent * 1.08 * (12 - Math.min(95, vacancyRisk + 20) / 100 * 1.5)), revenue_delta: Math.round((currentRent * 0.08 * 12) - (Math.min(95, vacancyRisk + 20) / 100 * 1.5 * currentRent * 1.08)), risk_level: 'high' },
    ],
  };
}

// ─── Alert generation ─────────────────────────────────────────────────────────
function generateAlerts(unit: any, analysis: any, currentRent: number, stats: MarketStats, sym: string) {
  const alerts = [];
  const season = seasonalityAdjustment();

  if (analysis.vacancy_risk_score >= 70) {
    alerts.push({ alert_type: 'vacancy_risk', severity: 'critical', title: 'Critical Vacancy Risk', body: `ADOM of ${Math.round(stats.avgDom)} days and ${season.label} signal severe leasing difficulty. Consider reducing listing price 5–10% immediately.`, revenue_impact: -currentRent * 2 });
  } else if (analysis.vacancy_risk_score >= 50) {
    alerts.push({ alert_type: 'vacancy_risk', severity: 'warning', title: 'Elevated Vacancy Risk', body: `Market absorption is slow (${Math.round(stats.avgDom)} days ADOM). Monitor closely and review pricing weekly.`, revenue_impact: -currentRent * 0.75 });
  }

  if (stats.percentile > 80) {
    alerts.push({ alert_type: 'price_deviation', severity: 'warning', title: 'Priced Above 80th Percentile', body: `At ${sym}${currentRent}/mo you are above 80% of ${stats.sampleSize} comparable units. This may add ${Math.round(stats.avgDom * 0.5)} extra days vacancy worth ${sym}${Math.round(currentRent * stats.avgDom * 0.5 / 30).toLocaleString()}.`, revenue_impact: -Math.round(currentRent * stats.avgDom * 0.5 / 30) });
  } else if (stats.percentile < 20 && stats.sampleSize > 3) {
    const upside = (analysis.optimal_listing_price - currentRent) * 12;
    alerts.push({ alert_type: 'price_deviation', severity: 'info', title: 'Revenue Upside Identified', body: `At the ${stats.percentile}th percentile you may be under-pricing vs market. Moving to median (${sym}${Math.round(stats.median)}/mo) could yield ${sym}${Math.round(upside).toLocaleString()} additional annual revenue.`, revenue_impact: upside });
  }

  if (analysis.market_trend === 'softening') {
    alerts.push({ alert_type: 'market_shift', severity: 'warning', title: 'Market Softening Signal', body: `Rising ADOM (${Math.round(stats.avgDom)} days) across ${stats.sampleSize} comps indicates declining demand. Lock in renewals early and limit increases to 1–2%.`, revenue_impact: -currentRent * 1.5 });
  } else if (analysis.market_trend === 'tightening') {
    alerts.push({ alert_type: 'action_required', severity: 'info', title: 'Market Tightening — Capture Upside', body: `Fast absorption (${Math.round(stats.avgDom)} days ADOM) signals landlord-favourable conditions. A 4–6% renewal increase is supported by market data.`, revenue_impact: currentRent * 0.05 * 12 });
  }

  if (season.adjustment > 8) {
    alerts.push({ alert_type: 'market_shift', severity: 'info', title: 'Seasonal Headwind', body: `${season.label} — historically the slowest leasing period. Price competitively or delay re-listing until spring if possible.`, revenue_impact: -currentRent * 0.5 });
  }

  return alerts;
}

// ─── Main POST handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { unitId, landlordId } = await request.json() as { unitId: string; landlordId: string };
    if (!unitId || !landlordId) return NextResponse.json({ error: 'unitId and landlordId are required' }, { status: 400 });

    const supabase = getSupabase();

    const { data: unit, error: unitErr } = await supabase.from('units').select('*').eq('id', unitId).single();
    if (unitErr || !unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

    // Get current rent
    const { data: leaseData } = await supabase.from('leases').select('monthly_rent').eq('unit_id', unitId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const currentRent = leaseData?.monthly_rent ?? unit.rent_amount ?? 1000;

    // Infer real country from city name — overrides stale DB values (e.g. Papagou stored as GB)
    const inferredCountry = inferCountryFromCity(unit.city ?? '', unit.country ?? 'GB');

    // Geocode the unit — tier 1: exact address, tier 2: city (see geocoder.ts for fallback logic)
    let coordinates = unit.lat && unit.lng ? { lat: unit.lat, lng: unit.lng } : null;
    if (!coordinates) {
      coordinates = await geocodeAddress(unit.address ?? '', unit.city ?? '', unit.postcode ?? '', inferredCountry);
    }
    console.log(`[Revenue] Unit "${unit.unit_identifier}" in ${unit.city} → geocoded: ${coordinates ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}` : 'FAILED'}`);

    // Fetch real comps via scraper (or paid API if key set)
    const provider = getMarketDataProvider();
    // Never pass {lat:0,lng:0} — that disables distance filtering entirely
    const fetchCoords = coordinates ?? null;
    let marketResult: MarketDataResult;

    try {
      marketResult = await provider.fetchComps({
        coordinates: fetchCoords ?? { lat: 0, lng: 0 },
        bedrooms: unit.bedrooms ?? 2,
        bathrooms: unit.bathrooms ?? null,
        property_type: unit.unit_type ?? null,
        radius_km: 10,
        cityHint: unit.city,
        countryHint: inferredCountry,
        hasRealCoords: fetchCoords !== null,
      } as any);
    } catch (scrapeErr) {
      console.warn('Primary provider failed, using fallback:', (scrapeErr as Error).message);
      const { FallbackProvider } = await import('@/lib/marketData/fallback');
      const fb = new FallbackProvider();
      marketResult = await fb.fetchComps({
        coordinates: fetchCoords,
        bedrooms: unit.bedrooms ?? 2,
        bathrooms: unit.bathrooms ?? null,
        property_type: unit.unit_type ?? null,
        radius_km: 10,
        cityHint: unit.city,
      } as any);
    }

    const { comps, data_source, data_source_key, warning } = marketResult;

    // Market statistics
    const stats = computeMarketStats(comps, currentRent);

    // Hedonic pricing model — adjusts for size, bedrooms, and distance
    const subjectSqm: number | null = unit.sqm ?? unit.size_sqm ?? null;
    const hedonic = buildHedonicModel(comps, unit.bedrooms ?? 2, subjectSqm);

    const isLiveData = data_source_key !== 'fallback';
    const confidence = computeConfidence(stats, isLiveData, hedonic.model_confidence);
    const vacancyRisk = computeVacancyRisk(stats, stats.percentile);
    const elasticityCurve = buildElasticityCurve(vacancyRisk, currentRent);

    // Claude analysis — receives both raw stats AND hedonic model output
    let analysis = await callClaude(unit, currentRent, comps, stats, hedonic, vacancyRisk, confidence, data_source_key, data_source);
    if (!analysis) analysis = buildFallbackAnalysis(currentRent, stats, hedonic, vacancyRisk, confidence, unit.city, unit.bedrooms, inferredCountry);

    // Ensure confidence from our model overrides if Claude's is missing
    analysis.confidence_score = analysis.confidence_score ?? confidence;
    analysis.market_percentile = analysis.market_percentile ?? stats.percentile;

    // Currency symbol for this unit's market
    const sym = getCurrencySymbol(unit.city ?? '', inferredCountry);

    // Handle no-comps edge case
    if (comps.length === 0) {
      analysis.reasoning_summary = `No comparable listings found within 10km. Analysis is based on statistical modelling only. Confidence is low (${Math.round(confidence * 100)}%). Consider expanding search area or checking address accuracy.`;
    }

    // Persist recommendation
    await supabase.from('revenue_recommendations').insert({
      unit_id: unitId,
      landlord_id: landlordId,
      optimal_listing_price: analysis.optimal_listing_price,
      recommended_renewal_increase_pct: analysis.recommended_renewal_increase_percent,
      vacancy_risk_score: analysis.vacancy_risk_score,
      projected_days_on_market_min: analysis.projected_days_on_market?.[0],
      projected_days_on_market_max: analysis.projected_days_on_market?.[1],
      projected_annual_revenue_delta: analysis.projected_annual_revenue_delta,
      market_trend: analysis.market_trend,
      confidence_score: analysis.confidence_score,
      reasoning_summary: analysis.reasoning_summary,
      alternative_scenarios: analysis.alternative_scenarios,
      comps_snapshot: comps,
      current_rent: currentRent,
      market_median_rent: stats.median,
      market_percentile: analysis.market_percentile,
    });

    // Generate & persist alerts
    const alerts = generateAlerts(unit, analysis, currentRent, stats, sym);
    if (alerts.length > 0) {
      await supabase.from('market_alerts').insert(alerts.map(a => ({ ...a, unit_id: unitId, landlord_id: landlordId })));
    }

    return NextResponse.json({
      recommendation: analysis,
      comps,
      elasticityCurve,
      hedonic,
      stats: { ...stats, currentRent },
      alerts,
      meta: {
        data_source: data_source,
        data_source_key,
        geocoded: !!coordinates,
        warning: warning ?? null,
        fetched_at: marketResult.fetched_at,
        sample_size: comps.length,
        coverage_radius_km: marketResult.coverage_radius_km,
        season: seasonalityAdjustment(),
      },
    });
  } catch (error: any) {
    console.error('Revenue intelligence error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: history + unacknowledged alerts ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get('unitId');
  const landlordId = searchParams.get('landlordId');
  if (!landlordId) return NextResponse.json({ error: 'landlordId required' }, { status: 400 });

  const supabase = getSupabase();

  const recQuery = supabase.from('revenue_recommendations').select('*').eq('landlord_id', landlordId).order('created_at', { ascending: false }).limit(30);
  if (unitId) recQuery.eq('unit_id', unitId);

  const alertQuery = supabase.from('market_alerts').select('*').eq('landlord_id', landlordId).eq('acknowledged', false).order('created_at', { ascending: false }).limit(20);

  const [{ data: recs }, { data: alertsData }] = await Promise.all([recQuery, alertQuery]);
  return NextResponse.json({ recommendations: recs ?? [], alerts: alertsData ?? [] });
}
