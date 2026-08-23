# DCS — Passenger Check-in & Boarding (IATA-aligned prototype)

A Departure Control System prototype: two workstations — **check-in
agent** and **gate/boarding agent** — implementing the passenger
lifecycle from the booking list (PNL) through flight close-out (PFS),
including real boarding-pass encoding per **IATA Resolution 792
(BCBP)**.

See also:
- [`docs/IATA_NOTES.md`](docs/IATA_NOTES.md) — exactly what follows the
  IATA standards, and what's simplified.
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — the plan to grow this
  into a production system.
- [`docs/HOSTING.md`](docs/HOSTING.md) — cheap hosting options.
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — step-by-step deploy on Hetzner +
  Coolify (Dockerfile/docker-compose already included).

## Stack

- **Backend:** Node.js + Express + TypeScript, SQLite (`better-sqlite3`).
- **Frontend:** React + TypeScript + Vite.

## Run locally

```bash
# Backend
cd backend
npm install
npm run seed     # creates demo flights and passengers
npm run dev      # http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api to the backend
```

Open `http://localhost:5173` — a flight board with links to the
check-in and boarding workstations for each demo flight.

## End-to-end scenario

1. **Flight board** (`/`) — create a flight or open a demo one.
2. **Check-in** (`/checkin/:flightId`) — look up a PNR by surname or
   record locator, enter document data, pick a seat on the cabin map,
   record bags and SSRs, issue a boarding pass (a BCBP string per
   Resolution 792 is generated).
3. **Boarding** (`/boarding/:flightId`) — paste the BCBP string into the
   scan field (or click "Board" next to a passenger in the list); the
   system decodes it and cross-checks against the database. Offloading
   and flight close-out (with PFS) are also available here.
4. **Export** — the PNL/PFS buttons show messages styled after IATA
   Passenger Name List / Passenger Final Summary.

## Production build

```bash
cd backend && npm run build && npm start
cd frontend && npm run build   # static output in frontend/dist — serve via nginx or a static host
```

Before any real-world use, you must add authentication for the agent
workstations — in this prototype they are open with no login, as noted
in the code.
