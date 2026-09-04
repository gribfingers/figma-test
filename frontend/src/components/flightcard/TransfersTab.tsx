import { useState } from "react";
import { SortTh, useSort } from "../SortTh";
import { Modal } from "../Modal";
import { ArrowBackIcon } from "../Icon";
import { formatSeatDisplay } from "../../seatExtra";
import { useToast } from "../../toast";
import { useLanguage } from "../../i18n";
import { clickable } from "../../interactive";

interface TransferPax {
  id: string;
  name: string;
  seat: string;
  verified: boolean;
}
interface TransferPnrGroup {
  pnr: string;
  passengers: TransferPax[];
}
interface TransferRow {
  flight: string;
  route: string;
  time: string;
  bag: number;
  delay?: string;
  groups: TransferPnrGroup[];
}

function paxOf(row: TransferRow): TransferPax[] {
  return row.groups.flatMap((g) => g.passengers);
}

// Connecting-flight data isn't modelled in the backend yet — sample rows,
// same shape as the Figma reference, stand in until that exists. Cancelling
// check-in / reaccommodating a passenger below only removes them from this
// in-memory list, for the same reason: there's nothing real to persist to.
const INBOUND: TransferRow[] = [
  {
    flight: "SU2112", route: "MOW-CDG", time: "11:30", bag: 8,
    groups: [
      { pnr: "ABC111", passengers: [
        { id: "in1-1", name: "Petrov P.P.", seat: "12A", verified: true },
        { id: "in1-2", name: "Petrova P.P.", seat: "12B", verified: true },
      ] },
      { pnr: "ABC222", passengers: [
        { id: "in1-3", name: "Sidorov S.S.", seat: "14C", verified: false },
      ] },
    ],
  },
  {
    flight: "TG444", route: "BKK-CDG", time: "12:00", bag: 4, delay: "25 MIN",
    groups: [
      { pnr: "ABC123", passengers: [
        { id: "in2-1", name: "Ivanov A.A.", seat: "24A", verified: true },
        { id: "in2-2", name: "Ivanov A.A.", seat: "24A", verified: true },
      ] },
      { pnr: "ABC321", passengers: [
        { id: "in2-3", name: "Ivanov A.A.", seat: "24A", verified: true },
        { id: "in2-4", name: "Ivanov A.A.", seat: "24A", verified: false },
      ] },
    ],
  },
  {
    flight: "LH1234", route: "MOW-CDG", time: "12:30", bag: 2,
    groups: [
      { pnr: "DEF001", passengers: [
        { id: "in3-1", name: "Kuznetsov K.K.", seat: "9F", verified: true },
      ] },
    ],
  },
];
const OUTBOUND: TransferRow[] = [
  {
    flight: "AF1234", route: "CDG-TLS", time: "17:20", bag: 8,
    groups: [
      { pnr: "GHI555", passengers: [
        { id: "out1-1", name: "Morozov M.M.", seat: "3A", verified: true },
        { id: "out1-2", name: "Morozova M.M.", seat: "3B", verified: true },
      ] },
      { pnr: "GHI556", passengers: [
        { id: "out1-3", name: "Volkov V.V.", seat: "18D", verified: true },
        { id: "out1-4", name: "Volkova V.V.", seat: "18E", verified: false },
      ] },
    ],
  },
  {
    flight: "DL212", route: "CDG-ATL", time: "18:00", bag: 4, delay: "25 MIN",
    groups: [
      { pnr: "JKL777", passengers: [
        { id: "out2-1", name: "Belov B.B.", seat: "22C", verified: true },
        { id: "out2-2", name: "Belova B.B.", seat: "22D", verified: true },
      ] },
    ],
  },
];

type TransferSortKey = "flight" | "route" | "time" | "pax" | "bag" | "delay";
const TRANSFER_SORT_GETTERS: Record<TransferSortKey, (r: TransferRow) => string | number> = {
  flight: (r) => r.flight,
  route: (r) => r.route,
  time: (r) => r.time,
  pax: (r) => paxOf(r).length,
  bag: (r) => r.bag,
  delay: (r) => r.delay ?? "",
};

