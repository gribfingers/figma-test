#!/usr/bin/env node
/**
 * One-off utility: back-fill aircraft_reg / aircraft_version on flights that
 * don't have them yet (e.g. the live SVO schedule seeded from Yandex Rasp,
 * before those two FIDS columns existed). Safe to re-run — it only touches
 * flights where either field is still empty, so anything set by hand or by
 * a previous run is left alone.
 *
 * Usage:
 *   node scripts/patch-aircraft-info.mjs <api-base-url>
 *   node scripts/patch-aircraft-info.mjs http://localhost:4000
 */

const apiBase = process.argv[2];
if (!apiBase) {
  console.error("Usage: node scripts/patch-aircraft-info.mjs <api-base-url>");
  console.error("e.g.:  node scripts/patch-aircraft-info.mjs http://localhost:4000");
  process.exit(1);
}

// Cabin config codes (C=Business, Y=Economy) for common narrow-body types
// operated on Aeroflot-group SVO routes. Extend this as needed.
const VERSION_BY_TYPE = {
  A320: "C18Y162",
  A21N: "C20Y194",
  A321: "C24Y174",
  A20N: "C18Y150",
  A330: "C36Y198",
  A319: "C16Y120",
  B738: "C24Y168",
  B737: "C16Y126",
  B739: "C20Y179",
  B77W: "C28Y374",
  B788: "C24Y226",
  B789: "C30Y247",
  SU9: "C12Y75", // Sukhoi Superjet 100 (SSJ100 / RRJ-95)
  SSJ100: "C12Y75",
  E190: "C8Y96",
  E170: "C8Y64",
  CR2: "C0Y50", // CRJ-200
};
const FALLBACK_VERSION = "C12Y150"; // used only when aircraft_type isn't in the table above

function regFor(flightId) {
  const n = (800 + flightId * 37) % 9000;
  return `K${String(n).padStart(4, "0")}`;
}

function versionFor(aircraftType) {
  return VERSION_BY_TYPE[aircraftType] ?? FALLBACK_VERSION;
}

async function main() {
  const res = await fetch(`${apiBase}/api/flights`);
  if (!res.ok) throw new Error(`GET /api/flights failed: ${res.status} ${await res.text()}`);
  const flights = await res.json();

  const todo = flights.filter((f) => !f.aircraft_reg || !f.aircraft_version);
  if (todo.length === 0) {
    console.log("Every flight already has aircraft_reg and aircraft_version — nothing to do.");
    return;
  }

  console.log(`${todo.length} of ${flights.length} flights need aircraft_reg/aircraft_version:\n`);

  for (const f of todo) {
    const aircraft_reg = f.aircraft_reg ?? regFor(f.id);
    const aircraft_version = f.aircraft_version ?? versionFor(f.aircraft_type);
    const usedFallback = !VERSION_BY_TYPE[f.aircraft_type];

    const patchRes = await fetch(`${apiBase}/api/flights/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aircraft_reg, aircraft_version }),
    });
    if (!patchRes.ok) {
      console.error(`  ✗ #${f.id} ${f.carrier_code}${f.flight_number}: PATCH failed (${patchRes.status})`);
      continue;
    }
    const flag = usedFallback ? "  (fallback version — unknown aircraft_type, double-check)" : "";
    console.log(`  ✓ #${f.id} ${f.carrier_code}${f.flight_number} (${f.aircraft_type}) -> reg=${aircraft_reg} version=${aircraft_version}${flag}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
