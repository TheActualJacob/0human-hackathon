/**
 * Market Data Provider Interface
 *
 * Abstracts the source of comparable rental listings.
 * Plug in any data provider (RentCast, Zoopla, Idealista, etc.)
 * by implementing MarketDataProvider and updating the factory in index.ts.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RentalComp {
  id: string;
  rent: number;               // monthly rent in local currency
  bedrooms: number;
  bathrooms: number | null;
  sqft: number | null;
  sqm: number | null;         // square metres (used for hedonic model)
  property_type: string;
  address: string;
  distance_km: number;
  days_on_market: number;     // 0 if currently active listing
  status: 'active' | 'recently_leased';
  listed_at: string | null;   // ISO date
  leased_at: string | null;   // ISO date, null if still active
  similarity_score: number;   // 0–100, calculated by the engine
  data_source: string;
}

export interface MarketDataResult {
  comps: RentalComp[];
  data_source: string;           // human-readable label e.g. "RentCast API"
  data_source_key: string;       // machine key e.g. "rentcast" | "fallback"
  fetched_at: string;            // ISO timestamp
  raw_count: number;             // listings fetched before filtering
  filtered_count: number;        // listings after bedroom/type filtering
  coverage_radius_km: number;
  warning?: string;              // e.g. "Low sample size – confidence reduced"
}

export interface MarketDataQuery {
  coordinates: Coordinates;
  bedrooms: number;
  bathrooms?: number | null;
  property_type?: string | null;
  radius_km: number;
  currency?: string;
}

export interface MarketDataProvider {
  name: string;
  key: string;
  isAvailable(): boolean;
  fetchComps(query: MarketDataQuery): Promise<MarketDataResult>;
}
