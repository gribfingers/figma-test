import { Passenger } from "../../api";
import { Modal } from "../Modal";

interface Props {
  passengers: Passenger[];
  onClose: () => void;
}

type FareStatus = "normal" | "refusal" | "payment";

interface FareRow {
  weight: number;
  status: FareStatus;
  passengerLabel: string;
  fare: string;
  tag: string;
  emd: string;
  surcharge: number | null;
}

// Deterministic per-PNR PRNG (Lehmer/Park-Miller) — same passenger list
// always generates the same fare rows, rather than reshuffling on every render.
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FARE_CODES = ["010", "020", "030", "OFB", "OFK", "053", "054", "0L1"];

function randDigits(rand: () => number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(rand() * 10);
  return out;
}

/** No fare-surcharge backend — deterministic from the PNR's passenger ids so the table doesn't reshuffle on every render. */
function buildFareRows(passengers: Passenger[]): FareRow[] {
  if (passengers.length === 0) return [];
  const rand = seededRandom(passengers.reduce((acc, p) => acc + p.id, 0) * 7919 + 11);
  const rows: FareRow[] = [];
  for (const p of passengers) {
    const bagCount = 1 + Math.floor(rand() * 2); // 1-2 bags per passenger
    for (let i = 0; i < bagCount; i++) {
      const roll = rand();
      const status: FareStatus = roll < 0.15 ? "refusal" : roll < 0.3 ? "payment" : "normal";
      rows.push({
        weight: 5 + Math.floor(rand() * 46),
        status,
        passengerLabel: status === "refusal" ? "Refusal" : status === "payment" ? "Payment on site" : `${p.surname} ${p.given_name}`,
        fare: status === "refusal" ? "" : FARE_CODES[Math.floor(rand() * FARE_CODES.length)],
        tag: randDigits(rand, 17),
        emd: randDigits(rand, 10),
        surcharge: status === "payment" ? 1 + Math.floor(rand() * 5) : null,
      });
    }
  }
  return rows;
}

/** Static per-PNR baggage-fares summary (no fare-surcharge backend) — opened from the Baggage step's info icon. */
export function BaggageFaresModal({ passengers, onClose }: Props) {
  const rows = buildFareRows(passengers);
  const total = rows.reduce((sum, r) => sum + (r.surcharge ?? 0), 0);

  return (
    <Modal
      title="Baggage Fares"
      onClose={onClose}
      width={900}
      footer={
        <button type="button" className="tertiary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="baggage-fares-table-wrap">
        <table className="baggage-fares-table">
          <thead>
            <tr>
              <th>Weight, kg</th>
              <th>Passenger</th>
              <th>Fare</th>
              <th>Tag</th>
              <th>EMD</th>
              <th>Surcharge, ₽</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.weight}</td>
                <td className={r.status === "refusal" ? "baggage-fares-refusal" : r.status === "payment" ? "baggage-fares-payment" : undefined}>
                  {r.passengerLabel}
                </td>
                <td>{r.fare}</td>
                <td className="mono">{r.tag}</td>
                <td className="mono">{r.emd}</td>
                <td>{r.surcharge ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="baggage-fares-total">
        <span>Total surcharge, ₽</span>
        <span className="baggage-fares-total-leader" />
        <span>{total}</span>
      </div>
    </Modal>
  );
}
