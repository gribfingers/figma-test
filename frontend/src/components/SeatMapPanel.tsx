import { ReactNode, useEffect, useRef, useState } from "react";
import { api, SeatCell } from "../api";
import { CabinFeature } from "../cabinLayout";
import { SEAT_ATTRS, SeatExtra, parseSeatExtra } from "../seatExtra";
import { SeatMapGrid } from "./SeatMapGrid";
import { Modal } from "./Modal";
import { Field } from "./Field";
import { HideIcon, LayersIcon, MinusIcon, OrientationToggleIcon, PlusIcon, RowsIcon, SeatChildIcon } from "./Icon";
import { SeatInfoPopover } from "./SeatInfoPopover";
import { SeatHistoryModal } from "./SeatHistoryModal";
import { useLanguage } from "../i18n";

interface Props {
  flightId: number;
  seats: SeatCell[];
  selected?: string | null;
  onSelect?: (seat: string) => void;
  onSeatUpdated: (seat: SeatCell) => void;
  onHide?: () => void;
  cabinFeatures?: CabinFeature[];
  onSelectOccupied?: (seat: SeatCell) => void;
  onUnassign?: (seat: string) => void;
  ineligibleSeats?: Set<string>;
  undesirableSeats?: Set<string>;
  /** Right-click seat attribute editing (exit-row/blocking/service/pricing) — a flight-config action, not appropriate everywhere the map is embedded (e.g. the check-in flow). Defaults to on. */
  allowSeatEdit?: boolean;
  /** An in-progress-pick message (e.g. "Select a pax's seat to swap with X") shown inline in the toolbar, between the deck switcher and zoom/legend/layers — not floated over the grid. */
  banner?: ReactNode;
  /** Shows the vertical/horizontal orientation toggle in the toolbar — off by default, and only
   *  turned on where it's been rolled out so far (the Pax tab's seat map), not on every embedding
   *  of this panel. */
  allowOrientationToggle?: boolean;
  /** Controlled orientation — pass both this and onOrientationChange when the caller's own layout
   *  needs to react to orientation too (e.g. the Pax tab stacking its passenger list above the map
   *  instead of beside it once rotated). Uncontrolled (manages its own state) when omitted. */
  orientation?: "vertical" | "horizontal";
  onOrientationChange?: (orientation: "vertical" | "horizontal") => void;
}

const LEGEND_STATES: { cls: string; label: string }[] = [
  { cls: "", label: "Free" },
  { cls: "seat-checked-in", label: "Checked-in" },
  { cls: "seat-boarded", label: "Boarded" },
];

