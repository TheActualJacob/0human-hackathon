/**
 * RentCast API Provider
 * https://developers.rentcast.io/reference/
 *
 * Supports US markets only.
 * Set RENTCAST_API_KEY in .env.local to activate.
 *
 * To add a different provider (Zoopla UK, Idealista EU, etc.):
 * 1. Create a new file e.g. zoopla.ts implementing MarketDataProvider
 * 2. Register it in index.ts
 */

import type { MarketDataProvider, MarketDataQuery, MarketDataResult, RentalComp } from './provider';
import { distanceKm } from './geocoder';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';

// RentCast property type mapping → our normalised type
const TYPE_MAP: Record<string, string> = {
  'Single Family': 'house',
  'Condo': 'apartment',
  'Townhouse': 'townhouse',
  'Apartment': 'apartment',
  'Multi Family': 'apartment',
};

function normaliseType(t: string | null | undefined): string {
  if (!t) return 'apartment';
  return TYPE_MAP[t] ?? t.toLowerCase();
}

function similarityScore(comp: any, query: MarketDataQuery, distance: number): number {
  let score = 100;
  // Distance penalty (2 km max → -40 pts)
  score -= Math.min(40, (distance / query.radius_km) * 40);
  // Bathroom mismatch
  if (query.bathrooms != null && comp.bathrooms != null) {
    score -= Math.min(10, Math.abs((comp.bathrooms ?? 1) - (query.bathrooms ?? 1)) * 10);
  }
  // Property type mismatch
  if (query.property_type && normaliseType(comp.propertyType) !== query.property_type) {
    score -= 15;
  }
  return Math.max(0, Math.round(score));
}

export class RentCastProvider implements MarketDataProvider {
  name = 'RentCast';
  key = 'rentcast';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isAvailable() {
    return !!this.apiKey;
  }

  async fetchComps(query: MarketDataQuery): Promise<MarketDataResult> {
    const { coordinates, bedrooms, radius_km } = query;
    // RentCast uses miles; 2 km ≈ 1.24 miles
    const radiusMiles = (radius_km * 0.621371).toFixed(2);

    const params = new URLSearchParams({
      latitude: coordinates.lat.toString(),
      longitude: coordinates.lng.toString(),
      radius: radiusMiles,
      bedrooms: bedrooms.toString(),
      status: 'Active',
      limit: '50',
    });

    const res = await fetch(`${RENTCAST_BASE}/listings/rental/long-term?${params}`, {
      headers: { 'X-Api-Key': this.apiKey, Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`RentCast API error ${res.status}: ${await res.text()}`);
    }

    const raw: any[] = await res.json();
    const fetched_at = new Date().toISOString();

    // Filter & map
    const comps: RentalComp[] = [];
    for (const item of raw) {
      if (!item.price) continue;

      const compCoords = { lat: item.latitude, lng: item.longitude };
      const distance = distanceKm(coordinates, compCoords);
      if (distance > radius_km) continue;

      // Strict bedroom match
      if (item.bedrooms != null && Math.abs(item.bedrooms - bedrooms) > 0) continue;

      const dom = item.daysOnMarket ?? 0;
      const similarity = similarityScore(item, query, distance);

      comps.push({
        id: item.id ?? `rc-${comps.length}`,
        rent: item.price,
        bedrooms: item.bedrooms ?? bedrooms,
        bathrooms: item.bathrooms ?? null,
        sqft: item.squareFootage ?? null,
        property_type: normaliseType(item.propertyType),
        address: item.formattedAddress ?? 'Unknown',
        distance_km: parseFloat(distance.toFixed(2)),
        days_on_market: dom,
        status: 'active',
        listed_at: item.listedDate ?? null,
        leased_at: null,
        similarity_score: similarity,
        data_source: 'RentCast',
      });
    }

    comps.sort((a, b) => b.similarity_score - a.similarity_score);

    const warning = comps.length < 3
      ? `Only ${comps.length} comparable listing(s) found within ${radius_km}km. Confidence reduced.`
      : undefined;

    return {
      comps,
      data_source: 'RentCast API (Live)',
      data_source_key: 'rentcast',
      fetched_at,
      raw_count: raw.length,
      filtered_count: comps.length,
      coverage_radius_km: radius_km,
      warning,
    };
  }
}
