-- ============================================================
-- Autonomous Lease Renegotiation & Revenue Optimization Engine
-- Migration: 001_renewal_engine.sql
-- Run in Supabase SQL editor or via psql
-- ============================================================

-- ── renewal_scores ───────────────────────────────────────────
-- One row per lease per scoring run. Stores the latest AI-computed
-- renewal probability and revenue projections.
CREATE TABLE IF NOT EXISTS renewal_scores (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id                    UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    renewal_probability         FLOAT NOT NULL CHECK (renewal_probability BETWEEN 0 AND 1),
    churn_probability           FLOAT NOT NULL CHECK (churn_probability BETWEEN 0 AND 1),
    recommended_increase_pct    FLOAT NOT NULL DEFAULT 0,
    projected_revenue_12m       FLOAT NOT NULL DEFAULT 0,
    projected_revenue_24m       FLOAT NOT NULL DEFAULT 0,
    confidence_score            FLOAT NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
    -- Raw inputs stored for auditability and future ML training
    input_snapshot              JSONB,
    model_version               TEXT NOT NULL DEFAULT 'weighted-v1',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_scores_lease_id   ON renewal_scores(lease_id);
CREATE INDEX IF NOT EXISTS idx_renewal_scores_created_at ON renewal_scores(created_at DESC);

-- ── renewal_scenarios ────────────────────────────────────────
-- Price simulation output: one row per (lease, increase %) scenario.
CREATE TABLE IF NOT EXISTS renewal_scenarios (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id                        UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    renewal_score_id                UUID REFERENCES renewal_scores(id) ON DELETE SET NULL,
    increase_pct                    FLOAT NOT NULL,
    projected_renewal_probability   FLOAT NOT NULL,
    projected_revenue_12m           FLOAT NOT NULL,
    projected_revenue_24m           FLOAT NOT NULL,
    vacancy_risk                    FLOAT NOT NULL DEFAULT 0,
    turnover_cost_estimate          FLOAT NOT NULL DEFAULT 0,
    expected_value                  FLOAT NOT NULL DEFAULT 0,
    risk_label                      TEXT NOT NULL DEFAULT 'moderate'
                                        CHECK (risk_label IN ('low','moderate','high')),
    is_recommended                  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_scenarios_lease_id ON renewal_scenarios(lease_id);

-- ── renewal_offers ───────────────────────────────────────────
-- One row per outbound proposal sent to a tenant.
CREATE TABLE IF NOT EXISTS renewal_offers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id            UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    proposed_rent       FLOAT NOT NULL,
    lease_duration_months INTEGER NOT NULL DEFAULT 12,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','accepted','rejected','countered','withdrawn','expired')),
    channel             TEXT NOT NULL DEFAULT 'whatsapp'
                            CHECK (channel IN ('email','whatsapp','sms','in_app')),
    sent_at             TIMESTAMPTZ,
    responded_at        TIMESTAMPTZ,
    follow_up_sent_at   TIMESTAMPTZ,
    follow_up_count     INT NOT NULL DEFAULT 0,
    ai_generated_content JSONB,   -- full generated offer (subject, body, options JSON)
    landlord_notes      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_offers_lease_id ON renewal_offers(lease_id);
CREATE INDEX IF NOT EXISTS idx_renewal_offers_status   ON renewal_offers(status);

-- ── renewal_negotiation_logs ─────────────────────────────────
-- Conversation turns during the negotiation phase.
CREATE TABLE IF NOT EXISTS renewal_negotiation_logs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    renewal_offer_id            UUID NOT NULL REFERENCES renewal_offers(id) ON DELETE CASCADE,
    lease_id                    UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    tenant_message              TEXT,
    sentiment_score             FLOAT CHECK (sentiment_score BETWEEN -1 AND 1),
    sentiment_label             TEXT CHECK (sentiment_label IN ('positive','neutral','negative')),
    classification              TEXT CHECK (classification IN ('accepting','negotiating','resistant','unclear')),
    ai_suggested_response       TEXT,
    ai_suggested_counter_rent   FLOAT,
    ai_new_renewal_probability  FLOAT,
    landlord_decision           TEXT CHECK (landlord_decision IN ('accept','counter','reject','escalate',NULL)),
    landlord_decision_at        TIMESTAMPTZ,
    raw_ai_output               JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_neg_logs_offer_id ON renewal_negotiation_logs(renewal_offer_id);
CREATE INDEX IF NOT EXISTS idx_renewal_neg_logs_lease_id ON renewal_negotiation_logs(lease_id);

-- ── renewal_outcome_feedback ─────────────────────────────────
-- Stores actual outcomes for model calibration (feedback loop).
CREATE TABLE IF NOT EXISTS renewal_outcome_feedback (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id                UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    renewal_offer_id        UUID REFERENCES renewal_offers(id) ON DELETE SET NULL,
    increase_pct_offered    FLOAT,
    increase_pct_accepted   FLOAT,
    outcome                 TEXT NOT NULL CHECK (outcome IN ('renewed','churned','pending')),
    actual_revenue_12m      FLOAT,
    region                  TEXT,
    property_type           TEXT,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger helper ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_renewal_offers_updated_at ON renewal_offers;
CREATE TRIGGER set_renewal_offers_updated_at
    BEFORE UPDATE ON renewal_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
