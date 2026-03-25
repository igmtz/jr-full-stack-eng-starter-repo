import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://rop:rop@localhost:5432/rop",
});

// Verify connection on startup
pool.query("SELECT 1").then(() => {
  console.log("✓ Database connected");
}).catch((err: { message: any; }) => {
  console.error("✗ Database connection failed:", err.message);
  process.exit(1);
});
