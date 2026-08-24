import { useEffect, useMemo, useState } from "react";
import { api, Flight, Passenger } from "../api";
import { Field } from "../components/Field";
import { Select } from "../components/Select";
import { Modal } from "../components/Modal";
import { SearchIcon } from "../components/Icon";
import { SortTh, useSort } from "../components/SortTh";
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
};

const EMPTY_DRAFT: PaxDraft = {
  surname: "",
  given_name: "",
  ticket_number: "",
  record_locator: "",
  gender: "",
  dob: "",
  infant: false,
};

function editDraftFrom(p: Passenger): PaxDraft {
  return {
    surname: p.surname,
    given_name: p.given_name,
    ticket_number: p.ticket_number,
    record_locator: p.record_locator,
    gender: p.gender ?? "",
    dob: p.dob ?? "",
    infant: !!p.infant,
  };
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

  const [editingId, setEditingId] = useState<number | null>(null);
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
    setEditingId(p.id);
    setEditDraft(editDraftFrom(p));
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit() {
    if (flightId == null || editingId == null) return;
    setSavingEdit(true);
    setError("");
    try {
      await api.updatePassenger(flightId, editingId, {
        surname: editDraft.surname,
        given_name: editDraft.given_name,
        record_locator: editDraft.record_locator,
        gender: editDraft.gender || null,
        dob: editDraft.dob || null,
        infant: editDraft.infant,
      });
      setEditingId(null);
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
      await api.addPassenger(flightId, {
        surname: addDraft.surname,
        given_name: addDraft.given_name,
        ticket_number: addDraft.ticket_number,
        record_locator: addDraft.record_locator || undefined,
        gender: addDraft.gender || null,
        dob: addDraft.dob || null,
        infant: addDraft.infant,
      });
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedPassengers.map((p) => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id}>
                    {isEditing ? (
                      <>
                        <td><input value={editDraft.surname} onChange={(e) => setEditDraft({ ...editDraft, surname: e.target.value })} style={{ width: "100%" }} /></td>
                        <td><input value={editDraft.given_name} onChange={(e) => setEditDraft({ ...editDraft, given_name: e.target.value })} style={{ width: "100%" }} /></td>
                        <td><input value={editDraft.record_locator} onChange={(e) => setEditDraft({ ...editDraft, record_locator: e.target.value })} style={{ width: "100%" }} /></td>
                        <td>
                          <select
                            value={editDraft.gender}
                            onChange={(e) => setEditDraft({ ...editDraft, gender: e.target.value as PaxDraft["gender"] })}
                          >
                            <option value="">—</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        </td>
                        <td><input type="date" value={editDraft.dob} onChange={(e) => setEditDraft({ ...editDraft, dob: e.target.value })} /></td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={editDraft.infant} onChange={(e) => setEditDraft({ ...editDraft, infant: e.target.checked })} />
                        </td>
                        <td className="mono">{p.seat ?? "—"}</td>
                        <td className="mono">{p.ticket_number}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="small" disabled={savingEdit} onClick={saveEdit}>Save</button>
                            <button type="button" className="secondary small" disabled={savingEdit} onClick={cancelEdit}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{p.surname}</td>
                        <td>{p.given_name}</td>
                        <td className="mono">{p.record_locator}</td>
                        <td>{p.gender ?? "—"}</td>
                        <td className="mono">{p.dob ?? "—"}</td>
                        <td style={{ textAlign: "center" }}>{p.infant ? "✓" : ""}</td>
                        <td className="mono">{p.seat ?? "—"}</td>
                        <td className="mono">{p.ticket_number}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="secondary small" onClick={() => startEdit(p)}>Edit</button>
                            <button type="button" className="danger small" onClick={() => deletePassenger(p)}>Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {passengers.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ color: "var(--muted)" }}>No passengers found.</td>
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
          width={480}
          footer={
            <>
              <button type="button" className="tertiary" onClick={() => setAddOpen(false)}>Close</button>
              <button type="button" className="tertiary" disabled={adding} onClick={submitAdd}>Add</button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Field label="Surname" style={{ flex: 1 }}>
                <input value={addDraft.surname} onChange={(e) => setAddDraft({ ...addDraft, surname: e.target.value })} placeholder=" " />
              </Field>
              <Field label="Given name" style={{ flex: 1 }}>
                <input value={addDraft.given_name} onChange={(e) => setAddDraft({ ...addDraft, given_name: e.target.value })} placeholder=" " />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Field label="Ticket number" style={{ flex: 1 }}>
                <input value={addDraft.ticket_number} onChange={(e) => setAddDraft({ ...addDraft, ticket_number: e.target.value })} placeholder=" " />
              </Field>
              <Field label="Record locator (optional)" style={{ flex: 1 }}>
                <input value={addDraft.record_locator} onChange={(e) => setAddDraft({ ...addDraft, record_locator: e.target.value.toUpperCase() })} placeholder=" " />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Select
                label="Gender"
                style={{ width: 120 }}
                value={addDraft.gender}
                onChange={(v) => setAddDraft({ ...addDraft, gender: v as PaxDraft["gender"] })}
                options={[{ value: "", label: "—" }, { value: "M", label: "M" }, { value: "F", label: "F" }]}
              />
              <Field label="Date of birth" style={{ flex: 1 }}>
                <input type="date" value={addDraft.dob} onChange={(e) => setAddDraft({ ...addDraft, dob: e.target.value })} />
              </Field>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <input type="checkbox" checked={addDraft.infant} onChange={(e) => setAddDraft({ ...addDraft, infant: e.target.checked })} />
                Infant
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
