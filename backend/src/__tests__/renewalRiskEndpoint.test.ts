import request from "supertest";
import app from "../index";
import {
  fetchPropertyById,
  fetchResidentsForScoring,
  persistRiskScores,
} from "../renewalRisk.queries";
import type { ResidentRawData } from "../renewalRisk.types";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Prevent pg.Pool from attempting a real DB connection on import.
jest.mock("../db", () => ({ pool: {} }));

// Mock all DB access for the endpoint under test. computeRiskScore is NOT
// mocked — it's a pure function and testing it through the HTTP layer proves
// the integration works end-to-end without a database.
jest.mock("../renewalRisk.queries");

const mockFetchPropertyById = fetchPropertyById as jest.MockedFunction<typeof fetchPropertyById>;
const mockFetchResidents = fetchResidentsForScoring as jest.MockedFunction<typeof fetchResidentsForScoring>;
const mockPersist = persistRiskScores as jest.MockedFunction<typeof persistRiskScores>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROPERTY_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const STUB_PROPERTY = { id: PROPERTY_ID, name: "Park Meadows Apartments" };

// Produces score=100 (HIGH): ≤90d + delinquent + no offer + ≥10% gap + all 3 bonuses
const highRiskResident: ResidentRawData = {
  resident_id: "res-001",
  name: "Tom Baker",
  unit_id: "unit-106",
  unit_number: "106",
  lease_id: "lease-001",
  days_to_expiry: 20,
  monthly_rent: 1300,
  market_rent: 1495,  // ~15% gap
  is_delinquent: true,
  has_renewal_offer: false,
};

// Produces score=60 (MEDIUM): ≤90d + no offer, no delinquency, gap <5%
const mediumRiskResident: ResidentRawData = {
  resident_id: "res-002",
  name: "Sarah Kim",
  unit_id: "unit-103",
  unit_number: "103",
  lease_id: "lease-002",
  days_to_expiry: 75,
  monthly_rent: 1600,
  market_rent: 1650,  // ~3% gap
  is_delinquent: false,
  has_renewal_offer: false,
};

// Produces score=4 (LOW): >180d + has offer, on-time, gap <5%
const lowRiskResident: ResidentRawData = {
  resident_id: "res-003",
  name: "Alice Johnson",
  unit_id: "unit-201",
  unit_number: "201",
  lease_id: "lease-003",
  days_to_expiry: 200,
  monthly_rent: 1900,
  market_rent: 1950,  // ~2.6% gap
  is_delinquent: false,
  has_renewal_offer: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(propertyId: string) {
  return request(app)
    .post(`/api/v1/properties/${propertyId}/renewal-risk/calculate`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // persistRiskScores is a void async — resolve silently by default.
  mockPersist.mockResolvedValue(undefined);
});

describe("POST /api/v1/properties/:propertyId/renewal-risk/calculate", () => {

  // -------------------------------------------------------------------------
  // 1. Happy path — proves the full calculation pipeline flows correctly
  //    through the HTTP layer: DB data → scoring → persist → JSON response.
  // -------------------------------------------------------------------------
  it("returns 200 with residents array and risk summary for a valid property", async () => {
    mockFetchPropertyById.mockResolvedValue(STUB_PROPERTY);
    mockFetchResidents.mockResolvedValue([highRiskResident]);

    const res = await post(PROPERTY_ID);

    expect(res.status).toBe(200);
    expect(res.body.propertyId).toBe(PROPERTY_ID);
    expect(res.body.totalResidents).toBe(1);
    expect(res.body.calculatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string
    expect(res.body.residents).toHaveLength(1);
    expect(res.body.riskTiers).toEqual({ high: 1, medium: 0, low: 0 });
  });

  // -------------------------------------------------------------------------
  // 2. All required resident fields are present — proves the response
  //    shape matches the spec contract the frontend depends on.
  // -------------------------------------------------------------------------
  it("includes all required fields on each resident in the response", async () => {
    mockFetchPropertyById.mockResolvedValue(STUB_PROPERTY);
    mockFetchResidents.mockResolvedValue([highRiskResident]);

    const res = await post(PROPERTY_ID);
    const resident = res.body.residents[0];

    expect(resident).toMatchObject({
      residentId: expect.any(String),
      name: expect.any(String),
      unitId: expect.any(String),
      unitNumber: expect.any(String),
      riskScore: expect.any(Number),
      riskTier: expect.stringMatching(/^(high|medium|low)$/),
      daysToExpiry: expect.any(Number),
      signals: {
        daysToExpiryDays: expect.any(Number),
        paymentHistoryDelinquent: expect.any(Boolean),
        noRenewalOfferYet: expect.any(Boolean),
        rentGrowthAboveMarket: expect.any(Boolean),
      },
    });
  });

  // -------------------------------------------------------------------------
  // 3. Risk tier aggregation — proves riskTiers counts are correct when
  //    residents span all three tiers, and totalResidents matches array length.
  // -------------------------------------------------------------------------
  it("correctly aggregates risk tiers across multiple residents", async () => {
    mockFetchPropertyById.mockResolvedValue(STUB_PROPERTY);
    mockFetchResidents.mockResolvedValue([
      highRiskResident,
      mediumRiskResident,
      lowRiskResident,
    ]);

    const res = await post(PROPERTY_ID);

    expect(res.status).toBe(200);
    expect(res.body.totalResidents).toBe(3);
    expect(res.body.riskTiers).toEqual({ high: 1, medium: 1, low: 1 });
    expect(res.body.residents).toHaveLength(3);
    // Sorted highest-risk first
    expect(res.body.residents[0].riskTier).toBe("high");
    expect(res.body.residents[2].riskTier).toBe("low");
  });

  // -------------------------------------------------------------------------
  // 4. Property not found — proves the 404 guard is in place so the frontend
  //    gets a clear error instead of an empty response or a crash.
  // -------------------------------------------------------------------------
  it("returns 404 when the property does not exist", async () => {
    mockFetchPropertyById.mockResolvedValue(null);

    const res = await post(PROPERTY_ID);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/property not found/i);
  });

  // -------------------------------------------------------------------------
  // 5. No active residents — proves a property with no active leases returns
  //    a clear 404 rather than an empty 200 that would silently mislead callers.
  // -------------------------------------------------------------------------
  it("returns 404 when the property has no active residents", async () => {
    mockFetchPropertyById.mockResolvedValue(STUB_PROPERTY);
    mockFetchResidents.mockResolvedValue([]);

    const res = await post(PROPERTY_ID);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no active residents/i);
  });

  // -------------------------------------------------------------------------
  // 6. DB failure — proves the try/catch in the handler returns a safe 500
  //    rather than crashing the process or leaking internal error details.
  // -------------------------------------------------------------------------
  it("returns 500 on an unexpected database error", async () => {
    mockFetchPropertyById.mockRejectedValue(new Error("connection refused"));

    const res = await post(PROPERTY_ID);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
    // Internal error message must NOT be leaked to the caller
    expect(JSON.stringify(res.body)).not.toContain("connection refused");
  });

});
