/**
 * Statistical Fallback Provider
 *
 * Generates a realistic comp distribution when no live API key is configured.
 * Uses city-level rental price indices, proper variance (normal distribution),
 * and realistic ADOM distributions based on market tier.
 *
 * Replace with a real provider (rentcast.ts, zoopla.ts, etc.) by setting
 * the corresponding API key in .env.local.
 */

import type { MarketDataProvider, MarketDataQuery, MarketDataResult, RentalComp } from './provider';

// City-tier rental indices (approximate median PCM in GBP-equivalent)
// Used to anchor synthetic rents realistically to market context
const CITY_INDEX: Record<string, { medianPcm: number; tier: 'prime' | 'secondary' | 'tertiary'; currency: string }> = {
  // UK
  london: { medianPcm: 2200, tier: 'prime', currency: '£' },
  manchester: { medianPcm: 1300, tier: 'secondary', currency: '£' },
  birmingham: { medianPcm: 1100, tier: 'secondary', currency: '£' },
  edinburgh: { medianPcm: 1400, tier: 'secondary', currency: '£' },
  bristol: { medianPcm: 1350, tier: 'secondary', currency: '£' },
  leeds: { medianPcm: 1050, tier: 'secondary', currency: '£' },
  // Greece
  athens: { medianPcm: 750, tier: 'secondary', currency: '€' },
  papagou: { medianPcm: 800, tier: 'secondary', currency: '€' },
  thessaloniki: { medianPcm: 550, tier: 'tertiary', currency: '€' },
  // Netherlands
  amsterdam: { medianPcm: 1800, tier: 'prime', currency: '€' },
  // Germany
  berlin: { medianPcm: 1400, tier: 'secondary', currency: '€' },
  munich: { medianPcm: 2000, tier: 'prime', currency: '€' },
  // Spain
  madrid: { medianPcm: 1300, tier: 'secondary', currency: '€' },
  barcelona: { medianPcm: 1500, tier: 'secondary', currency: '€' },
};

const TIER_ADOM: Record<string, { mean: number; std: number }> = {
  prime:     { mean: 6,  std: 3 },
  secondary: { mean: 12, std: 5 },
  tertiary:  { mean: 22, std: 8 },
};

/** Box-Muller normal sample */
function sampleNormal(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function lookupCity(city?: string): { medianPcm: number; tier: 'prime' | 'secondary' | 'tertiary'; currency: string } {
  if (!city) return { medianPcm: 1200, tier: 'secondary', currency: '£' };
  const key = city.toLowerCase().trim();
  for (const [k, v] of Object.entries(CITY_INDEX)) {
    if (key.includes(k)) return v;
  }
  return { medianPcm: 1000, tier: 'tertiary', currency: '£' };
}

export class FallbackProvider implements MarketDataProvider {
  name = 'Statistical Model';
  key = 'fallback';

  isAvailable() { return true; }

  async fetchComps(query: MarketDataQuery): Promise<MarketDataResult> {
    const { bedrooms, coordinates } = query;
    const cityHint = (query as any).cityHint as string | undefined;
    const market = lookupCity(cityHint);
    const adomParams = TIER_ADOM[market.tier];

    // Bedroom scalar: studios/1-bed cheaper, 3+ more expensive
    const bedroomScalar = 0.6 + Math.min(bedrooms, 5) * 0.2;
    const baseRent = market.medianPcm * bedroomScalar;

    // Generate 10 comps with realistic normal distribution
    const comps: RentalComp[] = [];
    const N = 8 + Math.floor(Math.random() * 5); // 8–12 comps

    for (let i = 0; i < N; i++) {
      const rent = Math.max(100, Math.round(sampleNormal(baseRent, baseRent * 0.09)));
      const dom = Math.max(0, Math.round(sampleNormal(adomParams.mean, adomParams.std)));
      const distKm = parseFloat((Math.random() * query.radius_km).toFixed(2));
      const sqft = bedrooms > 0
        ? Math.round(sampleNormal(350 + bedrooms * 120, 60))
        : Math.round(sampleNormal(350, 40));

      // Similarity: closer + same rent band = higher score
      const rentDevPct = Math.abs(rent - baseRent) / baseRent;
      const similarity = Math.max(35, Math.round(100 - rentDevPct * 80 - (distKm / query.radius_km) * 20));

      comps.push({
        id: `fallback-${i}`,
        rent,
        bedrooms,
        bathrooms: bedrooms > 2 ? 2 : 1,
        sqft,
        property_type: query.property_type ?? 'apartment',
        address: `Comparable ${i + 1}`,
        distance_km: distKm,
        days_on_market: dom,
        status: dom < 5 ? 'active' : i % 3 === 0 ? 'recently_leased' : 'active',
        listed_at: null,
        leased_at: null,
        similarity_score: similarity,
        data_source: 'Statistical Model',
      });
    }

    comps.sort((a, b) => b.similarity_score - a.similarity_score);

    return {
      comps,
      data_source: 'Statistical Market Model (No live API key set)',
      data_source_key: 'fallback',
      fetched_at: new Date().toISOString(),
      raw_count: N,
      filtered_count: N,
      coverage_radius_km: query.radius_km,
      warning: 'Synthetic data — connect a real market data API for live comps. See lib/marketData/rentcast.ts.',
    };
  }
}
