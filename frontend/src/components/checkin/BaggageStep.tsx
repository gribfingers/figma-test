import { useRef, useState } from "react";
import { Flight, Passenger } from "../../api";
import { FlightSegment } from "../../flightSegments";
import { BagRow, CARRY_ON_TYPES, baggageTypeDisplay } from "../../baggageTypes";
import { SeatServiceItem } from "../../paxExtra";
import { BaggageTypeSelect } from "../BaggageTypeSelect";
import { Select } from "../Select";
import { ArrowNestedIcon, CloseIcon, InfoIcon, PrinterIcon, RefreshIcon, TagIcon } from "../Icon";
import { BaggageFaresModal } from "./BaggageFaresModal";
import { EmdModal } from "./EmdModal";
import { McoModal } from "./McoModal";
import { TagManualModal } from "./TagManualModal";
import { TransferBagModal } from "./TransferBagModal";
import { useToast } from "../../toast";

interface CarryOnRow {
  id: number;
  weight: string;
  typeId: string;
  mcoRef: string | null;
}

let nextRowId = 1;

function emptyBagRow(destination: string): BagRow {
  return {
    id: nextRowId++,
    destination,
    weight: "",
    typeId: "",
    tagNumber: "",
    daa: false,
    dmg: false,
    printStatus: "idle",
  };
}
function emptyCarryOnRow(): CarryOnRow {
  return { id: nextRowId++, weight: "", typeId: CARRY_ON_TYPES[0].id, mcoRef: null };
}

// No pricing/paid-status backend for baggage tags — deterministic from the
// row's own content (same "stable but not user-togglable" approach as the
// roster card's paid/unpaid extras) so a filled-in row doesn't flicker
// color between renders.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}
function rowPaid(seed: string): boolean {
  return hashSeed(seed) % 3 !== 0;
}
// No real printer either — a row's first print attempt fails deterministically
// about a third of the time ("out of ink") so the error state is reachable
// without being a coin flip on every click; retrying always succeeds.
function printSucceeds(seed: string): boolean {
  return hashSeed(`print-${seed}`) % 3 !== 0;
}
/** Auto-assigned when a bag is printed without a manually-entered tag number. */
function autoTagNumber(seed: string): string {
  return String(10000000 + (hashSeed(`tag-${seed}`) % 90000000));
}

interface Props {
  flight: Flight;
  passenger: Passenger;
  /** The full checked-in roster on this PNR — offered as "Transfer to another passenger" targets. */
  passengers: Passenger[];
  segments: FlightSegment[];
  /** This passenger's bag rows as last lifted to PnrView — resumed here on remount (switching back to this passenger). */
  initialRows: BagRow[];
  /** Fires with the full row list on every change — the roster card's checked-bag items mirror this live. */
  onRowsChange: (rows: BagRow[]) => void;
  /** Reveals this passenger's baggage prices on their roster card — nothing shows there until Calculate has actually run. */
  onCalculate: () => void;
}

/**
 * The check-in flow's Baggage step: one row per checked bag (route, tag
 * number, tariff type, print/remove), plus a separate carry-on list. No
 * bag-tag backend exists yet, so printing is simulated locally: idle (not
 * ready) -> ready (blue) -> printed (green, row locks to read-only, the
 * remove action becomes "undo") or, occasionally, error (red, retry).
 */
