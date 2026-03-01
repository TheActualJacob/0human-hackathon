/**
 * POST /api/xe-gr/crawl
 *
 * Triggers a structured, rate-limited xe.gr crawl for a city + bedroom count.
 * Results are:
 *   1. Returned immediately in the response (for direct use by the revenue engine)
 *   2. Optionally persisted to Supabase xe_gr_listings table (if DB is configured)
 *
 * Request body:
 *   {
 *     city:      string,   // e.g. "athens", "thessaloniki"
 *     bedrooms:  number,   // e.g. 3
 *     maxResults?: number, // default 25
 *     persist?:  boolean,  // default true — save to Supabase
 *   }
 *
 * Response:
 *   {
 *     listings: XeGrListing[],
 *     count:    number,
 *     log:      string[],          // per-step progress messages
 *     duration_ms: number,
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlXeGr, type XeGrListing } from '@/lib/marketData/xeGrCrawler';

// Optional: persist to Supabase. Only runs if env vars are present.
async function persistListings(listings: XeGrListing[]): Promise<{ saved: number; errors: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { saved: 0, errors: 0 };
  }

  let saved = 0;
  let errors = 0;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Upsert in batches of 10 to avoid timeouts
    const BATCH = 10;
    for (let i = 0; i < listings.length; i += BATCH) {
      const batch = listings.slice(i, i + BATCH);
      const rows = batch.map(l => ({
        id:                l.id,
        listing_url:       l.listing_url,
        price_eur:         l.price_eur,
        bedrooms:          l.bedrooms,
        bathrooms:         l.bathrooms,
        sqm:               l.sqm,
        floor_level:       l.floor_level,
        year_built:        l.year_built,
        property_type:     l.property_type,
        area:              l.area,
        municipality:      l.municipality,
        region:            'Attica',
        latitude:          l.lat,
        longitude:         l.lng,
        description:       l.description,
        amenities:         l.amenities,
        heating_type:      l.heating_type,
        energy_class:      l.energy_class,
        is_agency:         l.is_agency,
        is_furnished:      l.is_furnished,
        has_parking:       l.has_parking,
        completeness_score: l.completeness_score,
        scraped_at:        l.scraped_at,
        last_seen_at:      l.scraped_at,
        status:            'active',
      }));

      const { error } = await supabase
        .from('xe_gr_listings')
        .upsert(rows, { onConflict: 'listing_url' });

      if (error) {
        errors += batch.length;
        console.error('[xe-gr/crawl] Supabase upsert error:', error.message);
      } else {
        saved += batch.length;
      }
    }
  } catch (e) {
    console.error('[xe-gr/crawl] Persist failed:', (e as Error).message);
    errors = listings.length;
  }

  return { saved, errors };
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const log: string[] = [];

  let body: { city?: string; bedrooms?: number; maxResults?: number; persist?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const city       = (body.city ?? 'athens').toLowerCase().trim();
  const bedrooms   = Math.max(1, Math.min(10, Math.round(body.bedrooms ?? 3)));
  const maxResults = Math.max(5, Math.min(50, body.maxResults ?? 25));
  const persist    = body.persist !== false; // default true

  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }

  log.push(`[xe-gr/crawl] city="${city}" bedrooms=${bedrooms} maxResults=${maxResults}`);

  try {
    // Run the professional structured crawl
    const listings = await crawlXeGr(city, bedrooms, {
      maxResults,
      onProgress: (msg) => {
        log.push(msg);
        console.log(msg);
      },
    });

    log.push(`[xe-gr/crawl] Crawl complete: ${listings.length} listings`);

    // Optionally persist to Supabase
    if (persist && listings.length > 0) {
      const { saved, errors } = await persistListings(listings);
      log.push(`[xe-gr/crawl] Persisted: ${saved} saved, ${errors} errors`);
    }

    const duration_ms = Date.now() - start;
    log.push(`[xe-gr/crawl] Total time: ${duration_ms}ms`);

    return NextResponse.json({
      listings,
      count:       listings.length,
      log,
      duration_ms,
      meta: {
        city,
        bedrooms,
        avg_completeness: listings.length > 0
          ? Math.round(listings.reduce((s, l) => s + l.completeness_score, 0) / listings.length)
          : 0,
        with_coordinates: listings.filter(l => l.lat && l.lng).length,
        with_sqm:         listings.filter(l => l.sqm).length,
        with_description: listings.filter(l => l.description && l.description.length > 20).length,
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    log.push(`[xe-gr/crawl] Fatal error: ${msg}`);
    console.error('[xe-gr/crawl] Fatal:', msg);

    return NextResponse.json(
      { error: msg, log, duration_ms: Date.now() - start },
      { status: 500 },
    );
  }
}

// Allow GET for quick health-check / test
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'xe.gr professional crawler endpoint',
    usage: 'POST with { city, bedrooms, maxResults?, persist? }',
    example: { city: 'athens', bedrooms: 3, maxResults: 25 },
  });
}
