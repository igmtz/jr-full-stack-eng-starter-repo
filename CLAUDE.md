# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ROP Renewal Risk Dashboard** — A take-home project for a Jr. Full Stack Engineer role. The goal is to implement a renewal risk scoring API endpoint and a React dashboard showing which residents are at risk of not renewing their leases.

See [docs/SPEC.md](docs/SPEC.md) for full requirements and the evaluation rubric.

## Commands

### Run Everything (recommended)

```bash
docker-compose up --build
```

### Rebuild specific services after code changes

```bash
docker-compose up --build backend frontend
```

### Database access

```bash
docker-compose exec db psql -U rop -d rop
```

### View mock RMS webhook logs

```bash
docker-compose logs -f mock-rms
```

### Reset and reseed

```bash
docker-compose down -v && docker-compose up --build
```

There are no test scripts configured in either `package.json`.

## Architecture

This is a **Docker Compose monorepo** with four services:

| Service | Port | Directory |
|---------|------|-----------|
| Frontend (React + Vite) | 5173 | `frontend/` |
| Backend (Express + TypeScript) | 3003 | `backend/` |
| PostgreSQL | 5432 | `db/` |
| Mock RMS (webhook receiver) | 3001 | `mock-rms/` |

**Request flow:** Browser → Frontend (Vite dev server) → `/api/*` proxied to Backend → PostgreSQL. The Vite config proxies all `/api` requests to the backend, so frontend code uses relative URLs like `fetch("/api/v1/...")`.

### Backend (`backend/src/`)

- [index.ts](backend/src/index.ts) — Express app entry point. Add all new routes here.
- [db.ts](backend/src/db.ts) — Exports a `pg.Pool` instance as `pool`. Uses `DATABASE_URL` env var.
- Backend runs with `tsx watch` for hot-reload in development.

### Frontend (`frontend/src/`)

- [main.tsx](frontend/src/main.tsx) — React Router setup; routes `/ → App`, `/properties/:propertyId/renewal-risk → RenewalRiskPage`.
- [App.tsx](frontend/src/App.tsx) — Property list page (complete).
- [pages/RenewalRiskPage.tsx](frontend/src/pages/RenewalRiskPage.tsx) — **The primary workspace** — currently a placeholder, needs to be implemented.
- `VITE_API_URL` env var is available via `import.meta.env.VITE_API_URL || ""` for API base URL.

### Database Schema (`db/`)

- [init.sql](db/init.sql) — **Do not modify.** Creates all tables.
- [seed.sql](db/seed.sql) — Seeds 1 property (`prop-001`), 15 units, 12 active residents with varied risk profiles.

Key tables for the renewal risk feature:
- `leases` — `status = 'active'`, `lease_end_date`, `monthly_rent`
- `resident_ledger` — delinquency detected via `charge_code = 'late_fee'` in last 6 months
- `unit_pricing` — use most recent by `effective_date`; `market_rent` for rent gap calculation
- `renewal_offers` — existence check per `lease_id`
- `renewal_risk_scores` — write calculated scores here; columns map directly to the scoring signals

## What Needs to Be Built

### Backend (TODO in `backend/src/index.ts`)

1. `POST /api/v1/properties/:propertyId/renewal-risk/calculate` — Calculate risk scores for all active residents, persist to `renewal_risk_scores`, return JSON response per spec.

2. `POST /api/v1/properties/:propertyId/residents/:residentId/trigger-renewal` *(bonus)* — Forward webhook payload to `MOCK_RMS_URL` env var.

### Frontend (TODO in `frontend/src/pages/RenewalRiskPage.tsx`)

Build the dashboard: button to trigger calculation (calls the POST endpoint), results table with resident name, unit, days to expiry, risk score, and color-coded risk tier (red/yellow/green), loading and error states.

## Risk Scoring Formula

| Signal | Weight | Scoring |
|--------|--------|---------|
| Days to expiry | 40% | ≤90d=100, 91-180d=50, >180d=10 |
| Delinquent (late fee in last 6mo) | 25% | Yes=100, No=0 |
| No renewal offer on file | 20% | No offer=100, Has offer=0 |
| Rent gap vs market | 15% | ≥10%=100, 5-10%=50, <5%=0 |

**Interaction bonuses** (applied after base, capped at 100):
- Delinquent AND no renewal offer → +10
- ≤30 days to expiry AND rent gap ≥10% → +15
- Delinquent AND ≤60 days to expiry → +10

**Tiers:** high ≥70, medium ≥40, low <40
