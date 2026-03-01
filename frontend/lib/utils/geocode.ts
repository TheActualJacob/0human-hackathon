const STORAGE_KEY = 'propai_geocache_v1';
const MAX_CACHE_ENTRIES = 500;

// In-memory cache for the current session
const clientCache = new Map<string, { lat: number; lng: number }>();
const inFlight = new Map<string, Promise<{ lat: number; lng: number } | null>>();

// Load persisted cache from localStorage on first import
function loadPersistedCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored: Record<string, { lat: number; lng: number }> = JSON.parse(raw);
    for (const [key, val] of Object.entries(stored)) {
      clientCache.set(key, val);
    }
  } catch {
    // localStorage unavailable (SSR) or corrupt — skip silently
  }
}

function persistCache() {
  try {
    const entries = Array.from(clientCache.entries());
    // Keep only the most recent MAX_CACHE_ENTRIES to avoid unbounded growth
    const trimmed = entries.slice(-MAX_CACHE_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    // Quota exceeded or unavailable — skip silently
  }
}

if (typeof window !== 'undefined') {
  loadPersistedCache();
}

async function fetchGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (clientCache.has(query)) return clientCache.get(query)!;
  if (inFlight.has(query)) return inFlight.get(query)!;

  const promise = fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
    .then(async res => {
      if (!res.ok) return null;
      return res.json() as Promise<{ lat: number; lng: number } | null>;
    })
    .catch(() => null)
    .then(result => {
      inFlight.delete(query);
      if (result) {
        clientCache.set(query, result);
        persistCache();
      }
      return result;
    });

  inFlight.set(query, promise);
  return promise;
}

export async function geocodeAddress(
  address: string,
  postcode?: string | null,
  city?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const queries = [
    [address, postcode, city].filter(Boolean).join(', '),
    [city].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const query of queries) {
    const result = await fetchGeocode(query);
    if (result) return result;
  }
  return null;
}
