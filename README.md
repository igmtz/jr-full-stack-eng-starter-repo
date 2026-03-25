# ROP Renewal Risk Dashboard

A renewal risk scoring API and React dashboard for identifying residents at risk of not renewing their leases.

---

## Quick Start

> **Note:** The repo uses `docker-compose` (v1 syntax) in its scripts, but Docker Desktop on recent versions ships only the v2 CLI (`docker compose`). Either works — just replace `docker-compose` with `docker compose` if you get a "command not found" error.

```bash
docker compose up --build
```

This starts four services:

| Service      | URL                          | Description                        |
|-------------|------------------------------|------------------------------------|
| **Frontend** | http://localhost:5173        | React app (your dashboard)         |
| **Backend**  | http://localhost:3003        | Express API                        |
| **Database** | localhost:5432               | PostgreSQL (user: rop, pass: rop)  |
| **Mock RMS** | http://localhost:3001        | Receives webhook POSTs (bonus)     |

## Verify It Works

After `docker-compose up`, check:

1. **Backend health:** http://localhost:3003/api/health — should return `{ "status": "ok" }`
2. **Frontend:** http://localhost:5173 — should show the property list with "Park Meadows Apartments"
3. **Click the property** to navigate to the Renewal Risk Dashboard page (your workspace)

## What's Provided

### Database (fully set up — do not modify the schema)
- `db/init.sql` — Creates all tables (properties, units, residents, leases, ledger, renewal offers, renewal risk scores)
- `db/seed.sql` — Seeds 1 property, 15 units, 12 residents with varied risk scenarios

### Backend (`backend/`)
- Express + TypeScript server running on port 3003
- Database connection configured (`src/db.ts`)
- Health check endpoint (`GET /api/health`)
- Properties list endpoint (`GET /api/v1/properties`)
- **TODO:** Implement `POST /api/v1/properties/:propertyId/renewal-risk/calculate`

### Frontend (`frontend/`)
- React + TypeScript + Tailwind CSS
- Routing configured (React Router)
- Home page lists properties with links to their dashboards
- **TODO:** Build the dashboard at `src/pages/RenewalRiskPage.tsx`

### Mock RMS (`mock-rms/`)
- Simple Node.js server that accepts POST to `/webhook`
- Logs received payloads to the console
- Available at `http://mock-rms:3001/webhook` from within Docker (or `http://localhost:3001/webhook` from your machine)
- Used for the bonus "Trigger Renewal Event" feature

## Environment Variables

The backend has these pre-configured in `docker-compose.yml`:

| Variable        | Value                                    |
|----------------|------------------------------------------|
| `DATABASE_URL`  | `postgres://rop:rop@db:5432/rop`        |
| `PORT`          | `3003`                                   |
| `MOCK_RMS_URL`  | `http://mock-rms:3001/webhook`          |

## Seed Data Scenarios

The seed data includes 12 residents with different risk profiles:

| Resident         | Unit | Days to Expiry | Delinquent | Renewal Offer | Rent Gap | Expected Risk |
|-----------------|------|----------------|------------|---------------|----------|---------------|
| Jane Doe         | 101  | 30             | No         | No            | 20%      | **High**      |
| Marcus Chen      | 102  | 45             | Yes        | No            | 5%       | **High**      |
| Sarah Kim        | 103  | 75             | No         | No            | ~3%      | **Medium**    |
| David Rodriguez  | 104  | 120            | Yes        | Yes           | ~5%      | **Medium**    |
| Alice Johnson    | 201  | 200            | No         | Yes           | ~3%      | **Low**       |
| Bob Williams     | 202  | 250            | No         | Yes (accepted)| ~2%      | **Low**       |
| Priya Patel      | 105  | 60             | Yes        | Yes           | 12%      | **Medium**    |
| Tom Baker        | 106  | 20             | Yes        | No            | 15%      | **High**      |
| Lisa Tran        | 107  | 190            | No         | Yes           | ~2%      | **Low**       |
| Mike Brown       | 108  | 90             | No         | No            | ~3%      | **Medium**    |
| Emma Wilson      | 203  | 300            | No         | Yes (accepted)| ~2%      | **Low**       |
| Carlos Mendez    | 109  | 55             | No         | No            | ~7%      | **Medium**    |

