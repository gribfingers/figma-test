import { useState } from "react";
import { Flight, Passenger } from "../../api";
import { FlightSegment } from "../../flightSegments";
import { SeatServiceItem } from "../../paxExtra";
import { ExtraServiceSelect } from "../ExtraServiceSelect";
import { SegmentsMultiSelect } from "../SegmentsMultiSelect";
import { extraServiceById, extraServiceDisplay } from "../../extraServiceTypes";
import { MinusIcon, PlusIcon, TrashIcon } from "../Icon";
import { EmdModal } from "./EmdModal";

interface ConfirmedItem {
  id: number;
  serviceId: string;
  price: number;
  paid: boolean;
}

let nextConfirmedId = 1;

// No pricing backend for ancillary services either — deterministic per
// confirmation, same "stable but not user-togglable" approach used
// everywhere else this session (seat/baggage extras, MCO references).
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

interface Props {
  flight: Flight;
  passenger: Passenger;
  segments: FlightSegment[];
  onConfirm: () => void;
}

/**
 * The check-in flow's Extra services step: pick a service (grouped by
 * Seats/Baggage/Other), which segment(s) it applies to, a quantity, then
 * Confirm adds it to the list below with a price (click to see the EMD).
 */
export function ExtraServicesStep({ flight, passenger, segments, onConfirm }: Props) {
  const [serviceId, setServiceId] = useState("");
  const [segmentsSel, setSegmentsSel] = useState<Set<number>>(() => new Set(segments.length ? [0] : []));
  const [qty, setQty] = useState(1);
  const [confirmed, setConfirmed] = useState<ConfirmedItem[]>([]);
  const [emdItem, setEmdItem] = useState<SeatServiceItem | null>(null);

  function confirm() {
    if (!serviceId) return;
    const id = nextConfirmedId++;
    const price = 12500 * qty;
    const paid = hashSeed(`${passenger.id}-${id}-${serviceId}`) % 3 !== 0;
    setConfirmed((prev) => [...prev, { id, serviceId, price, paid }]);
    setServiceId("");
    setSegmentsSel(new Set(segments.length ? [0] : []));
    setQty(1);
    onConfirm();
  }
  function removeConfirmed(id: number) {
    setConfirmed((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="extra-services-step">
      <div className="extra-services-form">
        <ExtraServiceSelect value={serviceId} onChange={setServiceId} />
        <SegmentsMultiSelect segments={segments} selected={segmentsSel} onChange={setSegmentsSel} />
        <div className="qty-stepper">
          <button type="button" className="qty-stepper-btn" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
            <MinusIcon size={14} />
          </button>
          <span className="qty-stepper-value">{qty}</span>
          <button type="button" className="qty-stepper-btn" onClick={() => setQty((q) => q + 1)} aria-label="Increase">
            <PlusIcon size={14} />
          </button>
        </div>
        <button type="button" className="tertiary" disabled={!serviceId} onClick={confirm}>Confirm</button>
      </div>

      {confirmed.length > 0 && (
        <div className="extra-services-list">
          {confirmed.map((c) => {
            const opt = extraServiceById(c.serviceId);
            return (
              <div key={c.id} className="extra-service-item">
                <div className="extra-service-item-main">
                  <span className="extra-service-item-name">{extraServiceDisplay(c.serviceId)}</span>
                  <div className="extra-service-item-progress">
                    <span /><span /><span /><span />
                  </div>
                </div>
                <button
                  type="button"
                  className={`extra-service-item-price ${c.paid ? "paid" : "unpaid"}`}
                  onClick={() => setEmdItem({ rfisc: opt?.code ?? "", label: opt?.label ?? "", price: c.price, paid: c.paid })}
                >
                  {c.price.toLocaleString("ru-RU")} ₽
                </button>
                <button type="button" className="extra-service-item-remove" onClick={() => removeConfirmed(c.id)} aria-label="Remove">
                  <TrashIcon size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {emdItem && <EmdModal flight={flight} passenger={passenger} item={emdItem} onClose={() => setEmdItem(null)} />}
    </div>
  );
}
