-- xe_gr_listings: persistent store for scraped xe.gr rental listings
-- Supports:
--   • Deduplication by URL (primary key) and content fingerprint
--   • Price history (appended on each re-scrape if price changes)
--   • Freshness / completeness scoring for data quality tracking
--   • Days-on-market estimation (first_seen_at → last_seen_at delta)
--   • Absorption rate analytics (when status flips to 'inactive')

CREATE TABLE IF NOT EXISTS xe_gr_listings (
  -- ── Identity ──────────────────────────────────────────────────────────────
  id              TEXT        NOT NULL,                        -- xe.gr listing ID (numeric string)
  listing_url     TEXT        NOT NULL PRIMARY KEY,            -- canonical xe.gr URL (deduplicate key)
  content_fp      TEXT        GENERATED ALWAYS AS (           -- repost fingerprint (area|sqm|beds|price buckets)
                    lower(area) || '|' ||
                    (round(coalesce(sqm, 0) / 5) * 5)::text || '|' ||
                    coalesce(bedrooms, 0)::text || '|' ||
                    (round(coalesce(price_eur, 0) / 25) * 25)::text
                  ) STORED,

  -- ── Price ─────────────────────────────────────────────────────────────────
  price_eur       INTEGER     NOT NULL,                        -- current monthly rent (EUR)
  price_history   JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- [{price, recorded_at}]

  -- ── Property specs ────────────────────────────────────────────────────────
  bedrooms        SMALLINT,
  bathrooms       SMALLINT,
  sqm             NUMERIC(7,2),
  floor_level     SMALLINT,
  year_built      SMALLINT,
  property_type   TEXT        NOT NULL DEFAULT 'apartment',

  -- ── Location ──────────────────────────────────────────────────────────────
  area            TEXT        NOT NULL DEFAULT '',
  municipality    TEXT        NOT NULL DEFAULT '',
  region          TEXT        NOT NULL DEFAULT 'Attica',
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),

  -- ── Description & features ────────────────────────────────────────────────
  description     TEXT,
  amenities       TEXT[]      NOT NULL DEFAULT '{}',
  heating_type    TEXT,
  energy_class    TEXT,
  is_agency       BOOLEAN,
  is_furnished    BOOLEAN,
  has_parking     BOOLEAN,

  -- ── Temporal tracking ─────────────────────────────────────────────────────
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),          -- when we first scraped this listing
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),          -- most recent confirmed active sighting
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),          -- last time detail page was fetched
  status          TEXT        NOT NULL DEFAULT 'active'        -- 'active' | 'inactive' (disappeared from results)
    CHECK (status IN ('active', 'inactive')),

  -- ── Data quality ─────────────────────────────────────────────────────────
  completeness_score  SMALLINT NOT NULL DEFAULT 0,            -- 0–100 (how complete the extracted data is)
  source              TEXT     NOT NULL DEFAULT 'xe.gr'
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Fast lookup by region + beds for comp queries
CREATE INDEX IF NOT EXISTS idx_xelistings_area_beds
  ON xe_gr_listings (area, bedrooms, status);

-- Time-based queries for incremental crawl (only re-scrape stale listings)
CREATE INDEX IF NOT EXISTS idx_xelistings_scraped_at
  ON xe_gr_listings (scraped_at DESC);

-- Content fingerprint for repost detection
CREATE INDEX IF NOT EXISTS idx_xelistings_content_fp
  ON xe_gr_listings (content_fp);

-- Geo-spatial queries (when lat/lng available)
CREATE INDEX IF NOT EXISTS idx_xelistings_geo
  ON xe_gr_listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── Upsert helper function ────────────────────────────────────────────────────
-- Called by the crawler on each listing: inserts new, updates existing.
-- If price changes, appends the old price to price_history before updating.

