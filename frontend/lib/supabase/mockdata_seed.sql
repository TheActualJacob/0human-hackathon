-- ============================================================
-- MOCK DATA SEED – AI Property Manager
-- Run in order (respects FK constraints)
-- ============================================================

-- ============================================================
-- LANDLORDS
-- ============================================================
INSERT INTO landlords (id, full_name, email, phone, whatsapp_number, notification_preferences) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'James Whitfield', 'james@whitfieldproperties.co.uk', '+447700100001', '+447700100001', '{"email": true, "whatsapp": true, "digest_frequency": "daily"}'),
  ('a1000000-0000-0000-0000-000000000002', 'Sarah Okonkwo', 'sarah@okonkwolettings.com', '+447700100002', '+447700100002', '{"email": true, "whatsapp": false, "digest_frequency": "weekly"}');

-- ============================================================
-- UNITS
-- ============================================================
INSERT INTO units (id, landlord_id, unit_identifier, address, city, country, jurisdiction) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Flat 1', '14 Elm Crescent', 'London', 'GB', 'england_wales'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Flat 2', '14 Elm Crescent', 'London', 'GB', 'england_wales'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Unit A', '88 Brindley Drive', 'Manchester', 'GB', 'england_wales'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'Unit B', '88 Brindley Drive', 'Manchester', 'GB', 'england_wales');

-- ============================================================
-- UNIT ATTRIBUTES
-- ============================================================
INSERT INTO unit_attributes (id, unit_id, square_footage, bedrooms, bathrooms, has_ensuite, floor_level, furnished_status, heating_type, boiler_model, boiler_last_serviced, has_dishwasher, has_washing_machine, has_parking, gas_provider, electricity_provider, water_provider, door_code, bin_collection_day) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 650, 2, 1, false, 0, 'fully_furnished', 'gas_central', 'Worcester Bosch Greenstar 30i', '2025-09-15', true, true, false, 'British Gas', 'EDF Energy', 'Thames Water', '4291', 'Tuesday'),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 480, 1, 1, false, 1, 'part_furnished', 'gas_central', 'Vaillant ecoTEC Plus', '2025-06-10', false, true, false, 'British Gas', 'EDF Energy', 'Thames Water', '4291', 'Tuesday'),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 720, 2, 2, true, 3, 'unfurnished', 'electric', null, null, true, true, true, null, 'Octopus Energy', 'United Utilities', null, 'Thursday'),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 550, 1, 1, false, 2, 'fully_furnished', 'electric', null, null, false, false, true, null, 'Octopus Energy', 'United Utilities', null, 'Thursday');

