import { NextRequest, NextResponse } from 'next/server';

// Module-level cache — persists for the lifetime of the dev server process.
// Same address is only ever geocoded once.
const geoCache = new Map<string, { lat: number; lng: number } | null>();

// Promise queue — serialises all Nominatim requests with a 400ms gap.
// 400ms gives ~2.5 req/s which is well within Nominatim's limits for
// occasional/demo use while keeping pins loading quickly.
let requestQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = requestQueue.then(() => fn());
  // Advance the queue with a delay even on error so the next slot isn't blocked
  requestQueue = result.then(
    () => new Promise(r => setTimeout(r, 400)),
    () => new Promise(r => setTimeout(r, 400))
  );
  return result;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json(null, { status: 400 });

  // Serve from cache immediately — no queuing needed
  if (geoCache.has(q)) {
    return NextResponse.json(geoCache.get(q) ?? null);
  }

  const result = await enqueue(async () => {
    // Another enqueued request may have populated the cache while we waited
    if (geoCache.has(q)) return geoCache.get(q) ?? null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        {
          headers: {
            'User-Agent': 'PropAI/1.0 (hackathon-demo)',
            'Accept-Language': 'en',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        geoCache.set(q, null);
        return null;
      }

      const data = await res.json();
      const coords = data[0]
        ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
        : null;
      geoCache.set(q, coords);
      return coords;
    } catch {
      geoCache.set(q, null);
      return null;
    }
  });

  return NextResponse.json(result ?? null);
}
