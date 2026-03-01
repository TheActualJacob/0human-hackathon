-- ============================================================
-- Predictive Maintenance Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Asset Registry: one row per tracked appliance/system per unit
CREATE TABLE IF NOT EXISTS pm_assets (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id               UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  landlord_id           UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  asset_name            TEXT NOT NULL,
  asset_type            TEXT NOT NULL CHECK (asset_type IN (
    'boiler','hvac','plumbing','electrical','roof',
    'washing_machine','dishwasher','refrigerator','oven',
    'elevator','intercom','windows','water_heater','other'
  )),
  brand                 TEXT,
  model                 TEXT,
  installation_year     INT,
  warranty_expiry       DATE,
  environment_context   TEXT DEFAULT 'urban' CHECK (environment_context IN ('urban','coastal','rural','humid','dry')),
  usage_intensity       TEXT DEFAULT 'medium' CHECK (usage_intensity IN ('low','medium','high')),
  last_service_date     DATE,
  expected_lifespan_years INT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance Event Log: repair history per asset
CREATE TABLE IF NOT EXISTS pm_maintenance_events (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id              UUID NOT NULL REFERENCES pm_assets(id) ON DELETE CASCADE,
  event_date            DATE NOT NULL,
  issue_description     TEXT NOT NULL,
  severity              TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  cost                  NUMERIC,
  resolution_time_days  INT,
  vendor_notes          TEXT,
  tenant_complaint_text TEXT,
  resolved              BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Prediction outputs from Claude (stored per analysis run)
CREATE TABLE IF NOT EXISTS pm_predictions (
  id                                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id                              UUID NOT NULL REFERENCES pm_assets(id) ON DELETE CASCADE,
  generated_at                          TIMESTAMPTZ DEFAULT NOW(),
  failure_probability_6_months          NUMERIC,
  failure_probability_12_months         NUMERIC,
  estimated_cost_min                    NUMERIC,
  estimated_cost_max                    NUMERIC,
  preventative_replacement_recommended  BOOLEAN,
  urgency_level                         TEXT CHECK (urgency_level IN ('low','moderate','high','critical')),
  risk_drivers                          JSONB DEFAULT '[]',
  projected_financial_exposure          NUMERIC,
  confidence_score                      NUMERIC,
  reasoning_summary                     TEXT,
  raw_response                          JSONB
);

-- Tenant complaint signals mapped to assets
CREATE TABLE IF NOT EXISTS pm_tenant_signals (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id                   UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  asset_id                  UUID REFERENCES pm_assets(id),
  complaint_text            TEXT NOT NULL,
  mapped_asset_category     TEXT,
  escalation_probability    NUMERIC,
  risk_impact               TEXT,
  submitted_at              TIMESTAMPTZ DEFAULT NOW(),
  maintenance_request_id    UUID REFERENCES maintenance_requests(id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS pm_assets_unit_id_idx ON pm_assets(unit_id);
CREATE INDEX IF NOT EXISTS pm_assets_landlord_id_idx ON pm_assets(landlord_id);
CREATE INDEX IF NOT EXISTS pm_maintenance_events_asset_id_idx ON pm_maintenance_events(asset_id);
CREATE INDEX IF NOT EXISTS pm_predictions_asset_id_idx ON pm_predictions(asset_id);
CREATE INDEX IF NOT EXISTS pm_predictions_generated_at_idx ON pm_predictions(generated_at DESC);
CREATE INDEX IF NOT EXISTS pm_tenant_signals_unit_id_idx ON pm_tenant_signals(unit_id);

-- RLS: landlords can only see their own data
ALTER TABLE pm_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_tenant_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_assets_landlord_policy ON pm_assets
  USING (landlord_id IN (
    SELECT id FROM landlords WHERE id = pm_assets.landlord_id
  ));

CREATE POLICY pm_maintenance_events_policy ON pm_maintenance_events
  USING (asset_id IN (SELECT id FROM pm_assets));

CREATE POLICY pm_predictions_policy ON pm_predictions
  USING (asset_id IN (SELECT id FROM pm_assets));

CREATE POLICY pm_tenant_signals_policy ON pm_tenant_signals
  USING (unit_id IN (SELECT id FROM units));
