import { useEffect, useRef, useState } from "react";
import { api, SeatCell } from "../api";
import { CabinFeature } from "../cabinLayout";
import { SEAT_ATTRS, SeatExtra, parseSeatExtra } from "../seatExtra";
import { SeatMapGrid } from "./SeatMapGrid";
import { Modal } from "./Modal";
import { Field } from "./Field";
import { HideIcon, LayersIcon, MinusIcon, PlusIcon, RowsIcon } from "./Icon";

interface Props {
  flightId: number;
  seats: SeatCell[];
  selected?: string | null;
  onSelect?: (seat: string) => void;
  onSeatUpdated: (seat: SeatCell) => void;
  onHide?: () => void;
  cabinFeatures?: CabinFeature[];
  onSelectOccupied?: (seat: SeatCell) => void;
  disabledSeats?: Set<string>;
  /** Right-click seat attribute editing (exit-row/blocking/service/pricing) — a flight-config action, not appropriate everywhere the map is embedded (e.g. the check-in flow). Defaults to on. */
  allowSeatEdit?: boolean;
}

const LEGEND_STATES: { cls: string; label: string }[] = [
  { cls: "", label: "Free" },
  { cls: "seat-checked-in", label: "Checked-in" },
  { cls: "seat-boarded", label: "Boarded" },
];

// Hold markers overlay any of the three states above (a checked-in seat can
// also be reserved, etc.) rather than being states of their own.
const LEGEND_HOLDS: { cls: string; label: string }[] = [
  { cls: "seat-subtype-presit", label: "Предрассажен" },
  { cls: "seat-subtype-booked", label: "Забронировано" },
];

/**
 * Seat map with the reference toolbar: deck switcher (this app's aircraft
 * are all single-deck, so "Upper Deck" is a disabled placeholder), zoom
 * (CSS transform: scale), a legend popover, a layers menu that toggles
 * which attribute icons render on the map, and hide. Right-clicking any
 * seat opens the attribute editor (exit-row/blocking/service/pricing) —
 * this app's addition, not in the reference toolbar.
 */
