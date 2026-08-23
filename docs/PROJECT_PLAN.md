# Project plan: passenger check-in and boarding system (DCS)

## 1. Goal and current status

The goal is a working Departure Control System (DCS) with two
workstations (check-in agent, boarding agent) implementing the
passenger lifecycle from booking (PNL) through flight close-out (PFS),
following the core concepts of IATA.

**Status as of this iteration:** a working prototype (MVP) is
implemented and tested — see `README.md` to run it, and
`docs/IATA_NOTES.md` for an exact map of standards compliance.

## 2. Project phases

### Phase 0 — Requirements and compliance scope (1–2 weeks)
- Pin down which IATA/ATA documents are mandatory for the project:
  Resolution 792 (BCBP), the PSC Resolutions Manual (SSR), Reservations
  Interline Message Procedures (PNL/ADL/PFS), the Airport Handling
  Manual (AHM, load control), DGR (dangerous goods, if cargo/baggage is
  in scope).
- Define the target airline/hub, aircraft types, concurrent-flight
  volume, backup and SLA requirements.
- Legal requirements: handling passengers' personal data (GDPR or local
  equivalent depending on jurisdiction), document retention.

**Output:** a requirements document and a register of applicable
standards.

### Phase 1 — MVP: check-in and boarding (delivered this iteration)
- Backend: Node/Express + SQLite, Flight/Passenger/Seat models.
- Boarding-pass encode/decode (BCBP, Res. 792).
- Check-in agent workstation: PNR lookup, document verification, seat
  map, SSR, bags, boarding-pass issuance.
- Boarding agent workstation: scan (BCBP entry), boarding statuses,
  offloading, flight close-out, PNL/PFS export.

**Output:** a demonstrable prototype (this repository).

### Phase 2 — Integration with the DCS/PSS ecosystem (6–8 weeks)
- Real EDIFACT (PADIS: PSLIST, ADLIST, etc.) or Type B teletype exchange
  with the reservation system (PSS/GDS) — replacing the simplified
  text-based PNL/ADL/PFS.
- Connection to an external flight schedule / slot management system.
- Integration with a payment/fare system for excess baggage.

### Phase 3 — Weight & Balance (4 weeks)
- ZFW, MACTOW, and centre-of-gravity index calculation from AHM data
  for the specific aircraft type.
- Automatic balancing of passenger/baggage distribution across load
  zones.

### Phase 4 — Baggage handling (4 weeks)
- Printing baggage tags per the IATA standard (BSM/BTM messages,
  License Plate Number tag format).
- Integration with the airport's baggage handling system (BHS).
- Baggage tracking (RFID/barcode), tracing (AHL/BAGGAGE messages).

### Phase 5 — Self-service check-in and mobile boarding pass (4 weeks)
- Self-check-in kiosks, web/mobile passenger check-in.
- Mobile boarding pass (Apple Wallet / Google Wallet, a real 2D barcode
  — PDF417/Aztec — instead of a text field).
- Biometric boarding (optional, airport-dependent).

### Phase 6 — Operational resilience and security (ongoing)
- Database redundancy (moving to managed PostgreSQL), fault tolerance.
- Agent authentication and role-based access (workstations are currently
  open with no login — this must be closed before real use).
- Agent action auditing, logging, personal-data protection.
- Load testing for peak boarding (widebody flights, charter peaks).

### Phase 7 — Pilot rollout and certification (4–6 weeks)
- Testing with real data on one flight/gate.
- Acceptance testing with check-in and boarding agents.
- A fallback plan (paper/backup process) in case of system failure.

## 3. Team roles

| Role | Responsibility |
|---|---|
| Project manager | timeline, risk, coordination with the airport/airline |
| DCS/IATA business analyst | requirements, standards compliance, acceptance |
| Backend engineer(s) | API, EDIFACT/PSS integrations, Weight & Balance |
| Frontend engineer | agent workstations, UX for operational staff |
| DevOps | hosting, CI/CD, monitoring, backups |
| QA engineer | check-in/boarding test scenarios, load testing |
| Security & data-protection specialist | access control, encryption, legal compliance |

## 4. Key risks

- **Integration with the airline's existing PSS/GDS** — the most
  labor-intensive and unpredictable item (often requires certification
  with the GDS provider).
- **Network/hardware failure at the gate** — an offline boarding mode
  (a local cache of the passenger list) is needed.
- **Border-control compliance (APIS/ETD)** — mandatory by law in many
  jurisdictions, not optional.
- **Personal data security** — passport data and date of birth are
  sensitive information, requiring encryption at rest and access
  control.

## 5. Rough timeline

The MVP (this iteration) is done. A full production-grade system
(phases 2–7) realistically takes **6–9 months** with a team of 4–6
people, depending on the depth of integration with a specific
airline/PSS.
