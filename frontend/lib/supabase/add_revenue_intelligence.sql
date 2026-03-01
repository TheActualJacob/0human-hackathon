-- Revenue Intelligence tables
-- Run this in your Supabase SQL Editor

-- Revenue Intelligence tables
-- Run this FULL script in Supabase SQL Editor
-- If you already ran a previous version, the ALTER TABLE statements below handle upgrades safely.

CREATE TABLE IF NOT EXISTS revenue_recommendations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id          UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  landlord_id      UUID NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Claude outputs
  optimal_listing_price              NUMERIC,
  recommended_renewal_increase_pct   NUMERIC,
  vacancy_risk_score                 NUMERIC,
  projected_days_on_market_min       INTEGER,
  projected_days_on_market_max       INTEGER,
  projected_annual_revenue_delta     NUMERIC,
  market_trend                       TEXT CHECK (market_trend IN ('tightening','stable','softening')),
  confidence_score                   NUMERIC,
  reasoning_summary                  TEXT,
  alternative_scenarios              JSONB DEFAULT '[]'::jsonb,

  -- Raw AI input snapshot
  comps_snapshot                     JSONB DEFAULT '[]'::jsonb,
  current_rent                       NUMERIC,
  market_median_rent                 NUMERIC,
  market_percentile                  NUMERIC
);

CREATE TABLE IF NOT EXISTS market_alerts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id       UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  landlord_id   UUID NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  acknowledged  BOOLEAN DEFAULT FALSE,

  alert_type    TEXT NOT NULL,   -- 'vacancy_risk' | 'market_shift' | 'price_deviation' | 'action_required'
  severity      TEXT NOT NULL,   -- 'info' | 'warning' | 'critical'
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  revenue_impact NUMERIC         -- estimated £ impact
);

-- Add new columns to existing table (safe to run on fresh or existing installs)
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS data_source_key   TEXT DEFAULT 'fallback';
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS data_source_label TEXT;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS geocoded_lat      NUMERIC;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS geocoded_lng      NUMERIC;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS sample_size       INTEGER;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS avg_dom           NUMERIC;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS std_dev           NUMERIC;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS seasonal_note     TEXT;
ALTER TABLE revenue_recommendations ADD COLUMN IF NOT EXISTS absorption_signal TEXT;

CREATE INDEX IF NOT EXISTS idx_rev_recs_unit      ON revenue_recommendations(unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rev_recs_landlord  ON revenue_recommendations(landlord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_landlord    ON market_alerts(landlord_id, acknowledged, created_at DESC);

ALTER TABLE revenue_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_alerts           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for revenue_recommendations" ON revenue_recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for market_alerts"           ON market_alerts           FOR ALL USING (true) WITH CHECK (true);
