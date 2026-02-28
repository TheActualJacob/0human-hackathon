-- ============================================================
-- Lease Renewal Tracking + Instagram Listing Migration
-- ============================================================

-- Add renewal tracking columns to leases table
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS renewal_inquiry_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS renewal_status TEXT CHECK (renewal_status IN ('pending', 'renewing', 'not_renewing'));

-- Update landlord_notifications notification_type constraint to include 'property_listed'
ALTER TABLE landlord_notifications
    DROP CONSTRAINT IF EXISTS landlord_notifications_notification_type_check;

ALTER TABLE landlord_notifications
    ADD CONSTRAINT landlord_notifications_notification_type_check
    CHECK (notification_type IN (
        'emergency_maintenance', 'legal_notice_issued', 'eviction_started',
        'tenant_vacated', 'dispute_ruled', 'rent_overdue', 'compliance_expiry',
        'payment_received', 'general', 'signature_required', 'property_listed'
    ));

-- Add instagram_post_url to track the live post after publishing
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS instagram_post_url TEXT,
    ADD COLUMN IF NOT EXISTS instagram_image_url TEXT;

-- Create indexes for the cron job queries
CREATE INDEX IF NOT EXISTS idx_leases_end_date ON leases (end_date);
CREATE INDEX IF NOT EXISTS idx_leases_renewal_status ON leases (renewal_status);
CREATE INDEX IF NOT EXISTS idx_leases_renewal_inquiry_sent_at ON leases (renewal_inquiry_sent_at);
