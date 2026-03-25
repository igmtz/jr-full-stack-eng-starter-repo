# ROP Renewal Risk Dashboard — Starter Repo

This is the starter repo for the Jr. Full Stack Engineer take-home test. 

**Please see docs/SPEC.md for project instructions.**

## Quick Start

```bash
docker-compose up --build
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
