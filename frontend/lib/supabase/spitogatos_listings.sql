-- spitogatos_listings: persistent store for scraped Spitogatos.gr rental listings
--
-- Populated by:  scripts/scrapeSpitogatos.ts  (run manually from your terminal)
-- Queried by:    lib/marketData/scraper.ts     (ScraperProvider checks DB first)
--
-- Run this migration once in your Supabase SQL editor before running the script.

CREATE TABLE IF NOT EXISTS spitogatos_listings (
  -- ── Identity ──────────────────────────────────────────────────────────────
  id              TEXT        NOT NULL,
  listing_url     TEXT        NOT NULL UNIQUE,

  -- ── Price ─────────────────────────────────────────────────────────────────
  price_eur       INTEGER     NOT NULL CHECK (price_eur >= 50 AND price_eur <= 50000),
  price_history   JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- ── Property specs ────────────────────────────────────────────────────────
  bedrooms        SMALLINT,
  bathrooms       SMALLINT,
  sqm             NUMERIC(7, 2),
  floor_level     SMALLINT,
  year_built      SMALLINT,
  property_type   TEXT        NOT NULL DEFAULT 'apartment',

  -- ── Location ──────────────────────────────────────────────────────────────
  area            TEXT        NOT NULL DEFAULT '',
  municipality    TEXT        NOT NULL DEFAULT '',
  region          TEXT        NOT NULL DEFAULT 'Attica',
  latitude        NUMERIC(10, 7),
  longitude       NUMERIC(10, 7),

  -- ── Details ───────────────────────────────────────────────────────────────
  description     TEXT,
  amenities       TEXT[]      NOT NULL DEFAULT '{}',
  heating_type    TEXT,
  energy_class    TEXT,
  is_agency       BOOLEAN,
  is_furnished    BOOLEAN,
  has_parking     BOOLEAN,

  -- ── Tracking ──────────────────────────────────────────────────────────────
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),

  -- ── Quality ───────────────────────────────────────────────────────────────
  completeness_score SMALLINT NOT NULL DEFAULT 0
);

-- ── Primary key ───────────────────────────────────────────────────────────────
ALTER TABLE spitogatos_listings
  ADD CONSTRAINT spitogatos_listings_pkey PRIMARY KEY (listing_url);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Main lookup: area + bedrooms (most frequent query pattern from the revenue engine)
CREATE INDEX IF NOT EXISTS idx_sg_area_beds
  ON spitogatos_listings (region, bedrooms, status);

-- Freshness queries (find stale listings for re-scrape)
CREATE INDEX IF NOT EXISTS idx_sg_scraped_at
  ON spitogatos_listings (scraped_at DESC);

-- Geo queries
CREATE INDEX IF NOT EXISTS idx_sg_geo
  ON spitogatos_listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── Price-change tracking function ───────────────────────────────────────────
-- Upserts a listing: inserts new, updates existing, tracks price history.
CREATE OR REPLACE FUNCTION upsert_spitogatos_listing(
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
  p_completeness    SMALLINT
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  existing_price INTEGER;
BEGIN
  SELECT price_eur INTO existing_price
  FROM spitogatos_listings WHERE listing_url = p_listing_url;

  IF NOT FOUND THEN
    INSERT INTO spitogatos_listings (
      id, listing_url, price_eur,
      bedrooms, bathrooms, sqm, floor_level, year_built, property_type,
      area, municipality, region, latitude, longitude,
      description, amenities, heating_type, energy_class,
      is_agency, is_furnished, has_parking, completeness_score
    ) VALUES (
      p_id, p_listing_url, p_price_eur,
      p_bedrooms, p_bathrooms, p_sqm, p_floor_level, p_year_built, p_property_type,
      p_area, p_municipality, p_region, p_latitude, p_longitude,
      p_description, p_amenities, p_heating_type, p_energy_class,
      p_is_agency, p_is_furnished, p_has_parking, p_completeness
    );
  ELSE
    UPDATE spitogatos_listings SET
      price_eur    = p_price_eur,
      price_history = CASE
        WHEN existing_price IS DISTINCT FROM p_price_eur
        THEN price_history || jsonb_build_object('price', existing_price, 'recorded_at', now())
        ELSE price_history
      END,
      bedrooms     = COALESCE(p_bedrooms,    bedrooms),
      bathrooms    = COALESCE(p_bathrooms,   bathrooms),
      sqm          = COALESCE(p_sqm,         sqm),
      floor_level  = COALESCE(p_floor_level, floor_level),
      year_built   = COALESCE(p_year_built,  year_built),
      area         = CASE WHEN p_area <> '' THEN p_area ELSE area END,
      municipality = CASE WHEN p_municipality <> '' THEN p_municipality ELSE municipality END,
      latitude     = COALESCE(p_latitude,    latitude),
      longitude    = COALESCE(p_longitude,   longitude),
      description  = COALESCE(p_description, description),
      amenities    = CASE WHEN array_length(p_amenities,1) > 0 THEN p_amenities ELSE amenities END,
      heating_type = COALESCE(p_heating_type,  heating_type),
      energy_class = COALESCE(p_energy_class,  energy_class),
      is_agency    = COALESCE(p_is_agency,     is_agency),
      is_furnished = COALESCE(p_is_furnished,  is_furnished),
      has_parking  = COALESCE(p_has_parking,   has_parking),
      completeness_score = GREATEST(completeness_score, p_completeness),
      last_seen_at = now(),
      scraped_at   = now(),
      status       = 'active'
    WHERE listing_url = p_listing_url;
  END IF;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE spitogatos_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON spitogatos_listings
  FOR ALL USING (true);
