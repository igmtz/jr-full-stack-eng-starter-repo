export interface ResidentRawData {
  resident_id: string;
  name: string;
  unit_id: string;
  unit_number: string;
  lease_id: string;
  /** Integer days until lease_end_date (may be negative if already expired). */
  days_to_expiry: number;
  monthly_rent: string | number;
  market_rent: string | number | null;
  is_delinquent: boolean;
  has_renewal_offer: boolean;
}

export interface RiskSignals {
  daysToExpiryDays: number;
  paymentHistoryDelinquent: boolean;
  noRenewalOfferYet: boolean;
  /** true when market_rent exceeds monthly_rent by ≥ 5% (non-zero contribution). */
  rentGrowthAboveMarket: boolean;
}

export interface ScoredResident {
  residentId: string;
  name: string;
  unitId: string;
  unitNumber: string;
  leaseId: string;
  riskScore: number;
  riskTier: "high" | "medium" | "low";
  daysToExpiry: number;
  rentGapPct: number;
  isDelinquent: boolean;
  hasRenewalOffer: boolean;
  signals: RiskSignals;
}
