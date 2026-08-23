# Compliance with IATA standards — what's implemented, what's simplified

This prototype deliberately follows the core concepts of an IATA DCS
(Departure Control System), but it is not a certified implementation.
Below is an honest map: what's close to the real standard, and what's
simplified for the sake of a demonstration-scale project.

## 1. Boarding pass (BCBP) — IATA Resolution 792

Implemented in `backend/src/bcbp.ts`:

- The full mandatory 60-character BCBP header structure for a single
  flight leg: format code, passenger name (20 chars), electronic-ticket
  indicator, operating carrier's PNR code, origin/destination airports,
  carrier code and flight number, Julian date (day of year), class of
  service, seat number, check-in sequence number, passenger status.
- Encoding and decoding in both directions (`encodeBcbp` / `decodeBcbp`),
  verified end to end: check-in → boarding pass issued → gate scan →
  decode → cleared to board.

Simplified / not implemented:

- Multi-leg itineraries (the "number of legs" field is always 1).
- Second-level conditional items: frequent-flyer number, bag tag
  numbers, fast-track indicator, structured message, etc. — the
  "field size of variable-size field" is always `00`.
- Actually printing a 2D barcode (PDF417/Aztec) on the boarding pass —
  in the boarding agent's UI the barcode is entered manually (the raw
  BCBP text string); the "barcode" graphic shown on the boarding pass is
  a stylised visual, not something a real scanner could read.

## 2. DCS messaging — PNL / ADL / PFS

Implemented in `backend/src/edifact.ts`: text messages styled after the
historical IATA Type B passenger list messages (Passenger Name List,
Additions/Deletions List, Passenger Final/Flight Summary List), with a
flight/date/route header and a line-by-line passenger list including
SSRs.

Simplified / not implemented:

- Actual UN/EDIFACT syntax (UNB/UNH/UNT segments, PADIS message types
  like PSLIST/ADLIST, etc.) and Type B teletype addressing (SITA/ARINC
  addresses, routing indicators) — a separate, sizeable protocol
  requiring certification and connection to a specific GDS/hosting
  provider's network.
- ADL here is computed from the check-in sequence number rather than
  reservation action codes (a real ADL uses RT/action codes).

## 3. Special Service Requests (SSR)

A subset of the standard ATA/IATA SSR codes is used: `WCHR`, `WCHS`,
`UMNR`, `BLND`, `DEAF`, `VGML`, `PETC`, `EXST` — the full SSR code list
(hundreds of values) is not reproduced.

## 4. Passenger documents / APIS

Document verification at check-in is a simplified analogue of APIS
(Advance Passenger Information System): document expiry is checked
against the flight date. Real APIS requires transmitting data to border
control authorities in a specific format (UN/EDIFACT PAXLST) and parsing
the passport's machine-readable zone (MRZ) — not implemented.

## 5. Seat map and boarding

The seat map generator (`backend/src/utils/seatmap.ts`) uses
demonstration templates for A320/B738 (business/economy, exit rows) —
not the real configuration of a specific tail number (that comes from
the airline's AHM Aircraft Type Configuration data).

## 6. Weight & Balance

The PFS only carries basic aggregates (passenger count, infants, total
bag weight) — illustrating the spirit of load-control data per the IATA
Airport Handling Manual (AHM), but not a full centre-of-gravity
calculation (ZFW, MACTOW, trim index, etc.), which is handled by a
separate Weight & Balance system.

## Summary

The prototype correctly reproduces the **structure and lifecycle** of
DCS data (PNR → check-in → boarding pass → boarding → flight close-out
→ final list), including a genuinely working BCBP algorithm. Production
use would require: a certified EDIFACT/Type B integration with a
PSS/GDS, full Weight & Balance, integration with government systems
(APIS/ETD), baggage handling (BSM/BTM), resilience, and information
security — see `PROJECT_PLAN.md`.