// Hold markers overlay any of the three states above (a checked-in seat can
// also be reserved, etc.) rather than being states of their own.
const LEGEND_HOLDS: { cls: string; label: string }[] = [
  { cls: "seat-subtype-presit", label: "Pre-seated" },
  { cls: "seat-subtype-booked", label: "Reserved" },
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
  onUnassign,
  ineligibleSeats,
  undesirableSeats,
  allowSeatEdit = true,
  banner,
  allowOrientationToggle = false,
  orientation: orientationProp,
  onOrientationChange,
}: Props) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(100);
  const [internalOrientation, setInternalOrientation] = useState<"vertical" | "horizontal">("vertical");
  const orientation = orientationProp ?? internalOrientation;
  function toggleOrientation() {
    const next = orientation === "vertical" ? "horizontal" : "vertical";
    if (onOrientationChange) onOrientationChange(next);
    else setInternalOrientation(next);
  }
  const [legendOpen, setLegendOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<SeatCell | null>(null);
  const [infoSeat, setInfoSeat] = useState<{ seat: SeatCell; x: number; y: number } | null>(null);
  const [historySeat, setHistorySeat] = useState<string | null>(null);
  // Three layers on the seat map, per the reference spec: attribute icons, price, RFISC —
  // mutually exclusive, only one shown at a time (Icons by default).
  const [activeLayer, setActiveLayer] = useState<"icons" | "price" | "rfisc">("icons");

  const legendRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Center the map on whichever seat is "selected" (the active flow passenger's own seat, an
  // occupied seat picked for editing, ...) whenever that changes — e.g. switching between
  // passengers in the check-in flow's roster shouldn't require the agent to hunt for their seat.
  useEffect(() => {
    if (!selected) return;
    const cell = scrollRef.current?.querySelector<HTMLElement>(`[data-seat="${selected}"]`);
    cell?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [selected]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false);
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const LAYER_OPTIONS: { key: "icons" | "price" | "rfisc"; label: string }[] = [
    { key: "icons", label: "Icons" },
    { key: "price", label: "Price" },
    { key: "rfisc", label: "RFISC" },
  ];

  return (
    <div className="seatmap-panel">
      <div className="seatmap-toolbar">
        <div className="seatmap-decks">
          <button type="button" className="seatmap-deck selected">{t("Main Deck")}</button>
          <button type="button" className="seatmap-deck" disabled title={t("This aircraft has no upper deck")}>{t("Upper Deck")}</button>
        </div>
        {banner && <div className="seatmap-toolbar-banner">{banner}</div>}
        <div className="seatmap-toolbar-actions">
          <div className="seatmap-zoom">
            <button type="button" className="seatmap-zoom-btn" onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label={t("Zoom out")}>
              <MinusIcon size={14} />
            </button>
            <span className="seatmap-zoom-value">{zoom}%</span>
            <button type="button" className="seatmap-zoom-btn" onClick={() => setZoom((z) => Math.min(150, z + 10))} aria-label={t("Zoom in")}>
              <PlusIcon size={14} />
            </button>
          </div>
          {allowOrientationToggle && (
            <button
              type="button"
              className={`seatmap-tool-btn seatmap-orientation-btn ${orientation === "horizontal" ? "active" : ""}`}
              title={orientation === "vertical" ? t("Switch to horizontal layout") : t("Switch to vertical layout")}
              onClick={toggleOrientation}
            >
              <OrientationToggleIcon size={16} />
            </button>
          )}
          <div className="seatmap-popover-anchor" ref={legendRef}>
            <button type="button" className="seatmap-tool-btn" title={t("Legend")} onClick={() => setLegendOpen((o) => !o)}>
              <RowsIcon size={16} />
            </button>
            {legendOpen && (
              <div className="seatmap-legend">
                <div className="seatmap-legend-states">
                  {LEGEND_STATES.map((s) => (
                    <div key={s.label} className="seatmap-legend-row">
                      <span className={`seat seatmap-legend-swatch ${s.cls}`} />
                      {t(s.label)}
                    </div>
                  ))}
                  {LEGEND_HOLDS.map((s) => (
                    <div key={s.label} className="seatmap-legend-row">
                      <span className="seatmap-legend-swatch seat-free-swatch">
                        <span className={`seat-subtype-bar ${s.cls}`} />
                      </span>
                      {t(s.label)}
                    </div>
                  ))}
                </div>
                <div className="seatmap-legend-attrs">
                  <div className="seatmap-legend-row">
                    <span className="seatmap-legend-child-sample">
                      <SeatChildIcon size={8} />
                      <span className="seat-child-age">5</span>
                    </span>
                    {t("Child (2–12 y.o.)")}
                  </div>
                  {SEAT_ATTRS.map((a) => (
                    <div key={a.key} className="seatmap-legend-row">
                      <a.icon size={14} />
                      {t(a.label)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="seatmap-popover-anchor" ref={layersRef}>
            <button type="button" className="seatmap-tool-btn" title={t("Layers")} onClick={() => setLayersOpen((o) => !o)}>
              <LayersIcon size={16} />
            </button>
            {layersOpen && (
              <ul className="select-menu seatmap-layers-list">
                {LAYER_OPTIONS.map((l) => (
                  <li key={l.key} className="pax-columns-item" onClick={() => setActiveLayer(l.key)}>
                    <input type="radio" name="seatmap-layer" checked={activeLayer === l.key} readOnly />
                    {t(l.label)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {onHide && (
            <button type="button" className="seatmap-tool-btn" title={t("Hide seat map")} onClick={onHide}>
              <HideIcon size={16} className={orientation === "horizontal" ? "seatmap-hide-icon-down" : undefined} />
            </button>
          )}
        </div>
      </div>

      <div className="seatmap-scroll" ref={scrollRef}>
        <div className="seatmap-zoom-wrap" style={{ transform: `scale(${zoom / 100})` }}>
          <SeatMapGrid
            seats={seats}
            selected={selected}
            onSelect={onSelect}
            onEditSeat={allowSeatEdit ? setEditingSeat : undefined}
            onSeatContextMenu={allowSeatEdit ? undefined : (seat, x, y) => setInfoSeat({ seat, x, y })}
            showIcons={activeLayer === "icons"}
            showPrice={activeLayer === "price"}
            showRfisc={activeLayer === "rfisc"}
            cabinFeatures={cabinFeatures}
            onSelectOccupied={onSelectOccupied}
            onUnassign={onUnassign}
            ineligibleSeats={ineligibleSeats}
            undesirableSeats={undesirableSeats}
            orientation={orientation}
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

      {infoSeat && (
        <SeatInfoPopover
          seatCell={infoSeat.seat}
          x={infoSeat.x}
          y={infoSeat.y}
          onClose={() => setInfoSeat(null)}
          onOpenHistory={() => {
            setHistorySeat(infoSeat.seat.seat);
            setInfoSeat(null);
          }}
        />
      )}

      {historySeat && (
        <SeatHistoryModal flightId={flightId} seat={historySeat} onClose={() => setHistorySeat(null)} />
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
  const { t } = useLanguage();
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
      title={t("Seat {seat}").replace("{seat}", seat.seat)}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="tertiary" disabled={saving} onClick={save}>{t("Save")}</button>
        </>
      }
    >
      <div className="seat-editor">
        <label className="seat-editor-check">
          <input type="checkbox" checked={exitRow} onChange={(e) => setExitRow(e.target.checked)} />
          {t("Exit row")}
        </label>
        {SEAT_ATTRS.map((a) => (
          <label key={a.key} className="seat-editor-check">
            <input type="checkbox" checked={!!extra[a.key]} onChange={() => toggle(a.key)} />
            <a.icon size={14} />
            {t(a.label)}
          </label>
        ))}
        <label className="seat-editor-check">
          <input type="checkbox" checked={!!extra.preseated} onChange={() => toggle("preseated")} />
          {t("Pre-seated")}
        </label>
        <label className="seat-editor-check">
          <input type="checkbox" checked={!!extra.reserved} onChange={() => toggle("reserved")} />
          {t("Reserved")}
        </label>
        <div className="seat-editor-row">
          <Field label={t("Price")} style={{ width: 100 }}>
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
          <Field label="RFISC" style={{ width: 100 }}>
            <input
              value={extra.rfisc ?? ""}
              placeholder=" "
              maxLength={3}
              onChange={(e) => setExtra((ex) => ({ ...ex, rfisc: e.target.value.toUpperCase().slice(0, 3) || undefined }))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
