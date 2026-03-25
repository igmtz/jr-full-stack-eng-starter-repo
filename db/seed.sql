-- Seed Data for Jr. Full Stack Engineer Take-Home Test
-- This creates realistic test data for the Renewal Risk Dashboard

-- Use a DO block so we can reference generated UUIDs across inserts
DO $$
DECLARE
  v_property_id UUID;
  v_unit_type_1br UUID;
  v_unit_type_2br UUID;
  v_unit_ids UUID[];
  v_resident_id UUID;
  v_lease_id UUID;
  v_unit_id UUID;
BEGIN

  -- Create property
  INSERT INTO properties (name, address, city, state, zip_code, status)
  VALUES ('Park Meadows Apartments', '123 Main St', 'Denver', 'CO', '80206', 'active')
  RETURNING id INTO v_property_id;

  -- Create unit types
  INSERT INTO unit_types (property_id, name, bedrooms, bathrooms, square_footage)
  VALUES (v_property_id, '1BR/1BA', 1, 1.0, 700)
  RETURNING id INTO v_unit_type_1br;

  INSERT INTO unit_types (property_id, name, bedrooms, bathrooms, square_footage)
  VALUES (v_property_id, '2BR/2BA', 2, 2.0, 1050)
  RETURNING id INTO v_unit_type_2br;

  -- Create 15 units (mix of 1BR and 2BR)
  -- Units 101-110: 1BR, Units 201-205: 2BR
  FOR i IN 1..10 LOOP
    INSERT INTO units (property_id, unit_type_id, unit_number, floor, status)
    VALUES (v_property_id, v_unit_type_1br, (100 + i)::text, 1, 'occupied');
  END LOOP;

  FOR i IN 1..5 LOOP
    INSERT INTO units (property_id, unit_type_id, unit_number, floor, status)
    VALUES (v_property_id, v_unit_type_2br, (200 + i)::text, 2, 'occupied');
  END LOOP;

  -- ============================================================
  -- SCENARIO 1: HIGH RISK — Jane Doe
  -- Lease expires in 30 days, no renewal offer, rent below market
  -- Expected: high days_score + no_offer + rent_gap + interaction bonuses
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '101' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Jane', 'Doe', 'jane.doe@example.com', 'active', '2023-01-15')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-03-15', CURRENT_DATE + INTERVAL '30 days', 1400, 'active')
  RETURNING id INTO v_lease_id;

  -- On-time payments (not delinquent)
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1400, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1400, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '2 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  -- Unit pricing: market rent is $1,680 (20% above current $1,400)
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1400, 1680, CURRENT_DATE - INTERVAL '30 days');

  -- NO renewal offer (intentionally omitted)

  -- ============================================================
  -- SCENARIO 2: HIGH RISK — Marcus Chen
  -- Lease expires in 45 days, delinquent (late payments), no renewal offer
  -- Expected: high days_score + delinquency + no_offer + interaction bonuses
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '102' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Marcus', 'Chen', 'marcus.chen@example.com', 'active', '2023-06-01')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-06-01', CURRENT_DATE + INTERVAL '45 days', 1500, 'active')
  RETURNING id INTO v_lease_id;

  -- Late payments: charges posted but payments arrived 20+ days late for 2 of last 6 months
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1500, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');

    IF i IN (2, 4) THEN
      -- Late payments
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1500, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '25 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'charge', 'late_fee', 75, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days');
    ELSE
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1500, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '3 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    END IF;
  END LOOP;

  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1500, 1575, CURRENT_DATE - INTERVAL '30 days');

  -- ============================================================
  -- SCENARIO 3: MEDIUM RISK — Sarah Kim
  -- Lease expires in 75 days, no renewal offer, rent at market
  -- Expected: medium days_score + no_offer, no other signals
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '103' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Sarah', 'Kim', 'sarah.kim@example.com', 'active', '2023-03-01')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-03-01', CURRENT_DATE + INTERVAL '75 days', 1600, 'active')
  RETURNING id INTO v_lease_id;

  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1600, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1600, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '1 day', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1600, 1650, CURRENT_DATE - INTERVAL '30 days');

  -- ============================================================
  -- SCENARIO 4: MEDIUM RISK — David Rodriguez
  -- Lease expires in 120 days, delinquent, has renewal offer
  -- Expected: lower days_score + delinquency, but offer dampens no_offer signal
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '104' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'David', 'Rodriguez', 'david.rodriguez@example.com', 'active', '2022-09-01')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-09-01', CURRENT_DATE + INTERVAL '120 days', 1450, 'active')
  RETURNING id INTO v_lease_id;

  -- One missed payment
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1450, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    IF i != 3 THEN
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1450, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '2 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    ELSE
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1450, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '22 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'charge', 'late_fee', 72.50, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days');
    END IF;
  END LOOP;

  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1450, 1525, CURRENT_DATE - INTERVAL '30 days');

  -- Has a renewal offer
  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, renewal_end_date, proposed_rent, status)
  VALUES (v_property_id, v_resident_id, v_lease_id, CURRENT_DATE + INTERVAL '120 days', CURRENT_DATE + INTERVAL '485 days', 1525, 'pending');

  -- ============================================================
  -- SCENARIO 5: LOW RISK — Alice Johnson
  -- Lease expires in 200 days, renewal offer sent, on-time payments, rent at market
  -- Expected: low across all signals
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '201' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Alice', 'Johnson', 'alice.johnson@example.com', 'active', '2023-06-15')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-06-15', CURRENT_DATE + INTERVAL '200 days', 1900, 'active')
  RETURNING id INTO v_lease_id;

  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1900, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1900, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '1 day', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1900, 1950, CURRENT_DATE - INTERVAL '30 days');

  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, renewal_end_date, proposed_rent, status)
  VALUES (v_property_id, v_resident_id, v_lease_id, CURRENT_DATE + INTERVAL '200 days', CURRENT_DATE + INTERVAL '565 days', 1950, 'pending');

  -- ============================================================
  -- SCENARIO 6: LOW RISK — Bob Williams
  -- Lease expires in 250 days, all payments on time, renewal offer accepted
  -- Expected: very low risk
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '202' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Bob', 'Williams', 'bob.williams@example.com', 'active', '2022-11-01')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-11-01', CURRENT_DATE + INTERVAL '250 days', 2000, 'active')
  RETURNING id INTO v_lease_id;

  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 2000, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 2000, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '1 day', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 2000, 2050, CURRENT_DATE - INTERVAL '30 days');

  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, renewal_end_date, proposed_rent, status)
  VALUES (v_property_id, v_resident_id, v_lease_id, CURRENT_DATE + INTERVAL '250 days', CURRENT_DATE + INTERVAL '615 days', 2050, 'accepted');

  -- ============================================================
  -- SCENARIO 7: MEDIUM RISK — Priya Patel
  -- Lease expires in 60 days, delinquent, rent gap 12%, has renewal offer
  -- Expected: medium-high from days + delinquency + rent_gap, dampened by having offer
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '105' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Priya', 'Patel', 'priya.patel@example.com', 'active', '2023-08-01')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-08-01', CURRENT_DATE + INTERVAL '60 days', 1350, 'active')
  RETURNING id INTO v_lease_id;

  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1350, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    IF i = 1 THEN
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1350, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '18 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'charge', 'late_fee', 67.50, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days');
    ELSE
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1350, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '2 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    END IF;
  END LOOP;

  -- Market rent is 12% above current
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1350, 1512, CURRENT_DATE - INTERVAL '30 days');

  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, renewal_end_date, proposed_rent, status)
  VALUES (v_property_id, v_resident_id, v_lease_id, CURRENT_DATE + INTERVAL '60 days', CURRENT_DATE + INTERVAL '425 days', 1500, 'pending');

  -- ============================================================
  -- SCENARIO 8: HIGH RISK — Tom Baker
  -- Lease expires in 20 days, delinquent, no renewal offer, rent gap 15%
  -- Expected: maximum risk — all signals fire + all interaction bonuses
  -- ============================================================
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '106' AND property_id = v_property_id;

  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Tom', 'Baker', 'tom.baker@example.com', 'active', '2023-02-01')
  RETURNING id INTO v_resident_id;

  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-02-01', CURRENT_DATE + INTERVAL '20 days', 1300, 'active')
  RETURNING id INTO v_lease_id;

  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1300, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    IF i IN (0, 3, 5) THEN
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1300, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '20 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'charge', 'late_fee', 65, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '15 days');
    ELSE
      INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
      VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1300, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '3 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    END IF;
  END LOOP;

  -- 15% rent gap
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1300, 1495, CURRENT_DATE - INTERVAL '30 days');

  -- ============================================================
  -- SCENARIOS 9-12: Additional residents to fill out the property
  -- Mix of low and medium risk
  -- ============================================================

  -- Resident 9: Lisa Tran — low risk, 180+ days, offer sent
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '107' AND property_id = v_property_id;
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Lisa', 'Tran', 'lisa.tran@example.com', 'active', '2023-04-01')
  RETURNING id INTO v_resident_id;
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-04-01', CURRENT_DATE + INTERVAL '190 days', 1550, 'active')
  RETURNING id INTO v_lease_id;
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1550, 1580, CURRENT_DATE - INTERVAL '30 days');
  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, proposed_rent, status)
  VALUES (v_property_id, v_resident_id, v_lease_id, CURRENT_DATE + INTERVAL '190 days', 1600, 'pending');
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1550, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1550, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '1 day', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  -- Resident 10: Mike Brown — medium risk, 90 days, no offer, rent at market
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '108' AND property_id = v_property_id;
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Mike', 'Brown', 'mike.brown@example.com', 'active', '2023-05-01')
  RETURNING id INTO v_resident_id;
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-05-01', CURRENT_DATE + INTERVAL '90 days', 1600, 'active')
  RETURNING id INTO v_lease_id;
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1600, 1650, CURRENT_DATE - INTERVAL '30 days');
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1600, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1600, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '2 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  -- Resident 11: Emma Wilson — low risk, 300 days, offer accepted
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '203' AND property_id = v_property_id;
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Emma', 'Wilson', 'emma.wilson@example.com', 'active', '2022-12-01')
  RETURNING id INTO v_resident_id;
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-12-01', CURRENT_DATE + INTERVAL '300 days', 2100, 'active')
  RETURNING id INTO v_lease_id;
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 2100, 2150, CURRENT_DATE - INTERVAL '30 days');
  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, proposed_rent, status)
  VALUES (v_property_id, v_resident_id, v_lease_id, CURRENT_DATE + INTERVAL '300 days', 2150, 'accepted');
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 2100, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 2100, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '1 day', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  -- Resident 12: Carlos Mendez — medium risk, 55 days, no offer, slight rent gap
  SELECT id INTO v_unit_id FROM units WHERE unit_number = '109' AND property_id = v_property_id;
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status, move_in_date)
  VALUES (v_property_id, v_unit_id, 'Carlos', 'Mendez', 'carlos.mendez@example.com', 'active', '2023-07-15')
  RETURNING id INTO v_resident_id;
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, status)
  VALUES (v_property_id, v_resident_id, v_unit_id, '2024-07-15', CURRENT_DATE + INTERVAL '55 days', 1500, 'active')
  RETURNING id INTO v_lease_id;
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  VALUES (v_unit_id, 1500, 1610, CURRENT_DATE - INTERVAL '30 days');
  FOR i IN 0..5 LOOP
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'charge', 'rent', 1500, CURRENT_DATE - (6 - i) * INTERVAL '1 month', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
    INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date, due_date)
    VALUES (v_property_id, v_resident_id, 'payment', 'rent', 1500, CURRENT_DATE - (6 - i) * INTERVAL '1 month' + INTERVAL '2 days', CURRENT_DATE - (6 - i) * INTERVAL '1 month');
  END LOOP;

  RAISE NOTICE 'Seed data inserted. Property ID: %', v_property_id;

END $$;
