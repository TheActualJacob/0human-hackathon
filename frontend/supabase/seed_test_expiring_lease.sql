-- ============================================================
-- Test: Expiring Lease Seed
-- Creates a landlord, unit, lease expiring in 30 days,
-- and a tenant with WhatsApp +13369971342
-- Safe to re-run (uses fixed UUIDs with ON CONFLICT DO NOTHING)
-- ============================================================

-- Fixed UUIDs so re-running is safe
DO $$
DECLARE
    v_landlord_id UUID := 'a1000000-0000-0000-0000-000000000001';
    v_unit_id     UUID := 'a2000000-0000-0000-0000-000000000002';
    v_lease_id    UUID := 'a3000000-0000-0000-0000-000000000003';
    v_tenant_id   UUID := 'a4000000-0000-0000-0000-000000000004';
    v_expire_date DATE := CURRENT_DATE + INTERVAL '30 days';
BEGIN

    -- 1. Landlord
    INSERT INTO landlords (id, full_name, email, phone, whatsapp_number)
    VALUES (
        v_landlord_id,
        'Test Landlord',
        'test@propai.com',
        '+442071234567',
        '+442071234567'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Unit
    INSERT INTO units (id, landlord_id, unit_identifier, address, city, country, jurisdiction)
    VALUES (
        v_unit_id,
        v_landlord_id,
        'Flat 1',
        '42 Baker Street',
        'London',
        'GB',
        'england_wales'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 3. Unit attributes (bedrooms, furnishing etc. for the Instagram caption/image)
    INSERT INTO unit_attributes (unit_id, bedrooms, bathrooms, square_footage, furnished_status, has_garden_access, has_washing_machine)
    VALUES (v_unit_id, 2, 1, 750, 'fully_furnished', true, true)
    ON CONFLICT (unit_id) DO UPDATE SET
        bedrooms = 2,
        bathrooms = 1,
        square_footage = 750,
        furnished_status = 'fully_furnished';

    -- 4. Unit status
    INSERT INTO unit_status (unit_id, occupancy_status)
    VALUES (v_unit_id, 'occupied')
    ON CONFLICT (unit_id) DO NOTHING;

    -- 5. Lease expiring in 30 days
    INSERT INTO leases (id, unit_id, start_date, end_date, monthly_rent, deposit_amount, status)
    VALUES (
        v_lease_id,
        v_unit_id,
        CURRENT_DATE - INTERVAL '11 months',
        v_expire_date,
        1500.00,
        1500.00,
        'active'
    )
    ON CONFLICT (id) DO UPDATE SET
        end_date = v_expire_date,
        status = 'active',
        renewal_inquiry_sent_at = NULL,
        renewal_status = NULL;

    -- 6. Tenant with your test WhatsApp number
    INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
    VALUES (
        v_tenant_id,
        v_lease_id,
        'Test Tenant',
        'tenant@example.com',
        '+13369971342',
        true
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Test lease created successfully!';
    RAISE NOTICE 'Lease ID:    %', v_lease_id;
    RAISE NOTICE 'Tenant:      Test Tenant (+13369971342)';
    RAISE NOTICE 'Unit:        Flat 1, 42 Baker Street, London';
    RAISE NOTICE 'Expires:     %', v_expire_date;
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Now run:';
    RAISE NOTICE 'curl -X POST http://localhost:8000/api/test/renewal-inquiry/%', v_lease_id;
    RAISE NOTICE '--- or for instant Instagram post ---';
    RAISE NOTICE 'curl -X POST http://localhost:8000/api/test/instagram-listing/%', v_lease_id;

END $$;
