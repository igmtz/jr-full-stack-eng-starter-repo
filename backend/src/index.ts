import express from "express";
import cors from "cors";
import { pool } from "./db";
import {
  fetchPropertyById,
  fetchResidentsForScoring,
  persistRiskScores,
} from "./renewalRisk.queries";
import { computeRiskScore } from "./renewalRisk.scoring";

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ status: "ok", time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});

// Get the seeded property (convenience endpoint for the frontend)
app.get("/api/v1/properties", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, address, city, state, zip_code FROM properties WHERE status = 'active'"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// POST /api/v1/properties/:propertyId/renewal-risk/calculate
app.post("/api/v1/properties/:propertyId/renewal-risk/calculate", async (req, res) => {
  const { propertyId } = req.params;

  try {
    const property = await fetchPropertyById(pool, propertyId);
    if (!property) {
      res.status(404).json({ error: `Property not found: ${propertyId}` });
      return;
    }

    const rawResidents = await fetchResidentsForScoring(pool, propertyId);
    if (rawResidents.length === 0) {
      res.status(404).json({ error: "No active residents found for this property" });
      return;
    }

    const scored = rawResidents.map(computeRiskScore);
    scored.sort((a, b) => b.riskScore - a.riskScore);

    const calculatedAt = new Date();
    await persistRiskScores(pool, propertyId, scored, calculatedAt);

    const riskTiers = scored.reduce(
      (acc, s) => { acc[s.riskTier]++; return acc; },
      { high: 0, medium: 0, low: 0 } as Record<string, number>
    );

    res.json({
      propertyId,
      calculatedAt: calculatedAt.toISOString(),
      totalResidents: scored.length,
      riskTiers,
      residents: scored.map((s) => ({
        residentId: s.residentId,
        name: s.name,
        unitId: s.unitId,
        unitNumber: s.unitNumber,
        riskScore: s.riskScore,
        riskTier: s.riskTier,
        daysToExpiry: s.daysToExpiry,
        signals: s.signals,
      })),
    });
  } catch (err) {
    console.error("[renewal-risk] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =============================================================
// TODO (Bonus): Add your trigger renewal event endpoint here
//
// POST /api/v1/properties/:propertyId/residents/:residentId/trigger-renewal
//
// This should POST to the mock RMS endpoint (MOCK_RMS_URL env var).
// =============================================================

app.listen(PORT, () => {
  console.log(`✓ Backend running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✓ Mock RMS URL: ${process.env.MOCK_RMS_URL || "not configured"}`);
});