function TransferTable({ title, rows, onSelectRow }: { title: string; rows: TransferRow[]; onSelectRow: (row: TransferRow) => void }) {
  const { t } = useLanguage();
  const { sorted, sortKey, sortDir, onSort } = useSort(rows, TRANSFER_SORT_GETTERS);
  return (
    <div>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <SortTh id="flight" label={t("Flight")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="route" label={t("Route")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="time" label={t("Time")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="pax" label={t("Pax")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="bag" label={t("Baggage")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortTh id="delay" label={t("Delay")} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.flight} className="clickable" onClick={() => onSelectRow(r)} {...clickable(() => onSelectRow(r))}>
              <td className="mono link-text">{r.flight}</td>
              <td className="mono">{r.route}</td>
              <td className="mono">{r.time}</td>
              <td>{paxOf(r).length}</td>
              <td>{r.bag}</td>
              <td>{r.delay && <span className="chip middle danger">{r.delay}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CancelCheckinModal({
  names,
  onClose,
  onConfirm,
}: {
  names: string[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const [saveBaggageTag, setSaveBaggageTag] = useState(true);
  return (
    <Modal
      title={t("Cancel Check-in")}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="tertiary" onClick={onConfirm}>{t("Cancel check-in")}</button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>{t("Are you sure you want to cancel check-in for {names}?").replace("{names}", names.join(", "))}</p>
      <label className="checkbox-row">
        <input type="checkbox" checked={saveBaggageTag} onChange={(e) => setSaveBaggageTag(e.target.checked)} />
        {t("Save baggage tag")}
      </label>
    </Modal>
  );
}

function ReaccommodateModal({
  names,
  options,
  onClose,
  onConfirm,
}: {
  names: string[];
  options: TransferRow[];
  onClose: () => void;
  onConfirm: (flight: string) => void;
}) {
  const { t } = useLanguage();
  const [chosen, setChosen] = useState(options[0]?.flight ?? "");
  return (
    <Modal
      title={t("Reaccommodation")}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="tertiary" onClick={onClose}>{t("Close")}</button>
          <button type="button" className="tertiary" disabled={!chosen} onClick={() => onConfirm(chosen)}>{t("Reaccommodate")}</button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>{t("Select the appropriate flight for {names}").replace("{names}", names.join(", "))}</p>
      <div className="transfer-flight-options">
        {options.map((o) => (
          <label key={o.flight} className={`transfer-flight-option ${chosen === o.flight ? "selected" : ""}`}>
            <input type="radio" name="reaccommodate-flight" checked={chosen === o.flight} onChange={() => setChosen(o.flight)} />
            <span className="mono link-text">{o.flight}</span>
            <span className="mono">{o.route}</span>
            <span className="mono">{o.time}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function TransferDetail({
  title,
  row,
  otherRows,
  onBack,
  onRemovePax,
}: {
  title: string;
  row: TransferRow;
  otherRows: TransferRow[];
  onBack: () => void;
  onRemovePax: (ids: Set<string>) => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"cancel" | "reaccommodate" | null>(null);
  const { showToast } = useToast();
  const allPax = paxOf(row);
  const allSelected = allPax.length > 0 && allPax.every((p) => selected.has(p.id));
  const selectedNames = allPax.filter((p) => selected.has(p.id)).map((p) => p.name);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allPax.map((p) => p.id)));
  }
  function toggleGroup(group: TransferPnrGroup) {
    const groupIds = group.passengers.map((p) => p.id);
    const allIn = groupIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      groupIds.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
  }
  function togglePax(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function confirmCancel() {
    const count = selected.size;
    onRemovePax(selected);
    setSelected(new Set());
    setModal(null);
    showToast(
      count === 1
        ? t("Check-in cancelled for {n} passenger").replace("{n}", String(count))
        : t("Check-in cancelled for {n} passengers").replace("{n}", String(count))
    );
  }
  function confirmReaccommodate(targetFlight: string) {
    const count = selected.size;
    onRemovePax(selected);
    setSelected(new Set());
    setModal(null);
    showToast(
      (count === 1
        ? t("{n} passenger reaccommodated to {flight}")
        : t("{n} passengers reaccommodated to {flight}")
      ).replace("{n}", String(count)).replace("{flight}", targetFlight)
    );
  }

  return (
    <div>
      <div className="transfer-detail-head">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t("Back")}>
          <ArrowBackIcon size={18} />
        </button>
        <span className="transfer-detail-title">{title} {row.flight}</span>
        {row.delay && <span className="chip middle danger">{row.delay}</span>}
      </div>

      <div className="transfer-pax-list">
        <div className="transfer-pax-row">
          <label className="checkbox-row">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            {t("All passengers")}
          </label>
        </div>

        {row.groups.map((g) => {
          const groupIds = g.passengers.map((p) => p.id);
          const groupSelected = groupIds.every((id) => selected.has(id));
          return (
            <div key={g.pnr}>
              <div className="transfer-pax-row transfer-pnr-head">
                <label className="checkbox-row">
                  <input type="checkbox" checked={groupSelected} onChange={() => toggleGroup(g)} />
                  PNR {g.pnr}
                </label>
              </div>
              {g.passengers.map((p) => (
                <div key={p.id} className="transfer-pax-row transfer-pax-item">
                  <label className="checkbox-row">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => togglePax(p.id)} />
                    {p.name}
                  </label>
                  <span className="mono chip middle muted seat-chip">{formatSeatDisplay(p.seat)}</span>
                  {p.verified && <span className="chip middle ok">{t("VERIFIED")}</span>}
                </div>
              ))}
            </div>
          );
        })}
        {allPax.length === 0 && <div className="transfer-pax-row transfer-pax-empty">{t("No passengers left on this connection.")}</div>}
      </div>

      <div className="transfer-detail-actions">
        <button type="button" className="secondary" disabled={selected.size === 0} onClick={() => setModal("cancel")}>
          {t("Cancel check-in")}
        </button>
        <button type="button" className="secondary" disabled={selected.size === 0} onClick={() => setModal("reaccommodate")}>
          {t("Reaccommodation")}
        </button>
      </div>

      {modal === "cancel" && (
        <CancelCheckinModal names={selectedNames} onClose={() => setModal(null)} onConfirm={confirmCancel} />
      )}
      {modal === "reaccommodate" && (
        <ReaccommodateModal names={selectedNames} options={otherRows} onClose={() => setModal(null)} onConfirm={confirmReaccommodate} />
      )}
    </div>
  );
}

export function TransfersTab() {
  const { t } = useLanguage();
  const [inbound, setInbound] = useState(INBOUND);
  const [outbound, setOutbound] = useState(OUTBOUND);
  const [activeInbound, setActiveInbound] = useState<string | null>(null);
  const [activeOutbound, setActiveOutbound] = useState<string | null>(null);

  function removeFromRow(rows: TransferRow[], setRows: (r: TransferRow[]) => void, flight: string, ids: Set<string>) {
    setRows(
      rows.map((r) =>
        r.flight !== flight
          ? r
          : { ...r, groups: r.groups.map((g) => ({ ...g, passengers: g.passengers.filter((p) => !ids.has(p.id)) })).filter((g) => g.passengers.length > 0) }
      )
    );
  }

  const inboundRow = inbound.find((r) => r.flight === activeInbound) ?? null;
  const outboundRow = outbound.find((r) => r.flight === activeOutbound) ?? null;

  return (
    <div className="grid-2">
      {inboundRow ? (
        <TransferDetail
          title={t("Inbound")}
          row={inboundRow}
          otherRows={inbound.filter((r) => r.flight !== inboundRow.flight)}
          onBack={() => setActiveInbound(null)}
          onRemovePax={(ids) => removeFromRow(inbound, setInbound, inboundRow.flight, ids)}
        />
      ) : (
        <TransferTable title={t("Inbound")} rows={inbound} onSelectRow={(r) => setActiveInbound(r.flight)} />
      )}
      {outboundRow ? (
        <TransferDetail
          title={t("Outbound")}
          row={outboundRow}
          otherRows={outbound.filter((r) => r.flight !== outboundRow.flight)}
          onBack={() => setActiveOutbound(null)}
          onRemovePax={(ids) => removeFromRow(outbound, setOutbound, outboundRow.flight, ids)}
        />
      ) : (
        <TransferTable title={t("Outbound")} rows={outbound} onSelectRow={(r) => setActiveOutbound(r.flight)} />
      )}
    </div>
  );
}
