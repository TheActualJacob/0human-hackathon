/**
 * Free geocoding using OpenStreetMap Nominatim.
 * No API key required. Rate limit: 1 req/sec.
 *
 * Tries progressively less specific queries so that even if the exact street
 * address isn't in OSM, we still get city-level coordinates — which is enough
 * to make the distance filter work and return location-specific comps.
 *
 * Tier 1: full address + postcode + city + country
 * Tier 2: city + country  (almost always succeeds)
 * Tier 3: null
 */

import type { Coordinates } from './provider';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
}

async function nominatimQuery(query: string): Promise<Coordinates | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'PropAI/1.0 (property management platform)',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) return null;
    const results: NominatimResult[] = await res.json();
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  address: string,
  city?: string,
  postcode?: string,
  country?: string,
): Promise<Coordinates | null> {
  // Tier 1 — full address (most precise)
  const fullParts = [address, postcode, city, country].filter(Boolean).join(', ');
  if (fullParts) {
    const result = await nominatimQuery(fullParts);
    if (result) return result;
  }

  // Tier 2 — city + country (nearly always succeeds and still gives useful coords)
  const cityParts = [city, country].filter(Boolean).join(', ');
  if (cityParts) {
    // Small delay to respect Nominatim 1-req/sec rate limit
    await new Promise(r => setTimeout(r, 300));
    const result = await nominatimQuery(cityParts);
    if (result) return result;
  }

  return null;
}

/** Haversine distance between two lat/lng points in km */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}
