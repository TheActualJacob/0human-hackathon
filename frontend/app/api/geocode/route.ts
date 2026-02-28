import { NextRequest, NextResponse } from 'next/server';

// Only cache successful results — never cache nulls so transient failures
// (rate limits, network blips) don't permanently poison the cache.
const geoCache = new Map<string, { lat: number; lng: number }>();

// Deduplicates concurrent requests for the same query so rapid page loads
// don't fan out into duplicate network calls.
const inFlight = new Map<string, Promise<{ lat: number; lng: number } | null>>();

async function fetchFromPhoton(q: string): Promise<{ lat: number; lng: number } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lat, lng };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json(null, { status: 400 });

  if (geoCache.has(q)) {
    return NextResponse.json(geoCache.get(q));
  }

  // Deduplicate concurrent identical requests
  if (inFlight.has(q)) {
    const result = await inFlight.get(q)!;
    return NextResponse.json(result ?? null);
  }

  const promise = fetchFromPhoton(q).then(result => {
    inFlight.delete(q);
    if (result) geoCache.set(q, result);
    return result;
  });

  inFlight.set(q, promise);
  const result = await promise;
  return NextResponse.json(result ?? null);
}
