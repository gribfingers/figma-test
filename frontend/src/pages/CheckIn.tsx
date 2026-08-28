import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { api, Flight, Passenger, SeatCell } from "../api";
import { SeatMapGrid } from "../components/SeatMapGrid";
import { BoardingPassCard } from "../components/BoardingPassCard";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { ArrowBackIcon, SearchIcon } from "../components/Icon";
import { SortTh, useSort } from "../components/SortTh";
import { DOCUMENT_TYPES, SSR_OPTIONS } from "../paxExtra";
import { useRegisterTab } from "../tabs";
import { useToast } from "../toast";
import { EntityNotFound } from "../components/EntityNotFound";

type ResultSortKey = "pnr" | "passenger" | "status" | "seat";
const RESULT_SORT_GETTERS: Record<ResultSortKey, (p: Passenger) => string | number> = {
  pnr: (p) => p.record_locator,
  passenger: (p) => `${p.surname}/${p.given_name}`,
  status: (p) => p.checkin_status,
  seat: (p) => p.seat ?? "",
};

export function CheckIn() {
  const { flightId } = useParams();
  const location = useLocation();
  const fid = Number(flightId);
  const [flight, setFlight] = useState<Flight | null>(null);
  useRegisterTab(flight ? `Check-in ${flight.carrier_code}${flight.flight_number}` : "Check-in");
  // Arriving from the Search screen's "found this passenger" flow (they
  // already typed a surname/PNR/etc. there) — start this screen's own PNR
  // lookup pre-filled with it instead of making them retype it.
  const [query, setQuery] = useState(() => (location.state as { presetQuery?: string } | null)?.presetQuery ?? "");
  const [results, setResults] = useState<Passenger[]>([]);
  const [selected, setSelected] = useState<Passenger | null>(null);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [seat, setSeat] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<Passenger | null>(null);
  const { showToast } = useToast();

  const [doc, setDoc] = useState({ document_type: "P", document_number: "", nationality: "", dob: "", doc_expiry: "" });
  const [bags, setBags] = useState({ bag_count: 0, bag_weight_kg: 0 });
  const [ssr, setSsr] = useState<string[]>([]);

  function refreshSeats() {
    api.seatmap(fid).then(setSeats);
  }

  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    api
      .getFlight(fid)
      .then(setFlight)
      .catch(() => setNotFound(true));
    refreshSeats();
  }, [fid]);

  useEffect(() => {
    api.passengers(fid, query).then(setResults);
  }, [fid, query, issued]);

  function selectPassenger(p: Passenger) {
    setSelected(p);
    setIssued(null);
    setError("");
    setSeat(p.seat);
    setSsr(p.ssr ?? []);
    setDoc({
      document_type: p.document_type ?? "P",
      document_number: p.document_number ?? "",
      nationality: p.nationality ?? "",
      dob: p.dob ?? "",
      doc_expiry: p.doc_expiry ?? "",
    });
    setBags({ bag_count: p.bag_count ?? 0, bag_weight_kg: p.bag_weight_kg ?? 0 });
  }

  async function submitCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !seat) return setError("Select a seat");
    setError("");
    try {
      const { passenger } = await api.checkin(selected.id, { ...doc, ...bags, ssr, seat });
      setIssued(passenger);
      setSelected(passenger);
      refreshSeats();
      showToast("Passenger checked in");
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleSsr(code: string) {
    setSsr((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  const { sorted: sortedResults, sortKey, sortDir, onSort } = useSort(results, RESULT_SORT_GETTERS);

  if (notFound) return <EntityNotFound label="This flight" />;
  if (!flight) return <div className="content">Loading…</div>;

  const alreadyCheckedIn = selected?.checkin_status === "CHECKED_IN";

  return (
    <div>
      <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <ArrowBackIcon size={16} /> Flight board
      </Link>
      <p className="subtitle">
        Flight <span className="mono">{flight.carrier_code}{flight.flight_number}</span>{" "}
        {flight.origin} → {flight.destination} ·{" "}
        {new Date(flight.std).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {flight.aircraft_type} ·{" "}
        <span className={`chip middle ${flight.status === "CLOSED" ? "danger" : "ok"}`}>{flight.status}</span>
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="grid-2">
        <div>
          <div className="panel panel--flush">
            <div className="panel-head">
              <h3>PNR lookup</h3>
              <div className="toolbar">
                <div className="input-box" style={{ flex: 1 }}>
                  <SearchIcon size={16} />
                  <input
                    placeholder="Surname or record locator (PNR)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                <SortTh id="pnr" label="PNR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="passenger" label="Pax" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="seat" label="Seat" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
              </thead>
              <tbody>
                {sortedResults.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => selectPassenger(p)}>
                    <td className="mono">{p.record_locator}</td>
                    <td>{p.surname}/{p.given_name}</td>
                    <td>
                      <span className={`chip middle ${p.checkin_status === "CHECKED_IN" ? "ok" : "muted"}`}>
                        {p.checkin_status === "CHECKED_IN" ? "Checked in" : "Not checked in"}
                      </span>
                    </td>
                    <td className="mono">{p.seat}</td>
                  </tr>
                ))}
                {results.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No results</td></tr>}
              </tbody>
            </table>
            </div>
          </div>

          {selected && (
            <div className="panel">
              <h3>Pax details {selected.surname}/{selected.given_name} · PNR {selected.record_locator}</h3>
              <form onSubmit={submitCheckin}>
                <div className="grid-2">
                  <Select
                    label="Document type"
                    value={doc.document_type}
                    disabled={alreadyCheckedIn}
                    onChange={(v) => setDoc({ ...doc, document_type: v })}
                    options={DOCUMENT_TYPES}
                  />
                  <Field label="Document number">
                    <input value={doc.document_number} disabled={alreadyCheckedIn} required placeholder=" "
                      onChange={(e) => setDoc({ ...doc, document_number: e.target.value })} />
                  </Field>
                  <Field label="Nationality (country code)">
                    <input value={doc.nationality} disabled={alreadyCheckedIn} maxLength={2} placeholder=" "
                      onChange={(e) => setDoc({ ...doc, nationality: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Date of birth">
                    <input type="date" value={doc.dob ?? ""} disabled={alreadyCheckedIn} placeholder=" "
                      onChange={(e) => setDoc({ ...doc, dob: e.target.value })} />
                  </Field>
                  <Field label="Document expiry">
                    <input type="date" value={doc.doc_expiry} disabled={alreadyCheckedIn} required placeholder=" "
                      onChange={(e) => setDoc({ ...doc, doc_expiry: e.target.value })} />
                  </Field>
                  <Field label="Bags: count / weight (kg)">
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="number" min={0} value={bags.bag_count} disabled={alreadyCheckedIn} placeholder=" "
                        onChange={(e) => setBags({ ...bags, bag_count: Number(e.target.value) })} />
                      <input type="number" min={0} step={0.5} value={bags.bag_weight_kg} disabled={alreadyCheckedIn} placeholder=" "
                        onChange={(e) => setBags({ ...bags, bag_weight_kg: Number(e.target.value) })} />
                    </div>
                  </Field>
                </div>

                <div className="field" style={{ marginTop: 4 }}>
                  <label>SSR (special service requests)</label>
                  <div className="ssr-tags">
                    {SSR_OPTIONS.map((code) => (
                      <label key={code} className="checkbox-row" style={{ marginBottom: 0 }}>
                        <input
                          type="checkbox"
                          disabled={alreadyCheckedIn}
                          checked={ssr.includes(code)}
                          onChange={() => toggleSsr(code)}
                        />
                        <span className="mono">{code}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label>Seat {seat && <span className="mono">— selected {seat}</span>}</label>
                  <SeatMapGrid seats={seats} selected={seat} onSelect={setSeat} />
                </div>

                {!alreadyCheckedIn && <button type="submit">Check in and issue boarding pass</button>}
                {alreadyCheckedIn && seat !== selected.seat && (
                  <button type="button" onClick={async () => {
                    const updated = await api.changeSeat(selected.id, seat!);
                    setSelected(updated);
                    refreshSeats();
                  }}>Change seat to {seat}</button>
                )}
              </form>
            </div>
          )}
        </div>

        <div>
          {selected?.bcbp && (
            <BoardingPassCard
              passenger={issued ?? selected}
              flightLabel={`${flight.carrier_code}${flight.flight_number}`}
              route={`${flight.origin} → ${flight.destination}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
