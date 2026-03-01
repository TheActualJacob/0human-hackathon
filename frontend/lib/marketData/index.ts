/**
 * Market Data Provider Factory
 *
 * Priority order (first available wins):
 *   1. RentCast      → RENTCAST_API_KEY (US markets)
 *   2. [Add more]    → e.g. Zoopla, Idealista, custom scraper
 *   3. Fallback      → Statistical model (always available)
 *
 * To add a new provider:
 *   1. Create lib/marketData/myprovider.ts implementing MarketDataProvider
 *   2. Instantiate it below and push to the providers array
 *   3. Set the API key in .env.local
 */

import { RentCastProvider } from './rentcast';
import { ScraperProvider } from './scraper';
import { FallbackProvider } from './fallback';
import type { MarketDataProvider } from './provider';

export function getMarketDataProvider(): MarketDataProvider {
  const providers: MarketDataProvider[] = [
    // Paid APIs (activate by setting key in .env.local)
    new RentCastProvider(process.env.RENTCAST_API_KEY ?? ''),
    // new ZooplaProvider(process.env.ZOOPLA_API_KEY ?? ''),

    // Free scraper (Rightmove for UK, xe.gr/Spitogatos for GR) — always available
    new ScraperProvider(),

    // Statistical fallback — always works, no network needed
    new FallbackProvider(),
  ];

  return providers.find(p => p.isAvailable()) ?? new FallbackProvider();
}

export type { MarketDataProvider, MarketDataResult, MarketDataQuery, RentalComp, Coordinates } from './provider';