CREATE OR REPLACE FUNCTION upsert_xe_gr_listing(
  p_id              TEXT,
  p_listing_url     TEXT,
  p_price_eur       INTEGER,
  p_bedrooms        SMALLINT,
  p_bathrooms       SMALLINT,
  p_sqm             NUMERIC,
  p_floor_level     SMALLINT,
  p_year_built      SMALLINT,
  p_property_type   TEXT,
  p_area            TEXT,
  p_municipality    TEXT,
  p_region          TEXT,
  p_latitude        NUMERIC,
  p_longitude       NUMERIC,
  p_description     TEXT,
  p_amenities       TEXT[],
  p_heating_type    TEXT,
  p_energy_class    TEXT,
  p_is_agency       BOOLEAN,
  p_is_furnished    BOOLEAN,
  p_has_parking     BOOLEAN,
  p_completeness_score SMALLINT
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  existing_price INTEGER;
BEGIN
  SELECT price_eur INTO existing_price
  FROM xe_gr_listings
  WHERE listing_url = p_listing_url;

  IF NOT FOUND THEN
    -- New listing: insert fresh
    INSERT INTO xe_gr_listings (
      id, listing_url, price_eur, bedrooms, bathrooms, sqm, floor_level,
      year_built, property_type, area, municipality, region,
      latitude, longitude, description, amenities, heating_type, energy_class,
      is_agency, is_furnished, has_parking, completeness_score
    ) VALUES (
      p_id, p_listing_url, p_price_eur, p_bedrooms, p_bathrooms, p_sqm,
      p_floor_level, p_year_built, p_property_type, p_area, p_municipality,
      p_region, p_latitude, p_longitude, p_description, p_amenities,
      p_heating_type, p_energy_class, p_is_agency, p_is_furnished,
      p_has_parking, p_completeness_score
    );
  ELSE
    -- Existing listing: update, appending old price to history if changed
    UPDATE xe_gr_listings SET
      price_eur     = p_price_eur,
      price_history = CASE
        WHEN existing_price IS DISTINCT FROM p_price_eur
        THEN price_history || jsonb_build_object('price', existing_price, 'recorded_at', now())
        ELSE price_history
      END,
      bedrooms      = COALESCE(p_bedrooms,    bedrooms),
      bathrooms     = COALESCE(p_bathrooms,   bathrooms),
      sqm           = COALESCE(p_sqm,         sqm),
      floor_level   = COALESCE(p_floor_level, floor_level),
      year_built    = COALESCE(p_year_built,  year_built),
      area          = CASE WHEN p_area <> '' THEN p_area ELSE area END,
      municipality  = CASE WHEN p_municipality <> '' THEN p_municipality ELSE municipality END,
      latitude      = COALESCE(p_latitude,    latitude),
      longitude     = COALESCE(p_longitude,   longitude),
      description   = COALESCE(p_description, description),
      amenities     = CASE WHEN array_length(p_amenities, 1) > 0 THEN p_amenities ELSE amenities END,
      heating_type  = COALESCE(p_heating_type,  heating_type),
      energy_class  = COALESCE(p_energy_class,  energy_class),
      is_agency     = COALESCE(p_is_agency,     is_agency),
      is_furnished  = COALESCE(p_is_furnished,  is_furnished),
      has_parking   = COALESCE(p_has_parking,   has_parking),
      completeness_score = GREATEST(completeness_score, p_completeness_score),
      last_seen_at  = now(),
      scraped_at    = now(),
      status        = 'active'
    WHERE listing_url = p_listing_url;
  END IF;
END;
$$;

-- ── Estimated days on market view ────────────────────────────────────────────
CREATE OR REPLACE VIEW xe_gr_listings_enriched AS
SELECT
  *,
  EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) / 86400 AS est_days_on_market,
  CASE
    WHEN completeness_score >= 70 THEN 'high'
    WHEN completeness_score >= 40 THEN 'medium'
    ELSE 'low'
  END AS data_quality
FROM xe_gr_listings;

-- ── RLS: allow service role full access ───────────────────────────────────────
ALTER TABLE xe_gr_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON xe_gr_listings
  FOR ALL USING (true);