-- ============================================================
-- UNIT APPLIANCES
-- ============================================================
INSERT INTO unit_appliances (id, unit_id, appliance_type, make, model, serial_number, install_date, warranty_expiry, last_serviced_at, condition, notes) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'boiler', 'Worcester Bosch', 'Greenstar 30i', 'WB-30I-98712', '2021-03-10', '2026-03-10', '2025-09-15', 'good', null),
  ('c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'oven', 'Bosch', 'Serie 4 HBS534', 'BSH-534-11234', '2022-06-01', '2027-06-01', null, 'good', null),
  ('c2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'washing_machine', 'Samsung', 'WW90T534DAW', 'SM-WW90-44821', '2023-01-15', '2026-01-15', null, 'fair', 'Makes loud noise on spin cycle'),
  ('c2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'boiler', 'Vaillant', 'ecoTEC Plus 832', 'VL-832-55123', '2020-11-20', '2025-11-20', '2025-06-10', 'good', null),
  ('c2000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003', 'fridge_freezer', 'LG', 'GBB72PZEFN', 'LG-72PZ-33190', '2024-02-01', '2029-02-01', null, 'good', null),
  ('c2000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000003', 'dishwasher', 'Bosch', 'SMS2ITW41G', 'BSH-2IT-90821', '2024-02-01', '2029-02-01', null, 'good', null);

-- ============================================================
-- UNIT STATUS
-- ============================================================
INSERT INTO unit_status (id, unit_id, occupancy_status, condition_rating, has_open_maintenance, open_maintenance_count, has_chronic_issue, chronic_issue_count, move_in_date) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'occupied', 4, true, 1, false, 0, '2024-09-01'),
  ('c3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'occupied', 3, false, 0, true, 1, '2023-06-15'),
  ('c3000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'occupied', 5, false, 0, false, 0, '2025-01-10'),
  ('c3000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'vacant', 3, false, 0, false, 0, null);

-- ============================================================
-- UNIT DOCUMENTS
-- ============================================================
INSERT INTO unit_documents (id, unit_id, document_type, issue_date, expiry_date, status, notes) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'gas_safety', '2025-09-15', '2026-09-15', 'valid', 'Annual CP12 – passed'),
  ('c4000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'epc', '2022-04-01', '2032-04-01', 'valid', 'Rating C'),
  ('c4000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'electrical_cert', '2024-01-20', '2029-01-20', 'valid', 'EICR satisfactory'),
  ('c4000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'gas_safety', '2025-06-10', '2026-06-10', 'valid', null),
  ('c4000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000002', 'epc', '2021-03-12', '2031-03-12', 'valid', 'Rating D'),
  ('c4000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000003', 'electrical_cert', '2024-11-05', '2029-11-05', 'valid', null),
  ('c4000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000003', 'epc', '2024-08-01', '2034-08-01', 'valid', 'Rating B'),
  ('c4000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000004', 'fire_risk', '2024-12-01', '2025-12-01', 'expiring_soon', 'Needs renewal');

-- ============================================================
-- MAINTENANCE ISSUES (chronic/ongoing)
-- ============================================================
INSERT INTO maintenance_issues (id, unit_id, issue_type, title, description, severity, is_chronic, status, report_count, times_addressed, first_reported_at, last_reported_at, potential_liability) VALUES
  ('c5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'damp', 'Recurring damp in bedroom wall', 'Damp patch keeps returning on the north-facing bedroom wall despite previous treatment. Possible external pointing issue.', 'moderate', true, 'active', 3, 2, '2024-02-10 10:00:00+00', '2025-11-20 14:30:00+00', true),
  ('c5000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'drainage', 'Slow draining kitchen sink', 'Kitchen sink drains very slowly. Plumber cleared it once but issue returned.', 'minor', false, 'active', 2, 1, '2025-08-05 09:00:00+00', '2025-12-01 11:00:00+00', false);

-- ============================================================
-- LEASES
-- ============================================================
INSERT INTO leases (id, unit_id, start_date, end_date, monthly_rent, deposit_amount, deposit_held, deposit_scheme, notice_period_days, status) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '2024-09-01', '2025-08-31', 1450.00, 1450.00, 1450.00, 'TDS', 30, 'active'),
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', '2023-06-15', '2024-06-14', 1100.00, 1100.00, 1100.00, 'DPS', 60, 'active'),
  ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', '2025-01-10', '2026-01-09', 1250.00, 1250.00, 1250.00, 'MyDeposits', 30, 'active'),
  ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', '2024-03-01', '2025-02-28', 950.00, 950.00, 950.00, 'TDS', 30, 'expired');

-- ============================================================
-- TENANTS
-- ============================================================
INSERT INTO tenants (id, lease_id, full_name, email, whatsapp_number, is_primary_tenant) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Aisha Begum', 'aisha.begum@gmail.com', '+447700200001', true),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'Tariq Begum', 'tariq.begum@gmail.com', '+447700200002', false),
  ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'Daniel Carter', 'dan.carter@outlook.com', '+447700200003', true),
  ('e1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000003', 'Priya Patel', 'priya.patel@yahoo.co.uk', '+447700200004', true),
  ('e1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000004', 'Tom Gallagher', 'tom.g@hotmail.com', '+447700200005', true);

-- ============================================================
-- CONTRACTORS
-- ============================================================
INSERT INTO contractors (id, landlord_id, name, trades, phone, email, emergency_available, notes) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Dave Parsons Plumbing', ARRAY['plumbing', 'heating'], '+447700300001', 'dave@parsonsplumbing.co.uk', true, 'Reliable, usually available same day'),
  ('f1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Sparks Electrical Ltd', ARRAY['electrical'], '+447700300002', 'info@sparkselectrical.co.uk', true, 'NICEIC registered'),
  ('f1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Northern Fix Property Services', ARRAY['plumbing', 'structural', 'heating'], '+447700300003', 'jobs@northernfix.co.uk', false, 'Good for larger jobs, not emergency'),
  ('f1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'PestAway Manchester', ARRAY['pest'], '+447700300004', 'bookings@pestawaymcr.co.uk', false, null);

-- ============================================================
-- PAYMENTS
-- ============================================================
INSERT INTO payments (id, lease_id, amount_due, amount_paid, due_date, paid_date, status, payment_method) VALUES
  -- Aisha Begum – Flat 1 (good payer)
  ('aa100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 1450.00, 1450.00, '2025-10-01', '2025-09-30', 'paid', 'bank_transfer'),
  ('aa100000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 1450.00, 1450.00, '2025-11-01', '2025-11-01', 'paid', 'bank_transfer'),
  ('aa100000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 1450.00, 1450.00, '2025-12-01', '2025-12-02', 'paid', 'bank_transfer'),
  ('aa100000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 1450.00, 0, '2026-01-01', null, 'pending', null),
  -- Daniel Carter – Flat 2 (has arrears)
  ('aa100000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000002', 1100.00, 1100.00, '2025-10-01', '2025-10-03', 'paid', 'bank_transfer'),
  ('aa100000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000002', 1100.00, 550.00, '2025-11-01', '2025-11-10', 'partial', 'bank_transfer'),
  ('aa100000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000002', 1100.00, 0, '2025-12-01', null, 'late', null),
  ('aa100000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000002', 1100.00, 0, '2026-01-01', null, 'pending', null),
  -- Priya Patel – Unit A (good payer)
  ('aa100000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000003', 1250.00, 1250.00, '2025-11-01', '2025-10-28', 'paid', 'standing_order'),
  ('aa100000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000003', 1250.00, 1250.00, '2025-12-01', '2025-11-28', 'paid', 'standing_order'),
  ('aa100000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000003', 1250.00, 0, '2026-01-01', null, 'pending', null);

-- ============================================================
-- PAYMENT PLANS
-- ============================================================
INSERT INTO payment_plans (id, lease_id, total_arrears, installment_amount, installment_frequency, start_date, end_date, status) VALUES
  ('aa200000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 1650.00, 275.00, 'monthly', '2026-01-15', '2026-07-15', 'active');

-- ============================================================
-- MAINTENANCE REQUESTS
-- ============================================================
INSERT INTO maintenance_requests (id, lease_id, maintenance_issue_id, category, description, urgency, status, contractor_id, scheduled_at, completed_at, cost) VALUES
  ('aa300000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000002', 'plumbing', 'Kitchen sink draining slowly again. Tenant reports standing water after washing up.', 'routine', 'assigned', 'f1000000-0000-0000-0000-000000000001', '2026-01-08 10:00:00+00', null, null),
  ('aa300000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000001', 'damp', 'Damp returning on bedroom wall, visible mould spots appearing.', 'high', 'open', null, null, null, null),
  ('aa300000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', null, 'electrical', 'Light fitting in hallway flickering intermittently.', 'routine', 'completed', 'f1000000-0000-0000-0000-000000000003', '2025-12-10 14:00:00+00', '2025-12-10 15:30:00+00', 85.00),
  ('aa300000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', null, 'appliance', 'Washing machine making very loud banging noise during spin cycle.', 'routine', 'open', null, null, null, null);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
INSERT INTO conversations (id, lease_id, direction, message_body, intent_classification, timestamp) VALUES
  -- Aisha – kitchen sink
  ('aa400000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'inbound', 'Hi, the kitchen sink is draining really slowly again. Water just sits there after I do the washing up.', 'maintenance_request', '2025-12-01 11:00:00+00'),
  ('aa400000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'outbound', 'Hi Aisha, thanks for letting us know. I''ve logged this and will get Dave the plumber booked in. Is next Wednesday morning convenient?', 'maintenance_response', '2025-12-01 11:05:00+00'),
  ('aa400000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'inbound', 'Wednesday works, anytime after 9am please', 'scheduling_confirmation', '2025-12-01 11:12:00+00'),
  ('aa400000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', 'outbound', 'Booked for Wednesday 8th Jan between 10-11am. Dave will text you when he''s on his way. Let me know if you need anything else.', 'scheduling_confirmation', '2025-12-01 11:15:00+00'),
  -- Aisha – washing machine
  ('aa400000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'inbound', 'Also the washing machine has been making a really loud banging noise when it spins. Is that something you can look at too?', 'maintenance_request', '2025-12-01 11:20:00+00'),
  ('aa400000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000001', 'outbound', 'Absolutely, I''ve noted that down. I''ll see if Dave can take a look at the same visit or we''ll arrange a separate appointment. I''ll get back to you.', 'maintenance_response', '2025-12-01 11:22:00+00'),
  -- Daniel – rent issue
  ('aa400000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000002', 'inbound', 'Hi, I know my rent is behind. I''ve had some trouble at work and could only pay half last month. Can we work something out?', 'payment_issue', '2025-11-15 09:30:00+00'),
  ('aa400000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000002', 'outbound', 'Hi Daniel, thanks for getting in touch. I understand things can be difficult. We can set up a payment plan to help you catch up. Would repaying the arrears over 6 months at £275/month on top of your rent work for you?', 'payment_plan_offer', '2025-11-15 09:45:00+00'),
  ('aa400000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000002', 'inbound', 'Yes that would really help, thank you', 'payment_plan_acceptance', '2025-11-15 10:02:00+00'),
  ('aa400000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000002', 'outbound', 'Great, I''ll draw up a payment plan agreement starting 15th January. First top-up payment of £275 will be due then alongside your regular rent. I''ll send over the document to sign.', 'payment_plan_confirmation', '2025-11-15 10:10:00+00'),
  -- Daniel – damp
  ('aa400000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000002', 'inbound', 'One more thing – the damp on the bedroom wall is back again. There''s mould spots now too. I thought this was sorted last time?', 'maintenance_request', '2025-11-20 14:30:00+00'),
  ('aa400000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000002', 'outbound', 'Sorry to hear it''s returned, Daniel. I''m logging this as a recurring issue and will escalate to get a more permanent fix. I''ll arrange for someone to come and do a full damp survey this time. I''ll update you with a date.', 'maintenance_response', '2025-11-20 14:40:00+00'),
  -- Priya – general
  ('aa400000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000003', 'inbound', 'Hi, just wanted to confirm – is it Thursday for bin collection here?', 'general_enquiry', '2025-12-03 08:00:00+00'),
  ('aa400000-0000-0000-0000-000000000014', 'd1000000-0000-0000-0000-000000000003', 'outbound', 'Hi Priya, yes it''s every Thursday. General waste and recycling alternate weekly. This week is recycling (blue bin).', 'general_response', '2025-12-03 08:05:00+00');

-- ============================================================
-- CONVERSATION CONTEXT
-- ============================================================
INSERT INTO conversation_context (id, lease_id, summary, open_threads, last_updated) VALUES
  ('aa500000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Aisha is a reliable tenant, pays on time. Two open maintenance issues: kitchen sink drainage (plumber booked 8 Jan) and washing machine noise (needs scheduling). Generally responsive and polite.', '[{"topic": "kitchen_sink", "status": "plumber_booked", "next_action": "confirm appointment completion"}, {"topic": "washing_machine", "status": "pending_scheduling", "next_action": "arrange repair or inspection"}]', '2025-12-01 11:25:00+00'),
  ('aa500000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'Daniel has rent arrears of £1650 (half Nov + full Dec). Payment plan agreed: £275/month over 6 months starting Jan 15. Also has recurring damp/mould issue in bedroom – needs damp survey. Cooperative tenant but financially strained.', '[{"topic": "arrears", "status": "payment_plan_agreed", "next_action": "send agreement document for signing"}, {"topic": "bedroom_damp", "status": "needs_survey", "next_action": "book damp surveyor"}]', '2025-11-20 14:45:00+00'),
  ('aa500000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000003', 'Priya is an excellent tenant. Pays early via standing order. No issues. Had a flickering hallway light fixed in December. Occasional general enquiries only.', '[]', '2025-12-10 16:00:00+00');

-- ============================================================
-- DISPUTES
-- ============================================================
INSERT INTO disputes (id, lease_id, category, description, status, opened_at) VALUES
  ('aa600000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'rent_arrears', 'Tenant fell behind on rent from November 2025. Partial payment received for November, nothing for December. Payment plan offered and accepted.', 'under_review', '2025-12-05 10:00:00+00'),
  ('aa600000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'repairs', 'Recurring damp and mould in bedroom. Tenant reports issue has been raised 3 times. Previous treatments have not resolved the root cause. Potential disrepair liability.', 'open', '2025-11-22 09:00:00+00');

-- ============================================================
-- LEGAL ACTIONS
-- ============================================================
INSERT INTO legal_actions (id, lease_id, dispute_id, action_type, issued_at, response_deadline, status, agent_reasoning) VALUES
  ('aa700000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'aa600000-0000-0000-0000-000000000001', 'payment_plan_agreement', '2025-12-06 12:00:00+00', '2026-01-06 12:00:00+00', 'issued', 'Tenant proactively contacted about arrears and agreed to payment plan. Formal agreement issued to protect both parties. No need for escalation at this stage.'),
  ('aa700000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'aa600000-0000-0000-0000-000000000002', 'formal_notice', '2025-12-01 10:00:00+00', '2025-12-15 10:00:00+00', 'acknowledged', 'Formal notice sent to landlord flagging potential disrepair liability due to recurring damp. Recommending urgent damp survey and permanent remediation to avoid Homes Act 2018 / Fitness for Habitation Act claim.');

-- ============================================================
-- LANDLORD NOTIFICATIONS
-- ============================================================
INSERT INTO landlord_notifications (id, landlord_id, lease_id, notification_type, message, related_record_type, related_record_id, requires_signature, read_at, created_at) VALUES
  ('aa800000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'general', 'Maintenance request raised for kitchen sink at Flat 1, 14 Elm Crescent. Plumber booked for 8 Jan.', 'maintenance_requests', 'aa300000-0000-0000-0000-000000000001', false, '2025-12-01 14:00:00+00', '2025-12-01 11:30:00+00'),
  ('aa800000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'rent_overdue', 'Daniel Carter (Flat 2) has rent arrears of £1,650. A payment plan of £275/month over 6 months has been agreed.', 'payment_plans', 'aa200000-0000-0000-0000-000000000001', false, null, '2025-12-06 12:05:00+00'),
  ('aa800000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'compliance_expiry', 'Recurring damp issue at Flat 2 flagged as potential disrepair liability. Urgent damp survey recommended to avoid legal exposure.', 'disputes', 'aa600000-0000-0000-0000-000000000002', false, null, '2025-12-01 10:05:00+00'),
  ('aa800000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'signature_required', 'Payment plan agreement for Daniel Carter requires your signature before it can be sent to the tenant.', 'legal_actions', 'aa700000-0000-0000-0000-000000000001', true, null, '2025-12-06 12:10:00+00'),
  ('aa800000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003', 'payment_received', 'December rent of £1,250 received from Priya Patel (Unit A) via standing order.', 'payments', 'aa100000-0000-0000-0000-000000000010', false, '2025-11-29 09:00:00+00', '2025-11-28 18:00:00+00');

-- ============================================================
-- DOCUMENT TEMPLATES
-- ============================================================
INSERT INTO document_templates (id, jurisdiction, document_type, template_body, legal_basis, version) VALUES
  ('aa900000-0000-0000-0000-000000000001', 'england_wales', 'payment_demand', 'Dear {{tenant_name}},\n\nRe: {{unit_address}}\n\nThis letter is to formally notify you that your rent account is in arrears by {{arrears_amount}}.\n\nThe outstanding balance relates to rent due on {{due_dates}}.\n\nPlease arrange payment within 14 days of the date of this letter. If you are experiencing financial difficulty, please contact us to discuss a repayment plan.\n\nYours sincerely,\n{{landlord_name}}', 'Pre-action Protocol for Possession Claims based on Rent Arrears', 1),
  ('aa900000-0000-0000-0000-000000000002', 'england_wales', 'section_21', 'Dear {{tenant_name}},\n\nRe: {{unit_address}}\n\nI am giving you notice that I require possession of the above property after {{notice_end_date}}.\n\nThis notice is given under Section 21(1)(b) / Section 21(4)(a) of the Housing Act 1988.\n\nYou are required to give up possession on or after {{notice_end_date}}.\n\nYours sincerely,\n{{landlord_name}}', 'Housing Act 1988, Section 21', 1),
  ('aa900000-0000-0000-0000-000000000003', 'england_wales', 'payment_plan_agreement', 'PAYMENT PLAN AGREEMENT\n\nDate: {{agreement_date}}\n\nParties:\nLandlord: {{landlord_name}}\nTenant: {{tenant_name}}\nProperty: {{unit_address}}\n\nTotal arrears: {{total_arrears}}\nRepayment amount: {{installment_amount}} per {{frequency}}\nStart date: {{start_date}}\nEnd date: {{end_date}}\n\nThis is in addition to the regular monthly rent of {{monthly_rent}}.\n\nSigned (Landlord): _______________\nSigned (Tenant): _______________', 'Voluntary agreement – no specific statute. Recommended by Pre-action Protocol for Debt Claims.', 1);

-- ============================================================
-- AGENT ACTIONS (audit log)
-- ============================================================
INSERT INTO agent_actions (id, lease_id, action_category, action_description, tools_called, input_summary, output_summary, confidence_score, timestamp) VALUES
  ('ab100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'maintenance', 'Created maintenance request for kitchen sink drainage issue and booked contractor', '["create_maintenance_request", "book_contractor"]', 'Tenant reported slow draining kitchen sink via WhatsApp', 'Maintenance request created, Dave Parsons Plumbing booked for 8 Jan 10-11am', 0.95, '2025-12-01 11:15:00+00'),
  ('ab100000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'maintenance', 'Created maintenance request for noisy washing machine', '["create_maintenance_request"]', 'Tenant reported loud banging noise from washing machine during spin cycle', 'Maintenance request created, pending contractor scheduling', 0.90, '2025-12-01 11:22:00+00'),
  ('ab100000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'payment', 'Offered and set up payment plan for rent arrears', '["calculate_arrears", "create_payment_plan", "generate_document"]', 'Tenant contacted about £1650 arrears, requested help', 'Payment plan agreed: £275/month x 6 months. Agreement document generated for signing.', 0.92, '2025-11-15 10:10:00+00'),
  ('ab100000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'escalation', 'Escalated recurring damp issue and flagged potential disrepair liability', '["update_maintenance_issue", "create_dispute", "notify_landlord"]', 'Tenant reported damp returning for 3rd time with mould now visible', 'Issue flagged as chronic, dispute opened, landlord notified of liability risk. Damp survey recommended.', 0.88, '2025-11-20 14:45:00+00'),
  ('ab100000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000003', 'communication', 'Answered general enquiry about bin collection day', '["lookup_unit_attributes"]', 'Tenant asked which day bins are collected', 'Responded with Thursday collection schedule and this week''s bin type (recycling)', 0.99, '2025-12-03 08:05:00+00');

-- ============================================================
-- END SEED DATA
-- ============================================================
