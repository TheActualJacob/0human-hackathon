// Only cache successes — nulls are never stored so transient failures are retried.
const clientCache = new Map<string, { lat: number; lng: number }>();
const inFlight = new Map<string, Promise<{ lat: number; lng: number } | null>>();

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
      if (result) clientCache.set(query, result);
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
