import express from "express";
import cors from "cors";
import { pool } from "./db";

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

// =============================================================
// TODO: Add your renewal risk endpoint here
//
// POST /api/v1/properties/:propertyId/renewal-risk/calculate
//
// See the project spec for the full requirements.
// =============================================================

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