export function SeatMapPanel({
  flightId,
  seats,
  selected,
  onSelect,
  onSeatUpdated,
  onHide,
  cabinFeatures,
  onSelectOccupied,
  disabledSeats,
  allowSeatEdit = true,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const [legendOpen, setLegendOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<SeatCell | null>(null);
  // Three layers on the seat map, per the reference spec: attribute icons, price, RFISC — all shown by default.
  const [showIcons, setShowIcons] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showRfisc, setShowRfisc] = useState(true);

  const legendRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false);
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const LAYER_TOGGLES = [
    { label: "Иконки", checked: showIcons, toggle: () => setShowIcons((v) => !v) },
    { label: "Цена", checked: showPrice, toggle: () => setShowPrice((v) => !v) },
    { label: "RFISC", checked: showRfisc, toggle: () => setShowRfisc((v) => !v) },
  ];

  return (
    <div className="seatmap-panel">
      <div className="seatmap-toolbar">
        <div className="seatmap-decks">
          <button type="button" className="seatmap-deck selected">Main Deck</button>
          <button type="button" className="seatmap-deck" disabled title="This aircraft has no upper deck">Upper Deck</button>
        </div>
        <div className="seatmap-toolbar-actions">
          <div className="seatmap-zoom">
            <button type="button" className="seatmap-zoom-btn" onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out">
              <MinusIcon size={14} />
            </button>
            <span className="seatmap-zoom-value">{zoom}%</span>
            <button type="button" className="seatmap-zoom-btn" onClick={() => setZoom((z) => Math.min(150, z + 10))} aria-label="Zoom in">
              <PlusIcon size={14} />
            </button>
          </div>
          <div className="seatmap-popover-anchor" ref={legendRef}>
            <button type="button" className="seatmap-tool-btn" title="Legend" onClick={() => setLegendOpen((o) => !o)}>
              <RowsIcon size={16} />
            </button>
            {legendOpen && (
              <div className="seatmap-legend">
                <div className="seatmap-legend-states">
                  {LEGEND_STATES.map((s) => (
                    <div key={s.label} className="seatmap-legend-row">
                      <span className={`seat seatmap-legend-swatch ${s.cls}`} />
                      {s.label}
                    </div>
                  ))}
                  {LEGEND_HOLDS.map((s) => (
                    <div key={s.label} className="seatmap-legend-row">
                      <span className="seatmap-legend-swatch seat-free-swatch">
                        <span className={`seat-subtype-bar ${s.cls}`} />
                      </span>
                      {s.label}
                    </div>
                  ))}
                </div>
                <div className="seatmap-legend-attrs">
                  {SEAT_ATTRS.map((a) => (
                    <div key={a.key} className="seatmap-legend-row">
                      <a.icon size={14} />
                      {a.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="seatmap-popover-anchor" ref={layersRef}>
            <button type="button" className="seatmap-tool-btn" title="Layers" onClick={() => setLayersOpen((o) => !o)}>
              <LayersIcon size={16} />
            </button>
            {layersOpen && (
              <ul className="select-menu seatmap-layers-list">
                {LAYER_TOGGLES.map((l) => (
                  <li key={l.label} className="pax-columns-item" onClick={l.toggle}>
                    <input type="checkbox" checked={l.checked} readOnly />
                    {l.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {onHide && (
            <button type="button" className="seatmap-tool-btn" title="Hide seat map" onClick={onHide}>
              <HideIcon size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="seatmap-scroll">
        <div className="seatmap-zoom-wrap" style={{ transform: `scale(${zoom / 100})` }}>
          <SeatMapGrid
            seats={seats}
            selected={selected}
            onSelect={onSelect}
            onEditSeat={allowSeatEdit ? setEditingSeat : undefined}
            showIcons={showIcons}
            showPrice={showPrice}
            showRfisc={showRfisc}
            cabinFeatures={cabinFeatures}
            onSelectOccupied={onSelectOccupied}
            disabledSeats={disabledSeats}
          />
        </div>
      </div>

      {editingSeat && (
        <SeatEditorModal
          flightId={flightId}
          seat={editingSeat}
          onClose={() => setEditingSeat(null)}
          onSaved={(updated) => {
            onSeatUpdated(updated);
            setEditingSeat(null);
          }}
        />
      )}
    </div>
  );
}

function SeatEditorModal({
  flightId,
  seat,
  onClose,
  onSaved,
}: {
  flightId: number;
  seat: SeatCell;
  onClose: () => void;
  onSaved: (s: SeatCell) => void;
}) {
  const initial = parseSeatExtra(seat);
  const [extra, setExtra] = useState<SeatExtra>(initial);
  const [exitRow, setExitRow] = useState(!!seat.exit_row);
  const [saving, setSaving] = useState(false);

  function toggle(key: keyof SeatExtra) {
    setExtra((e) => ({ ...e, [key]: !e[key] }));
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateSeat(flightId, seat.seat, { exit_row: exitRow, extra: JSON.stringify(extra) });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Seat ${seat.seat}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>Close</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>Save</button>
        </>
      }
    >
      <div className="seat-editor">
        <label className="seat-editor-check">
          <input type="checkbox" checked={exitRow} onChange={(e) => setExitRow(e.target.checked)} />
          Аварийное (exit row)
        </label>
        {SEAT_ATTRS.map((a) => (
          <label key={a.key} className="seat-editor-check">
            <input type="checkbox" checked={!!extra[a.key]} onChange={() => toggle(a.key)} />
            <a.icon size={14} />
            {a.label}
          </label>
        ))}
        <label className="seat-editor-check">
          <input type="checkbox" checked={!!extra.preseated} onChange={() => toggle("preseated")} />
          Предрассажен
        </label>
        <label className="seat-editor-check">
          <input type="checkbox" checked={!!extra.reserved} onChange={() => toggle("reserved")} />
          Забронировано
        </label>
        <div className="seat-editor-row">
          <Field label="Price" style={{ width: 100 }}>
            <input
              type="number"
              min={0}
              max={999999}
              value={extra.price ?? ""}
              placeholder=" "
              onChange={(e) => {
                const v = e.target.value ? Math.min(999999, Number(e.target.value)) : undefined;
                setExtra((ex) => ({ ...ex, price: v }));
              }}
            />
          </Field>
          <label className="seat-editor-check" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={!!extra.priceIcon} onChange={() => toggle("priceIcon")} />
            Цена + иконка
          </label>
        </div>
        <Field label="RFISC" style={{ marginBottom: 16 }}>
          <input
            value={extra.rfisc ?? ""}
            placeholder=" "
            onChange={(e) => setExtra((ex) => ({ ...ex, rfisc: e.target.value.toUpperCase() || undefined }))}
          />
        </Field>
      </div>
    </Modal>
  );
}
