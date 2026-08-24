import { useEffect, useMemo, useState } from "react";
import { api, Flight, Passenger } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { Modal } from "../components/Modal";
import { SearchIcon } from "../components/Icon";
import { SortTh, useSort } from "../components/SortTh";
import { PassengerExtra, SSR_OPTIONS, parsePassengerExtra } from "../paxExtra";
import { useRegisterTab } from "../tabs";

type PaxAdminSortKey = "surname" | "given_name" | "record_locator" | "gender" | "dob" | "infant" | "seat" | "ticket_number";
const PAX_ADMIN_SORT_GETTERS: Record<PaxAdminSortKey, (p: Passenger) => string | number> = {
  surname: (p) => p.surname,
  given_name: (p) => p.given_name,
  record_locator: (p) => p.record_locator,
  gender: (p) => p.gender ?? "",
  dob: (p) => p.dob ?? "",
  infant: (p) => (p.infant ? 1 : 0),
  seat: (p) => p.seat ?? "",
  ticket_number: (p) => p.ticket_number,
};

type PaxDraft = {
  surname: string;
  given_name: string;
  ticket_number: string;
  record_locator: string;
  gender: "" | "M" | "F";
  dob: string;
  infant: boolean;
  bag_count: number;
  bag_weight_kg: number;
  ssr: string[];
  wl: string;
  pl: string;
  type: string;
  iapp: boolean;
  inbound: string;
  inboundTime: string;
  outbound: string;
  outboundTime: string;
};

const EMPTY_DRAFT: PaxDraft = {
  surname: "",
  given_name: "",
  ticket_number: "",
  record_locator: "",
  gender: "",
  dob: "",
  infant: false,
  bag_count: 0,
  bag_weight_kg: 0,
  ssr: [],
  wl: "",
  pl: "",
  type: "",
  iapp: false,
  inbound: "",
  inboundTime: "",
  outbound: "",
  outboundTime: "",
};

function draftFrom(p: Passenger): PaxDraft {
  const extra = parsePassengerExtra(p);
  return {
    surname: p.surname,
    given_name: p.given_name,
    ticket_number: p.ticket_number,
    record_locator: p.record_locator,
    gender: p.gender ?? "",
    dob: p.dob ?? "",
    infant: !!p.infant,
    bag_count: p.bag_count ?? 0,
    bag_weight_kg: p.bag_weight_kg ?? 0,
    ssr: p.ssr ?? [],
    wl: extra.wl ?? "",
    pl: extra.pl ?? "",
    type: extra.type ?? "",
    iapp: extra.iapp ?? false,
    inbound: extra.inbound ?? "",
    inboundTime: extra.inboundTime ?? "",
    outbound: extra.outbound ?? "",
    outboundTime: extra.outboundTime ?? "",
  };
}

// Merges into the original passenger's extra blob (when editing) rather
// than replacing it outright, so fields this form doesn't cover — comments,
// FFP card — set from elsewhere (e.g. the flight card's TR/AUX/COM/FFP
// chips) survive an admin save.
function draftToPayload(d: PaxDraft, original?: Passenger): Partial<Passenger> & { extra: string } {
  const prevExtra = original ? parsePassengerExtra(original) : {};
  const extra: PassengerExtra = {
    ...prevExtra,
    wl: d.wl,
    pl: d.pl,
    type: d.type,
    iapp: d.iapp,
    inbound: d.inbound,
    inboundTime: d.inboundTime,
    outbound: d.outbound,
    outboundTime: d.outboundTime,
  };
  return {
    surname: d.surname,
    given_name: d.given_name,
    ticket_number: d.ticket_number,
    record_locator: d.record_locator || undefined,
    gender: d.gender || null,
    dob: d.dob || null,
    infant: d.infant,
    bag_count: d.bag_count,
    bag_weight_kg: d.bag_weight_kg,
    ssr: d.ssr,
    extra: JSON.stringify(extra),
  } as Partial<Passenger> & { extra: string };
}

function toggleSsr(draft: PaxDraft, code: string): PaxDraft {
  return { ...draft, ssr: draft.ssr.includes(code) ? draft.ssr.filter((c) => c !== code) : [...draft.ssr, code] };
}

interface PassengerFormProps {
  draft: PaxDraft;
  onChange: (draft: PaxDraft) => void;
}