## Project Structure

```
starter-repo/
├── docker-compose.yml          # Starts all services
├── db/
│   ├── init.sql                # Schema (DO NOT modify)
│   └── seed.sql                # Test data
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Express app — add your routes here
│       └── db.ts               # Database connection (ready to use)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts          # Proxies /api to backend
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx            # Router setup (done)
│       ├── App.tsx             # Property list page (done)
│       └── pages/
│           └── RenewalRiskPage.tsx  # YOUR WORKSPACE — build here
├── mock-rms/
│   ├── Dockerfile
│   └── server.js               # Logs webhook payloads (for bonus)
└── README.md
```

## Useful Commands

```bash
# Start everything
docker-compose up --build

# Rebuild after changes (if hot-reload isn't picking up)
docker-compose up --build backend frontend

# Connect to the database directly
docker-compose exec db psql -U rop -d rop

# View mock RMS logs (for bonus webhook task)
docker-compose logs -f mock-rms

# Tear down and reset (removes data)
docker-compose down -v
```

## Tips

- The frontend proxies `/api` requests to the backend, so you can use relative URLs like `fetch("/api/v1/properties/...")` in your React code
- The `pool` export from `backend/src/db.ts` is ready to use for queries
- Don't spend more than 15 minutes on styling — functional beats pretty
- If something is ambiguous, make a decision and document it in your README

Good luck.

# Implementation

## How to trigger a risk calculation and see results

1. Open http://localhost:5173 — the home page lists all seeded properties.
2. Click **Park Meadows Apartments** to open the Renewal Risk Dashboard.
3. Click **Calculate Risk Scores** — the button POSTs to the backend, which scores all active residents and persists results.
4. The table renders immediately with all 12 residents sorted highest-risk first, color-coded tier badges, and a risk score bar per row.
5. Click any resident row to expand the signal breakdown (days to expiry, delinquency, renewal offer status, rent gap).
6. Click **Trigger Renewal** on any row to forward that resident's risk data to the mock RMS webhook. The button shows a "✓ Sent" confirmation with a "send again?" action.
7. To verify webhook delivery: `docker compose logs -f mock-rms`
8. Click **Recalculate** at any time to re-run scoring — previous DB rows are cleared and replaced atomically.

---

## Decisions and assumptions

| Topic | Decision |
|-------|----------|
| Architecture | Database queries, business logic, and HTTP layer are separated into distinct modules (`renewalRisk.queries.ts`, `renewalRisk.scoring.ts`, `index.ts`) to improve testability and maintainability. |
| Pure functions for business logic | Scoring algorithms are implemented as pure functions without side effects, making them testable, and easier to debug. |
| No active residents → 404 | Chose 404 over an empty 200 as an error case. |
| Response sort order | Residents sorted highest-risk-first before returning and persisting — convenient for the frontend table. |
| Priya Patel's expected tier | The README seed table labels her "Medium", but the spec formula yields 90 (HIGH) once interaction bonuses are applied. I'm taking the formula is the authoritative source. |

---

## What I'd improve with more time

1. **Unit tests for scoring functions** — `renewalRisk.scoring.ts` is already pure functions with no dependencies. We could write individual tests for every boundary condition and all interaction.
2. **Better folder structure for separation of concerns** — Organize backend source files into specific directories: `database/` for queries, `services/` for business logic, `routes/` for HTTP endpoints, and `types/` for shared interfaces to improve code organization and maintainability.

---

## AI assistance

Claude Code (claude-sonnet-4-6) was used throughout this implementation.

In brief:
- AI was strong at: translating the scoring formula into small pure functions, writing the LATERAL-subquery SQL, and accelerating the initial implementation.
- Human review was needed for: verifying boundary conditions against the spec exactly, cross-checking interaction bonuses against each seed scenario, and confirming provided data vs results.

## Logged time

1 hour and 58 minutes