export function BaggageStep({ flight, passenger, passengers, segments, initialRows, onRowsChange, onCalculate }: Props) {
  const [rows, setRows] = useState<BagRow[]>(() => (initialRows.length > 0 ? initialRows : [emptyBagRow(flight.destination)]));
  const [carryOn, setCarryOn] = useState<CarryOnRow[]>([]);

  // Central mutation point for `rows` so every change (add/remove/edit) is immediately mirrored
  // up to PnrView — same live-mirroring approach ExtraServicesStep uses for its confirmed items.
  function mutateRows(updater: (prev: BagRow[]) => BagRow[]) {
    setRows((prev) => {
      const next = updater(prev);
      onRowsChange(next);
      return next;
    });
  }
  const [infoOpen, setInfoOpen] = useState(false);
  const [mcoRowId, setMcoRowId] = useState<number | null>(null);
  const [manualTagRowId, setManualTagRowId] = useState<number | null>(null);
  const [transferRowId, setTransferRowId] = useState<number | null>(null);
  const [emdItem, setEmdItem] = useState<SeatServiceItem | null>(null);
  // Paid/unpaid coloring on a row's Type value is a Calculate result — stays neutral until Calculate has actually run.
  const [calculated, setCalculated] = useState(false);
  const { showToast } = useToast();
  const seedRef = useRef(passenger.id);
  const otherPassengers = passengers.filter((p) => p.id !== passenger.id);

  // A bag can only be checked to one of this flight's actual stops — on a
  // single-segment flight that's just the destination, so there's nothing to
  // choose and the field doesn't show at all.
  const destinationOptions = [...new Set(segments.map((s) => s.destination))].map((code) => ({ value: code, label: code }));

  function updateRow(id: number, patch: Partial<BagRow>) {
    mutateRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: number) {
    mutateRows((prev) => prev.filter((r) => r.id !== id));
  }
  function attemptPrint(row: BagRow, isRetry: boolean) {
    const seed = `${seedRef.current}-${row.id}-${row.weight}-${row.typeId}`;
    if (!isRetry && !printSucceeds(seed)) {
      updateRow(row.id, { printStatus: "error" });
      showToast("Print failed: Error 111, out of ink", "error");
      return;
    }
    updateRow(row.id, { printStatus: "printed", tagNumber: row.tagNumber || autoTagNumber(seed) });
    showToast(isRetry ? "Bag tag reprinted" : "Bag tag printed");
  }

  function updateCarryOn(id: number, patch: Partial<CarryOnRow>) {
    setCarryOn((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeCarryOn(id: number) {
    setCarryOn((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="baggage-step">
      <div className="docs-step-top">
        <button type="button" className="tertiary docs-add-link" onClick={() => mutateRows((prev) => [...prev, emptyBagRow(flight.destination)])}>
          Add baggage
        </button>
        <div className="baggage-step-actions">
          <button type="button" className="icon-button" aria-label="Baggage allowance" onClick={() => setInfoOpen(true)}>
            <InfoIcon size={18} />
          </button>
          {/* No bag-tag print preview wired up — present for layout, no action yet. */}
          <button type="button" className="icon-button" aria-label="Bag tag">
            <TagIcon size={18} />
          </button>
          <button
            type="button"
            className="tertiary"
            onClick={() => {
              onCalculate();
              setCalculated(true);
              showToast("Baggage prices calculated");
            }}
          >
            Calculate
          </button>
          <button type="button" className="tertiary" onClick={() => showToast("Baggage confirmed")}>Confirm</button>
        </div>
      </div>

      <div className="baggage-rows">
        {rows.map((row) => {
          const complete = !!row.weight && !!row.typeId;
          const tone = calculated && complete ? (rowPaid(`${seedRef.current}-${row.id}-${row.weight}-${row.typeId}`) ? "paid" : "unpaid") : "neutral";
          const locked = row.printStatus === "printed";
          return (
            <div key={row.id} className={`baggage-row baggage-row-${row.printStatus}`}>
              {segments.length > 1 && (
                <>
                  <span className="baggage-row-origin">{flight.origin} -</span>
                  {locked ? (
                    <span className="baggage-row-static mono">{row.destination}</span>
                  ) : (
                    <Select
                      label="To"
                      value={row.destination}
                      onChange={(v) => updateRow(row.id, { destination: v })}
                      options={destinationOptions}
                      style={{ width: 110 }}
                    />
                  )}
                </>
              )}
              {locked ? (
                <span className="baggage-row-static baggage-row-static-weight mono">{row.weight} kg</span>
              ) : (
                <div className="field2" style={{ width: 110 }}>
                  <input
                    value={row.weight}
                    placeholder=" "
                    onChange={(e) => updateRow(row.id, { weight: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  />
                  <label>Weight, kg</label>
                </div>
              )}
              {locked ? (
                <span className="baggage-row-static baggage-row-static-type">{baggageTypeDisplay(row.typeId)}</span>
              ) : (
                <BaggageTypeSelect
                  label="Type"
                  value={row.typeId}
                  onChange={(id) => updateRow(row.id, { typeId: id })}
                  style={{ flex: 1 }}
                  tone={tone}
                  disabled={!row.weight}
                />
              )}

              {row.printStatus === "error" ? (
                <button
                  type="button"
                  className="baggage-row-print error"
                  onClick={() => attemptPrint(row, true)}
                  title="Error 111, out of ink"
                  aria-label="Retry print"
                >
                  <RefreshIcon size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className={`baggage-row-print ${row.printStatus === "printed" ? "printed" : ""}`}
                  disabled={!complete}
                  onClick={() => attemptPrint(row, false)}
                  aria-label="Print bag tag"
                >
                  <PrinterIcon size={18} />
                </button>
              )}

              {locked ? (
                <button type="button" className="baggage-row-undo" onClick={() => updateRow(row.id, { printStatus: "idle" })} aria-label="Return bag">
                  <ArrowNestedIcon size={16} />
                </button>
              ) : (
                <button type="button" className="baggage-row-remove" onClick={() => removeRow(row.id)} aria-label="Remove">
                  <CloseIcon size={16} />
                </button>
              )}

              {!!row.typeId && (
                <div className="baggage-row-detail baggage-row-detail-full">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setEmdItem({ rfisc: "0B5", label: baggageTypeDisplay(row.typeId), price: 12500, paid: tone === "paid" })}
                  >
                    EMD
                  </button>
                  {row.tagNumber ? (
                    <span className="baggage-row-tag-display mono">Tag {row.tagNumber}</span>
                  ) : (
                    <button type="button" className="link-btn" onClick={() => setManualTagRowId(row.id)}>Tag manually</button>
                  )}
                  <button type="button" className="link-btn" onClick={() => setTransferRowId(row.id)} disabled={otherPassengers.length === 0}>
                    Transfer to another passenger
                  </button>
                  <div className="baggage-row-detail-checks">
                    <label className="baggage-row-check">
                      <input type="checkbox" checked={row.daa} onChange={(e) => updateRow(row.id, { daa: e.target.checked })} />
                      DAA
                    </label>
                    <label className="baggage-row-check">
                      <input type="checkbox" checked={row.dmg} onChange={(e) => updateRow(row.id, { dmg: e.target.checked })} />
                      DMG
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="baggage-carryon-section">
        <button type="button" className="tertiary docs-add-link baggage-carryon-add" onClick={() => setCarryOn((prev) => [...prev, emptyCarryOnRow()])}>
          Add carry-on
        </button>
        {carryOn.length > 0 && (
          <div className="baggage-carryon-rows">
            {carryOn.map((row) => (
              <div key={row.id} className="baggage-row baggage-row-carryon">
                <span className="baggage-carryon-type">{baggageTypeDisplay(row.typeId)}</span>
                <div className="field2" style={{ width: 110 }}>
                  <input
                    value={row.weight}
                    placeholder=" "
                    onChange={(e) => updateCarryOn(row.id, { weight: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  />
                  <label>Weight, kg</label>
                </div>
                <button type="button" className="baggage-row-remove" onClick={() => removeCarryOn(row.id)} aria-label="Remove">
                  <CloseIcon size={16} />
                </button>
                {!!row.weight && (
                  row.mcoRef ? (
                    <span className="baggage-mco-ref mono">MCO #{row.mcoRef}</span>
                  ) : (
                    <button type="button" className="link-btn" onClick={() => setMcoRowId(row.id)}>Insert MCO</button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {infoOpen && <BaggageFaresModal passengers={passengers} onClose={() => setInfoOpen(false)} />}
      {mcoRowId !== null && (
        <McoModal
          reference={String(100000 + (hashSeed(`mco-${seedRef.current}-${mcoRowId}`) % 900000))}
          onClose={() => {
            const ref = String(100000 + (hashSeed(`mco-${seedRef.current}-${mcoRowId}`) % 900000));
            updateCarryOn(mcoRowId, { mcoRef: ref });
            setMcoRowId(null);
          }}
        />
      )}
      {manualTagRowId !== null && (
        <TagManualModal
          initial={rows.find((r) => r.id === manualTagRowId)?.tagNumber ?? ""}
          onConfirm={(tag) => {
            updateRow(manualTagRowId, { tagNumber: tag });
            setManualTagRowId(null);
          }}
          onClose={() => setManualTagRowId(null)}
        />
      )}
      {transferRowId !== null && (
        <TransferBagModal
          passengers={otherPassengers}
          onConfirm={(target) => {
            removeRow(transferRowId);
            showToast(`Bag transferred to ${target.surname} ${target.given_name}`);
            setTransferRowId(null);
          }}
          onClose={() => setTransferRowId(null)}
        />
      )}
      {emdItem && <EmdModal flight={flight} passenger={passenger} item={emdItem} onClose={() => setEmdItem(null)} />}
    </div>
  );
}
