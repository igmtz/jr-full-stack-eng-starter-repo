// ---------------------------------------------------------------------------
// renewalRisk.queries.ts
//
// All database access for the renewal-risk feature.
// ---------------------------------------------------------------------------

import { Pool } from "pg";
import type { ResidentRawData, ScoredResident } from "./renewalRisk.scoring";

// ---------------------------------------------------------------------------
// Property check
// ---------------------------------------------------------------------------

export async function fetchPropertyById(
  pool: Pool,
  propertyId: string
): Promise<{ id: string; name: string } | null> {
  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM properties WHERE id = $1 AND status = 'active'`,
    [propertyId]
  );
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Resident data fetch
//
// One query returns every active resident for the property with all four
// scoring signals pre-computed:
//
//   1. days_to_expiry   — (lease_end_date - CURRENT_DATE)
//   2. market_rent      — most recent unit_pricing row by effective_date
//   3. is_delinquent    — any late_fee in resident_ledger in last 6 months
//   4. has_renewal_offer — any renewal_offers row for the active lease
//
// LATERAL subqueries keep each lookup scoped to the relevant row and avoid
// a global scan; the delinquency LATERAL is also property-scoped via $1.
// ---------------------------------------------------------------------------

export async function fetchResidentsForScoring(
  pool: Pool,
  propertyId: string
): Promise<ResidentRawData[]> {
  const result = await pool.query<ResidentRawData>(
    `
    SELECT
      r.id                                                AS resident_id,
      r.first_name || ' ' || r.last_name                AS name,
      u.id                                               AS unit_id,
      u.unit_number,
      l.id                                               AS lease_id,
      (l.lease_end_date - CURRENT_DATE)::int            AS days_to_expiry,
      l.monthly_rent,
      up.market_rent,
      COALESCE(delinq.is_delinquent, false)             AS is_delinquent,
      COALESCE(ro.has_offer,        false)              AS has_renewal_offer

    FROM residents r
    JOIN units u
      ON u.id = r.unit_id

    -- Active lease for this property
    JOIN leases l
      ON  l.resident_id  = r.id
      AND l.property_id  = $1
      AND l.status       = 'active'

    -- Most recent unit pricing (LEFT so missing pricing → market_rent = NULL)
    LEFT JOIN LATERAL (
      SELECT market_rent
      FROM   unit_pricing
      WHERE  unit_id = u.id
      ORDER BY effective_date DESC
      LIMIT 1
    ) up ON true

    -- Any late_fee ledger entry in the last 6 months
    LEFT JOIN LATERAL (
      SELECT true AS is_delinquent
      FROM   resident_ledger
      WHERE  resident_id   = r.id
        AND  property_id   = $1
        AND  charge_code   = 'late_fee'
        AND  transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      LIMIT 1
    ) delinq ON true

    -- Any renewal offer for this active lease
    LEFT JOIN LATERAL (
      SELECT true AS has_offer
      FROM   renewal_offers
      WHERE  lease_id = l.id
      LIMIT 1
    ) ro ON true

    WHERE r.property_id = $1
      AND r.status      = 'active'
    `,
    [propertyId]
  );

  return result.rows;
}

// ---------------------------------------------------------------------------
// Transactional persist
//
// Clears previous scores for the property first (avoids unbounded row growth),
// then inserts all new scores in a single batch using unnest() so there is
// one round-trip regardless of resident count.
// ---------------------------------------------------------------------------

export async function persistRiskScores(
  pool: Pool,
  propertyId: string,
  scores: ScoredResident[],
  calculatedAt: Date
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM renewal_risk_scores WHERE property_id = $1",
      [propertyId]
    );

    if (scores.length > 0) {
      await client.query(
        `
        INSERT INTO renewal_risk_scores
          ( property_id, resident_id, lease_id,
            risk_score,  risk_tier,
            days_to_expiry, is_delinquent, has_renewal_offer,
            rent_gap_pct,   calculated_at )
        SELECT
          $1,
          unnest($2::uuid[]),
          unnest($3::uuid[]),
          unnest($4::int[]),
          unnest($5::text[]),
          unnest($6::int[]),
          unnest($7::boolean[]),
          unnest($8::boolean[]),
          unnest($9::numeric[]),
          $10
        `,
        [
          propertyId,
          scores.map((s) => s.residentId),
          scores.map((s) => s.leaseId),
          scores.map((s) => s.riskScore),
          scores.map((s) => s.riskTier),
          scores.map((s) => s.daysToExpiry),
          scores.map((s) => s.isDelinquent),
          scores.map((s) => s.hasRenewalOffer),
          scores.map((s) => s.rentGapPct),
          calculatedAt,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
