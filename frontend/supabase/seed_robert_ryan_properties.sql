-- ============================================================
-- Seed: Robert Ryan — Landlord Profile + 4 London Properties
--
-- 3 vacant units (available for prospect inquiries / applications)
-- 1 unit with an expiring lease (for lease renewal demo)
--
-- Safe to re-run — uses fixed UUIDs with ON CONFLICT DO NOTHING / DO UPDATE
-- ============================================================

DO $$
DECLARE
    v_landlord_id UUID := 'b1000000-0000-0000-0000-000000000001';

    -- Unit IDs
    v_unit1_id UUID := 'b2000000-0000-0000-0000-000000000001';  -- Camden 2-bed
    v_unit2_id UUID := 'b2000000-0000-0000-0000-000000000002';  -- Shoreditch 1-bed
    v_unit3_id UUID := 'b2000000-0000-0000-0000-000000000003';  -- Brixton 3-bed
    v_unit4_id UUID := 'b2000000-0000-0000-0000-000000000004';  -- Islington 2-bed (expiring)

    -- Lease / tenant IDs for the expiring unit
    v_lease4_id  UUID := 'b3000000-0000-0000-0000-000000000004';
    v_tenant4_id UUID := 'b4000000-0000-0000-0000-000000000004';

    v_expire_date DATE := CURRENT_DATE + INTERVAL '30 days';