/** Shared field set for both the Add and Edit passenger modals. */
function PassengerFormFields({ draft, onChange }: PassengerFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Surname" style={{ flex: 1 }}>
          <input value={draft.surname} onChange={(e) => onChange({ ...draft, surname: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Given name" style={{ flex: 1 }}>
          <input value={draft.given_name} onChange={(e) => onChange({ ...draft, given_name: e.target.value })} placeholder=" " />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Ticket number" style={{ flex: 1 }}>
          <input value={draft.ticket_number} onChange={(e) => onChange({ ...draft, ticket_number: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Record locator (PNR)" style={{ flex: 1 }}>
          <input value={draft.record_locator} onChange={(e) => onChange({ ...draft, record_locator: e.target.value.toUpperCase() })} placeholder=" " />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Select
          label="Gender"
          style={{ width: 120 }}
          value={draft.gender}
          onChange={(v) => onChange({ ...draft, gender: v as PaxDraft["gender"] })}
          options={[{ value: "", label: "—" }, { value: "M", label: "M" }, { value: "F", label: "F" }]}
        />
        <Field label="Date of birth" style={{ flex: 1 }}>
          <input type="date" value={draft.dob} onChange={(e) => onChange({ ...draft, dob: e.target.value })} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <input type="checkbox" checked={draft.infant} onChange={(e) => onChange({ ...draft, infant: e.target.checked })} />
          Infant
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Bag count" style={{ width: 100 }}>
          <input type="number" min={0} value={draft.bag_count} onChange={(e) => onChange({ ...draft, bag_count: Number(e.target.value) })} />
        </Field>
        <Field label="Bag weight (kg)" style={{ width: 120 }}>
          <input type="number" min={0} step={0.5} value={draft.bag_weight_kg} onChange={(e) => onChange({ ...draft, bag_weight_kg: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="field" style={{ marginTop: 0 }}>
        <label>SSR (remarks)</label>
        <div className="ssr-tags">
          {SSR_OPTIONS.map((code) => (
            <label key={code} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 0 }}>
              <input type="checkbox" checked={draft.ssr.includes(code)} onChange={() => onChange(toggleSsr(draft, code))} style={{ width: "auto" }} />
              <span className="mono">{code}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="WL" style={{ width: 90 }}>
          <input value={draft.wl} onChange={(e) => onChange({ ...draft, wl: e.target.value })} placeholder=" " />
        </Field>
        <Field label="PL" style={{ width: 90 }}>
          <input value={draft.pl} onChange={(e) => onChange({ ...draft, pl: e.target.value })} placeholder=" " />
        </Field>
        <Field label="Type" style={{ width: 100 }}>
          <input value={draft.type} onChange={(e) => onChange({ ...draft, type: e.target.value.toUpperCase() })} placeholder=" " maxLength={3} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <input type="checkbox" checked={draft.iapp} onChange={(e) => onChange({ ...draft, iapp: e.target.checked })} />
          iAPP
        </label>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Inbound flight" style={{ flex: 1 }}>
          <input value={draft.inbound} onChange={(e) => onChange({ ...draft, inbound: e.target.value.toUpperCase() })} placeholder=" " />
        </Field>
        <Field label="Inbound arrival" style={{ flex: 1 }}>
          <input type="datetime-local" value={draft.inboundTime} onChange={(e) => onChange({ ...draft, inboundTime: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Outbound flight" style={{ flex: 1 }}>
          <input value={draft.outbound} onChange={(e) => onChange({ ...draft, outbound: e.target.value.toUpperCase() })} placeholder=" " />
        </Field>
        <Field label="Outbound departure" style={{ flex: 1 }}>
          <input type="datetime-local" value={draft.outboundTime} onChange={(e) => onChange({ ...draft, outboundTime: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

/**
 * Standalone passenger-data admin: not nested inside the flight card, so it
 * has its own flight picker up front rather than relying on the flight
 * card's route param.
 */
export function PassengerAdmin() {
  useRegisterTab("Passengers admin", true);

  const [flights, setFlights] = useState<Flight[]>([]);
  const [flightId, setFlightId] = useState<number | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const [editing, setEditing] = useState<Passenger | null>(null);
  const [editDraft, setEditDraft] = useState<PaxDraft>(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<PaxDraft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.listFlights().then((fs) => {
      setFlights(fs);
      if (fs.length > 0) setFlightId((prev) => prev ?? fs[0].id);
    });
  }, []);

  function loadPassengers() {
    if (flightId == null) return;
    api.passengers(flightId, query).then(setPassengers).catch((e) => setError(e.message));
  }
  useEffect(loadPassengers, [flightId, query]);

  const { sorted: sortedPassengers, sortKey, sortDir, onSort } = useSort(passengers, PAX_ADMIN_SORT_GETTERS);

  const flightOptions = useMemo(
    () => flights.map((f) => ({ value: String(f.id), label: `${f.carrier_code}${f.flight_number} ${f.origin}→${f.destination}` })),
    [flights]
  );

  function startEdit(p: Passenger) {
    setEditing(p);
    setEditDraft(draftFrom(p));
  }
  async function saveEdit() {
    if (flightId == null || editing == null) return;
    setSavingEdit(true);
    setError("");
    try {
      await api.updatePassenger(flightId, editing.id, draftToPayload(editDraft, editing));
      setEditing(null);
      loadPassengers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function deletePassenger(p: Passenger) {
    if (flightId == null) return;
    if (!window.confirm(`Delete passenger ${p.surname} ${p.given_name}?`)) return;
    setError("");
    try {
      await api.deletePassenger(flightId, p.id);
      loadPassengers();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function openAdd() {
    setAddDraft(EMPTY_DRAFT);
    setAddOpen(true);
  }
  async function submitAdd() {
    if (flightId == null) return;
    if (!addDraft.surname.trim() || !addDraft.given_name.trim() || !addDraft.ticket_number.trim()) {
      setError("Surname, given name and ticket number are required.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      await api.addPassenger(flightId, draftToPayload(addDraft));
      setAddOpen(false);
      loadPassengers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <h1>Passenger administration</h1>
      <p className="subtitle">Edit, add, and delete passenger records for any flight.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="panel">
        <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <Select
            label="Flight"
            style={{ minWidth: 220 }}
            value={flightId != null ? String(flightId) : ""}
            onChange={(v) => setFlightId(Number(v))}
            options={flightOptions}
          />
          <div className="input-box" style={{ flex: 1, maxWidth: 280 }}>
            <SearchIcon size={16} />
            <input placeholder="Search passengers…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="spacer" />
          <span className="passengers-count">{passengers.length} passengers</span>
          <button type="button" className="secondary" onClick={openAdd} disabled={flightId == null}>
            Add passenger
          </button>
        </div>
      </div>

      <div className="panel panel--flush">
        <div className="table-scroll">
          <table className="passengers-table">
            <thead>
              <tr>
                <SortTh id="surname" label="Surname" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="given_name" label="Given name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="record_locator" label="Record locator" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="gender" label="Gender" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="dob" label="DOB" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="infant" label="Infant" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="seat" label="Seat" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh id="ticket_number" label="Ticket number" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Bag</th>
                <th>SSR</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedPassengers.map((p) => (
                <tr key={p.id}>
                  <td>{p.surname}</td>
                  <td>{p.given_name}</td>
                  <td className="mono">{p.record_locator}</td>
                  <td>{p.gender ?? "—"}</td>
                  <td className="mono">{p.dob ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{p.infant ? "✓" : ""}</td>
                  <td className="mono">{p.seat ?? "—"}</td>
                  <td className="mono">{p.ticket_number}</td>
                  <td className="mono">{p.bag_count > 0 ? `${p.bag_count}/${p.bag_weight_kg}` : "—"}</td>
                  <td className="mono">{(p.ssr ?? []).join(", ") || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="secondary small" onClick={() => startEdit(p)}>Edit</button>
                      <button type="button" className="danger small" onClick={() => deletePassenger(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {passengers.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ color: "var(--muted)" }}>No passengers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <Modal
          title="Add passenger"
          onClose={() => setAddOpen(false)}
          width={520}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setAddOpen(false)}>Close</button>
              <button type="button" className="tertiary" disabled={adding} onClick={submitAdd}>Add</button>
            </>
          }
        >
          <PassengerFormFields draft={addDraft} onChange={setAddDraft} />
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Edit passenger: ${editing.surname} ${editing.given_name}`}
          onClose={() => setEditing(null)}
          width={520}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setEditing(null)}>Close</button>
              <button type="button" className="tertiary" disabled={savingEdit} onClick={saveEdit}>Save</button>
            </>
          }
        >
          <PassengerFormFields draft={editDraft} onChange={setEditDraft} />
        </Modal>
      )}
    </div>
  );
}
