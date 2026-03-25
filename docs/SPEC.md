# Jr. Full Stack Engineer Take-Home Project

## Renewal Risk Dashboard for ROP

**Time Limit:** 2 hours (please don't take more time. Please be sure to log the time that you worked on it in your response). 
**Deliverable:** Working feature with a backend API endpoint and React dashboard, built on top of a provided starter repo.

---

## Context

You're building a feature for the Residential Operating Platform (ROP): a dashboard that shows property managers which residents are at risk of not renewing their leases.

**The Business Problem:**

- Property managers lose $2,400-3,200 per early move-out (30 days vacancy + re-leasing costs)
- They need to identify at-risk residents early enough to offer retention incentives
- Current system: no visibility until it's too late

**Your Job:**
Using the provided starter repo (which includes the database schema, seed data, and project scaffolding), implement the risk scoring API endpoint and build a React dashboard that surfaces at-risk residents.

---

## What We Provide

The starter repo includes:

- **PostgreSQL database** with all tables already created (properties, units, residents, leases, renewal offers, unit pricing, and renewal risk score tables)
- **Seed data** with sample properties, residents, and leases
- **Backend scaffolding** (Node.js + TypeScript + Express) with database connection configured
- **Frontend scaffolding** (React + TypeScript) with routing set up
- **Docker Compose** to run everything locally
- **A mock RMS endpoint** that accepts webhook POSTs (for the bonus task)

You should be able to run `docker-compose up` and have a working environment within minutes.

---

## Requirements

### 1. Renewal Risk Scoring API (Backend)

**Endpoint: POST /api/v1/properties/:propertyId/renewal-risk/calculate**

Implement the endpoint that calculates risk scores for all active residents in a property. The endpoint should calculate scores, store them in the `renewal_risk_scores` table, and return the results directly in the response. The frontend will call this single endpoint to both trigger the calculation and receive the results — no separate GET endpoint is needed.

**Risk Scoring Formula (follow this spec):**

Calculate a 0-100 risk score using these four signals:

| Signal | Weight | How to Score (0-100 per signal) |
|--------|--------|---------------------------------|
| Days to lease expiry | 40% | 90 days or less = 100, 91-180 days = 50, 180+ days = 10 |
| Payment delinquency | 25% | Any late payments in last 6 months = 100, otherwise = 0 |
| No renewal offer yet | 20% | No offer on file = 100, offer exists = 0 |
| Rent vs. market rate | 15% | Market rent > current rent by 10%+ = 100, 5-10% = 50, under 5% = 0 |

**How to determine each signal:**

- **Delinquency:** A resident is delinquent if they have any `resident_ledger` entry with `charge_code = 'late_fee'` in the last 6 months.
- **Rent gap:** Use the most recent `unit_pricing` record (by `effective_date`) for the resident's unit. Rent gap % = `(market_rent - lease.monthly_rent) / lease.monthly_rent * 100`.
- **Renewal offer:** A renewal offer exists if there is any record in `renewal_offers` for the resident's active lease.

**Base score** = (days_score × 0.40) + (delinquency_score × 0.25) + (no_offer_score × 0.20) + (rent_gap_score × 0.15)

**Signal interaction rules (apply after base score):**

Certain combinations of signals indicate compounding risk and should boost the final score:

- **Delinquent AND no renewal offer:** Add 10 points. A resident who's missed payments and hasn't been offered a renewal is a high flight risk — the operator has no retention strategy in place.
- **30 days or fewer to expiry AND rent gap above 10%:** Add 15 points. Imminent expiry combined with significant rent increase pressure makes move-out very likely.
- **Delinquent AND 60 days or fewer to expiry:** Add 10 points. Payment issues close to lease end signal a resident who may already be mentally checked out.

Interaction bonuses stack (a resident could hit multiple), but the **final score must be capped at 100**.

**Risk tiers:**
- High: score >= 70
- Medium: score >= 40
- Low: score < 40

**Expected response format:**

The `residents` array should include **all** active residents with their calculated scores (high, medium, and low).

```json
{
  "propertyId": "prop-001",
  "calculatedAt": "2025-01-02T14:30:00Z",
  "totalResidents": 12,
  "riskTiers": {
    "high": 3,
    "medium": 5,
    "low": 4
  },
  "residents": [
    {
      "residentId": "res-001",
      "name": "Jane Doe",
      "unitId": "unit-101",
      "riskScore": 85,
      "riskTier": "high",
      "daysToExpiry": 45,
      "signals": {
        "daysToExpiryDays": 45,
        "paymentHistoryDelinquent": false,
        "noRenewalOfferYet": true,
        "rentGrowthAboveMarket": false
      }
    }
  ]
}
```

> **Note:** `totalResidents` is the count of active residents scored, and should match the length of the `residents` array.

**What we're looking for:**
- Can you translate a clear spec into working code?
- Do your SQL queries work correctly against the provided schema?
- Do you handle basic error cases (invalid property ID, no residents found)?

---

### 2. Renewal Risk Dashboard (Frontend) — Primary Focus

**Page: /properties/:propertyId/renewal-risk**

Build a React page that displays residents at risk of not renewing. This is where you should spend the majority of your time.

**The dashboard should:**

- Call the API endpoint you built to fetch risk data
- Display results in a table with these columns:
  - Resident name
  - Unit number
  - Days to lease expiry
  - Risk score (0-100)
  - Risk tier (color-coded: red for high, yellow for medium, green for low)
- Show a loading state while data is being fetched
- Show an error state if the API call fails
- Include a button to trigger the risk calculation (calls the POST endpoint)

**Nice to have (if you have time):**

- Sort by risk score (highest first)
- Filter by risk tier
- Expandable rows that show the individual signal breakdown (why they were flagged)

**What we're looking for:**
- Clean React component structure
- Proper use of state and effects (hooks)
- Loading and error handling
- Readable, maintainable code
- A functional UI that a property manager could actually use

**Design note:** This is operational software for property managers. It needs to be functional and clear. Don't spend time on pixel-perfect styling — focus on usability and clarity.

---

### 3. Trigger Renewal Event (Bonus)

If you have time remaining, add a "Trigger Renewal Event" button to each row in the dashboard.

When clicked, it should:

1. POST to the mock RMS endpoint (URL provided in the starter repo's environment variables)
2. Send a payload with the resident's risk data
3. Show a success/failure indicator in the UI

**This is intentionally simple.** No retry logic, no exponential backoff, no dead-letter queue. Just a basic API call from the frontend through your backend to the mock RMS. We want to see that you can wire up a simple integration.

**Payload format:**

```json
{
  "event": "renewal.risk_flagged",
  "eventId": "evt-abc123",
  "timestamp": "2025-01-02T14:30:00Z",
  "propertyId": "prop-001",
  "residentId": "res-001",
  "data": {
    "riskScore": 85,
    "riskTier": "high",
    "daysToExpiry": 45
  }
}
```

---

## Tech Stack (provided in starter repo)

**Backend:**
- Node.js + TypeScript
- Express
- PostgreSQL (via `pg` — the connection pool is already configured in `backend/src/db.ts`)

**Frontend:**
- React + TypeScript
- Tailwind CSS (available but optional)
- Fetch or axios for API calls

**Infrastructure:**
- Docker Compose (database + backend + frontend + mock RMS)

---

## Evaluation Rubric

### Frontend (50%)

- **Functionality** (25%): Dashboard loads data, displays it correctly, handles loading and error states. Table is usable and clear.
- **Code Quality** (15%): Clean component structure, proper use of React patterns (hooks, state management), readable code.
- **UX** (10%): A property manager should be able to understand what they're looking at. Color-coding, clear labels, sensible layout.

### Backend (35%)

- **API Implementation** (15%): Endpoint works correctly. Risk scoring logic matches the provided formula, including signal interaction rules and score capping. Response format matches the spec.
- **SQL & Data** (15%): Queries work against the provided schema. No N+1 problems or obvious performance issues.
- **Error Handling** (5%): Basic validation and error responses (invalid property ID, server errors).

### Code Quality & Communication (15%)

- **Clarity** (5%): Code is readable. Variable names make sense. No dead code or half-finished ideas.
- **README** (5%): Brief notes on what you built, any decisions you made, and anything you'd improve with more time.
- **Testing Mindset** (5%): You've thought about what could go wrong, even if you didn't write formal tests.

### Bonus: Trigger Renewal Event (+10%)

- Basic integration works end-to-end (frontend → backend → mock RMS)
- Success/failure state shown in the UI

### Bonus: AI-Assisted Development (+5%)

- Note which parts you used AI tools for (Claude, Cursor, Copilot, etc.)
- In the follow-up interview, be prepared to discuss: what did AI do well? What did you need to refine or fix?

---

## What NOT to Do

- Don't redesign the database schema. It's provided — use it.
- Don't implement webhook retry logic, exponential backoff, or a dead-letter queue. That's not part of this test.
- Don't spend more than 15 minutes on styling. Functional beats pretty.
- Don't implement authentication, authorization, or multi-property views.
- Don't leave dead code or commented-out experiments.

---

## Getting Started

1. Clone the starter repo: `[REPO URL]`
2. Run `docker-compose up` (this starts the database, seeds data, and runs the backend + frontend)
3. Verify the database has seed data: visit `http://localhost:3003/api/health` (or check the backend logs)
4. Start building!

**Recommended order:**
1. Read through the provided schema and seed data to understand the data model (~15 min)
2. Implement the risk scoring endpoint (~40 min)
3. Build the React dashboard (~45 min)
4. Polish, error handling, README (~15 min)
5. Bonus: trigger renewal event (remaining time)

---

## Submission

Submit as a **GitHub repository** (public or private, shared with us).

**Your README should include:**
- Confirmation that `docker-compose up` works
- How to trigger a risk calculation and see results in the dashboard
- Any decisions you made or assumptions you documented
- What you'd improve with more time
- Which parts (if any) used AI assistance

---

## Questions?

If something is ambiguous, **make a decision and document it in your README**. That's part of the test — we want to see how you handle uncertainty.

Good luck.
