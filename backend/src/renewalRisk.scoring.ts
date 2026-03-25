// ---------------------------------------------------------------------------
// renewalRisk.scoring.ts
//
// Pure scoring functions — no database, no side effects.
// Each signal scorer is a standalone function so callers can test them
// independently.
// ---------------------------------------------------------------------------

import type { ResidentRawData, ScoredResident } from "./renewalRisk.types";
export type { ResidentRawData, RiskSignals, ScoredResident } from "./renewalRisk.types";

// ---------------------------------------------------------------------------
// Individual signal scorers (0–100 each)
// ---------------------------------------------------------------------------

/** Days-to-expiry signal: ≤90 → 100 | 91–180 → 50 | 181+ → 10 */
export function scoreByDaysToExpiry(days: number): number {
  if (days <= 90) return 100;
  if (days <= 180) return 50;
  return 10;
}

/** Payment delinquency signal: any late_fee in last 6 months → 100, else 0 */
export function scoreByDelinquency(isDelinquent: boolean): number {
  return isDelinquent ? 100 : 0;
}

/** No-renewal-offer signal: no offer → 100, offer exists → 0 */
export function scoreByNoOffer(hasOffer: boolean): number {
  return hasOffer ? 0 : 100;
}

/**
 * Rent-gap percentage: (market_rent - monthly_rent) / monthly_rent * 100.
 * Returns 0 if monthly_rent is 0 or market_rent is unavailable.
 */
export function computeRentGapPct(
  marketRent: number,
  monthlyRent: number
): number {
  if (monthlyRent === 0) return 0;
  return ((marketRent - monthlyRent) / monthlyRent) * 100;
}

/** Rent-gap signal: ≥10% → 100 | 5–10% → 50 | <5% → 0 */
export function scoreByRentGap(rentGapPct: number): number {
  if (rentGapPct >= 10) return 100;
  if (rentGapPct >= 5) return 50;
  return 0;
}

// ---------------------------------------------------------------------------
// Weighted base score
// ---------------------------------------------------------------------------

export function computeBaseScore(
  daysScore: number,
  delinquencyScore: number,
  noOfferScore: number,
  rentGapScore: number
): number {
  return (
    daysScore * 0.4 +
    delinquencyScore * 0.25 +
    noOfferScore * 0.2 +
    rentGapScore * 0.15
  );
}

// ---------------------------------------------------------------------------
// Interaction bonuses (applied after base score, final capped at 100)
// ---------------------------------------------------------------------------

export function applyInteractionBonuses(
  baseScore: number,
  daysToExpiry: number,
  isDelinquent: boolean,
  hasOffer: boolean,
  rentGapPct: number
): number {
  let score = baseScore;

  // Delinquent AND no renewal offer → +10
  if (isDelinquent && !hasOffer) score += 10;

  // ≤30 days to expiry AND rent gap ≥10% → +15
  if (daysToExpiry <= 30 && rentGapPct >= 10) score += 15;

  // Delinquent AND ≤60 days to expiry → +10
  if (isDelinquent && daysToExpiry <= 60) score += 10;

  return Math.min(100, Math.round(score));
}

// ---------------------------------------------------------------------------
// Risk tier
// ---------------------------------------------------------------------------

export function assignRiskTier(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Top-level scoring entry point
// ---------------------------------------------------------------------------

export function computeRiskScore(raw: ResidentRawData): ScoredResident {
  const daysToExpiry = Number(raw.days_to_expiry);
  const monthlyRent = Number(raw.monthly_rent);
  // Fall back to current rent if no pricing row exists (gap = 0%)
  const marketRent = raw.market_rent != null ? Number(raw.market_rent) : monthlyRent;

  const rentGapPct = computeRentGapPct(marketRent, monthlyRent);

  const daysScore = scoreByDaysToExpiry(daysToExpiry);
  const delinquencyScore = scoreByDelinquency(raw.is_delinquent);
  const noOfferScore = scoreByNoOffer(raw.has_renewal_offer);
  const rentGapScore = scoreByRentGap(rentGapPct);

  const baseScore = computeBaseScore(
    daysScore,
    delinquencyScore,
    noOfferScore,
    rentGapScore
  );

  const finalScore = applyInteractionBonuses(
    baseScore,
    daysToExpiry,
    raw.is_delinquent,
    raw.has_renewal_offer,
    rentGapPct
  );

  return {
    residentId: raw.resident_id,
    name: raw.name,
    unitId: raw.unit_id,
    unitNumber: raw.unit_number,
    leaseId: raw.lease_id,
    riskScore: finalScore,
    riskTier: assignRiskTier(finalScore),
    daysToExpiry,
    rentGapPct: Math.round(rentGapPct * 100) / 100, // 2 d.p. to match DECIMAL(5,2)
    isDelinquent: raw.is_delinquent,
    hasRenewalOffer: raw.has_renewal_offer,
    signals: {
      daysToExpiryDays: daysToExpiry,
      paymentHistoryDelinquent: raw.is_delinquent,
      noRenewalOfferYet: !raw.has_renewal_offer,
      rentGrowthAboveMarket: rentGapPct >= 5,
    },
  };
}