BEGIN

    -- ============================================================
    -- 1. Landlord: Robert Ryan
    -- ============================================================
    INSERT INTO landlords (id, full_name, email, phone, whatsapp_number)
    VALUES (
        v_landlord_id,
        'Robert Ryan',
        'robert.ryan@propai.test',
        '+442071234500',
        '+442071234500'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = 'Robert Ryan',
        email     = 'robert.ryan@propai.test';

    -- ============================================================
    -- 2a. Unit 1 — 2-bed flat, Camden, NW1 (vacant, available)
    -- ============================================================
    INSERT INTO units (id, landlord_id, unit_identifier, address, city, postcode, country, jurisdiction)
    VALUES (
        v_unit1_id,
        v_landlord_id,
        'Flat 4A',
        '14 Parkway',
        'London',
        'NW1 7AA',
        'GB',
        'england_wales'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO unit_attributes (
        unit_id, bedrooms, bathrooms, square_footage,
        furnished_status, has_garden_access, has_parking,
        has_washing_machine, has_dishwasher
    )
    VALUES (
        v_unit1_id, 2, 1, 820,
        'fully_furnished', false, false,
        true, false
    )
    ON CONFLICT (unit_id) DO UPDATE SET
        bedrooms = 2, bathrooms = 1, square_footage = 820,
        furnished_status = 'fully_furnished';

    INSERT INTO unit_status (unit_id, occupancy_status)
    VALUES (v_unit1_id, 'vacant')
    ON CONFLICT (unit_id) DO UPDATE SET occupancy_status = 'vacant';

    -- ============================================================
    -- 2b. Unit 2 — 1-bed flat, Shoreditch, E1 (vacant, available)
    -- ============================================================
    INSERT INTO units (id, landlord_id, unit_identifier, address, city, postcode, country, jurisdiction)
    VALUES (
        v_unit2_id,
        v_landlord_id,
        'Studio 2',
        '88 Brick Lane',
        'London',
        'E1 6RF',
        'GB',
        'england_wales'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO unit_attributes (
        unit_id, bedrooms, bathrooms, square_footage,
        furnished_status, has_garden_access, has_parking,
        has_washing_machine, has_dishwasher
    )
    VALUES (
        v_unit2_id, 1, 1, 480,
        'fully_furnished', false, false,
        true, false
    )
    ON CONFLICT (unit_id) DO UPDATE SET
        bedrooms = 1, bathrooms = 1, square_footage = 480,
        furnished_status = 'fully_furnished';

    INSERT INTO unit_status (unit_id, occupancy_status)
    VALUES (v_unit2_id, 'vacant')
    ON CONFLICT (unit_id) DO UPDATE SET occupancy_status = 'vacant';

    -- ============================================================
    -- 2c. Unit 3 — 3-bed house, Brixton, SW2 (vacant, available)
    -- ============================================================
    INSERT INTO units (id, landlord_id, unit_identifier, address, city, postcode, country, jurisdiction)
    VALUES (
        v_unit3_id,
        v_landlord_id,
        '22 Effra Road',
        '22 Effra Road',
        'London',
        'SW2 1BZ',
        'GB',
        'england_wales'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO unit_attributes (
        unit_id, bedrooms, bathrooms, square_footage,
        furnished_status, has_garden_access, has_parking,
        has_washing_machine, has_dishwasher
    )
    VALUES (
        v_unit3_id, 3, 2, 1150,
        'unfurnished', true, true,
        true, true
    )
    ON CONFLICT (unit_id) DO UPDATE SET
        bedrooms = 3, bathrooms = 2, square_footage = 1150,
        furnished_status = 'unfurnished';

    INSERT INTO unit_status (unit_id, occupancy_status)
    VALUES (v_unit3_id, 'vacant')
    ON CONFLICT (unit_id) DO UPDATE SET occupancy_status = 'vacant';

    -- ============================================================
    -- 2d. Unit 4 — 2-bed flat, Islington, N1 (occupied, expiring lease)
    -- ============================================================
    INSERT INTO units (id, landlord_id, unit_identifier, address, city, postcode, country, jurisdiction)
    VALUES (
        v_unit4_id,
        v_landlord_id,
        'Flat 7B',
        '5 Upper Street',
        'London',
        'N1 0PQ',
        'GB',
        'england_wales'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO unit_attributes (
        unit_id, bedrooms, bathrooms, square_footage,
        furnished_status, has_garden_access, has_parking,
        has_washing_machine, has_dishwasher
    )
    VALUES (
        v_unit4_id, 2, 1, 760,
        'part_furnished', false, false,
        true, false
    )
    ON CONFLICT (unit_id) DO UPDATE SET
        bedrooms = 2, bathrooms = 1, square_footage = 760,
        furnished_status = 'part_furnished';

    INSERT INTO unit_status (unit_id, occupancy_status, move_in_date)
    VALUES (v_unit4_id, 'occupied', CURRENT_DATE - INTERVAL '11 months')
    ON CONFLICT (unit_id) DO UPDATE SET
        occupancy_status = 'occupied',
        move_in_date = CURRENT_DATE - INTERVAL '11 months';

    -- Lease expiring in 30 days (triggers renewal flow)
    INSERT INTO leases (
        id, unit_id, start_date, end_date,
        monthly_rent, deposit_amount, status,
        renewal_status
    )
    VALUES (
        v_lease4_id,
        v_unit4_id,
        CURRENT_DATE - INTERVAL '11 months',
        v_expire_date,
        2100.00,
        2423.08,   -- ~5 weeks' rent deposit
        'active',
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        end_date              = v_expire_date,
        status                = 'active',
        renewal_status        = NULL,
        renewal_inquiry_sent_at = NULL;

    -- Tenant for expiring lease
    INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant)
    VALUES (
        v_tenant4_id,
        v_lease4_id,
        'Sarah Mitchell',
        'sarah.mitchell@example.com',
        '+447900000099',
        true
    )
    ON CONFLICT (id) DO NOTHING;

    -- ============================================================
    -- 3. Lease agreement template applied to all units
    -- ============================================================
    -- Give each unit a placeholder lease template so the agent has
    -- something to reference when talking to prospects.
    UPDATE leases
    SET special_terms = 'ASSURED SHORTHOLD TENANCY AGREEMENT (England & Wales)
Landlord: Robert Ryan
Monthly rent payable in advance on the 1st of each month.
Deposit: 5 weeks rent held in a government-approved scheme.
Minimum term: 12 months fixed, then month-to-month.
Pets: not permitted without prior written consent.
Smoking: not permitted anywhere in the property.
Tenant responsible for council tax, utilities, and broadband.'
    WHERE unit_id IN (v_unit1_id, v_unit2_id, v_unit3_id, v_unit4_id)
      AND (special_terms IS NULL OR special_terms = '');

    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Robert Ryan seed complete!';
    RAISE NOTICE 'Landlord ID:  %', v_landlord_id;
    RAISE NOTICE '';
    RAISE NOTICE 'VACANT (available for applications):';
    RAISE NOTICE '  Flat 4A, 14 Parkway, Camden NW1 — 2 bed, fully furnished — unit %', v_unit1_id;
    RAISE NOTICE '  Studio 2, 88 Brick Lane, Shoreditch E1 — 1 bed, fully furnished — unit %', v_unit2_id;
    RAISE NOTICE '  22 Effra Road, Brixton SW2 — 3 bed, unfurnished — unit %', v_unit3_id;
    RAISE NOTICE '';
    RAISE NOTICE 'EXPIRING (lease renewal demo):';
    RAISE NOTICE '  Flat 7B, 5 Upper Street, Islington N1 — expires %', v_expire_date;
    RAISE NOTICE '  Tenant: Sarah Mitchell (+447900000099)';
    RAISE NOTICE '  Lease ID: %', v_lease4_id;
    RAISE NOTICE '';
    RAISE NOTICE 'To trigger renewal inquiry:';
    RAISE NOTICE 'curl -X POST http://localhost:8000/api/test/renewal-inquiry/%', v_lease4_id;
    RAISE NOTICE '==============================================';

END $$;
