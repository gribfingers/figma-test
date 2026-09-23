import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { KioskFrame } from "../../components/kiosk/KioskFrame";
import { BaggageFlowIcon, DocScannedIcon, MinusIcon, PlaneIcon, PlusIcon, PrinterIcon, TagIcon, UserIcon } from "../../components/Icon";
import { CheckinResult, kioskApi, LookupResult, PartyMember } from "../../kioskApi";

type Step = "lookup" | "party" | "document" | "ticket" | "rules" | "success";

const PROHIBITED = [
  "Оружие, боеприпасы и их имитации",
  "Легковоспламеняющиеся и взрывчатые вещества",
  "Едкие и отравляющие химические вещества",
  "Сжатые и сжиженные газы (баллоны)",
  "Жидкости в ручной клади свыше 100 мл",
];

function yearsFromNow(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

function fullName(m: PartyMember) {
  return `${m.passenger.surname}/${m.passenger.given_name}`;
}

export function KioskCheckIn() {
  const [step, setStep] = useState<Step>("lookup");
  const [pnr, setPnr] = useState("");
  const [surname, setSurname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  // Who's selected to check in this visit — a family/group travels on one
  // PNR and checks in together, not one kiosk visit per person.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const [documentNumber, setDocumentNumber] = useState("");
  const [docExpiry, setDocExpiry] = useState(yearsFromNow(5));
  const [bagCount, setBagCount] = useState(1);
  const [results, setResults] = useState<CheckinResult[]>([]);

  async function submitLookup(e: FormEvent) {
    e.preventDefault();
    if (!pnr.trim() || !surname.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await kioskApi.lookupByPnr(pnr.trim(), surname.trim());
      setLookup(r);
      setSelected(new Set(r.members.filter((m) => m.passenger.checkin_status === "NOT_CHECKED_IN").map((m) => m.passenger.id)));
      setStep("party");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startProcessing() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setQueue(ids);
    setQueueIndex(0);
    setResults([]);
    setStep("rules");
  }

  function currentMember(): PartyMember | null {
    if (!lookup || queue.length === 0) return null;
    const id = queue[queueIndex];
    return lookup.members.find((m) => m.passenger.id === id) ?? null;
  }

  function beginCurrentPersonDocs() {
    setError(null);
    setBagCount(1);
    setStep("document");
  }

  function simulateScan() {
    // No real passport reader in this demo — fills plausible values the
    // way a real kiosk's MRZ scan would, so the flow can move on.
    setDocumentNumber(String(100000000 + Math.floor(Math.random() * 900000000)));
    setDocExpiry(yearsFromNow(5));
    setStep("ticket");
  }

  async function confirmCurrentPerson() {
    const member = currentMember();
    if (!member) return;
    setLoading(true);
    setError(null);
    try {
      const r = await kioskApi.checkin(member.passenger.id, {
        document_number: documentNumber || String(100000000 + Math.floor(Math.random() * 900000000)),
        doc_expiry: docExpiry,
        bag_count: bagCount,
      });
      setResults((prev) => [...prev, r]);
      if (queueIndex + 1 < queue.length) {
        setQueueIndex((i) => i + 1);
        setDocumentNumber("");
        setBagCount(1);
        setStep("document");
      } else {
        setStep("success");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function skipCurrentPerson() {
    setError(null);
    if (queueIndex + 1 < queue.length) {
      setQueueIndex((i) => i + 1);
      setDocumentNumber("");
      setBagCount(1);
      setStep("document");
    } else {
      setStep(results.length > 0 ? "success" : "party");
    }
  }

  if (step === "lookup") {
    return (
      <KioskFrame headerTitle="Самостоятельная регистрация" headerSub="Self-service check-in">
        <div className="kiosk-illustration">
          <PlaneIcon size={44} />
        </div>
        <p className="kiosk-instruction">Найдите вашу бронь</p>
        <p className="kiosk-sub">Введите код бронирования и фамилию любого пассажира из брони — если летите группой, зарегистрируем всех сразу</p>
        <form onSubmit={submitLookup}>
          <div className="kiosk-field-label">Код бронирования (PNR)</div>
          <input
            className="kiosk-field"
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            placeholder="Например, ABC123"
            autoFocus
            maxLength={10}
          />
          <div className="kiosk-field-label">Фамилия</div>
          <input
            className="kiosk-field"
            value={surname}
            onChange={(e) => setSurname(e.target.value.toUpperCase())}
            placeholder="IVANOV"
            maxLength={40}
          />
          {error && <div className="kiosk-error">{error}</div>}
          <button type="submit" className="kiosk-btn kiosk-btn-primary" disabled={loading || !pnr.trim() || !surname.trim()}>
            {loading && <span className="kiosk-spinner" />}
            {loading ? "Ищем…" : "Найти бронь"}
          </button>
        </form>
      </KioskFrame>
    );
  }

  if (step === "party" && lookup) {
    const notCheckedIn = lookup.members.filter((m) => m.passenger.checkin_status === "NOT_CHECKED_IN");
    const anyBagsToD = lookup.members.find((m) => m.bagTags.length > 0 && !m.bagDroppedAt);
    const isGroup = lookup.members.length > 1;

    if (notCheckedIn.length === 0) {
      // Whole party already checked in — nothing left to select, just show status + next step.
      return (
        <KioskFrame headerTitle={lookup.flight.flightNumber} headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`}>
          <p className="kiosk-instruction">{isGroup ? "Вся группа уже зарегистрирована" : "Вы уже зарегистрированы"}</p>
          <div className="kiosk-party-list">
            {lookup.members.map((m) => (
              <div key={m.passenger.id} className="kiosk-party-row done">
                <div className="kiosk-party-checkbox">✓</div>
                <div>
                  <div className="kiosk-party-name">{fullName(m)}</div>
                  <div className="kiosk-party-sub">Место {m.passenger.seat}</div>
                </div>
              </div>
            ))}
          </div>
          {anyBagsToD && (
            <Link to={`/kiosk/bag-drop?pnr=${anyBagsToD.passenger.record_locator}&surname=${anyBagsToD.passenger.surname}`} className="kiosk-btn kiosk-btn-primary">
              Сдать багаж
            </Link>
          )}
          <p className="kiosk-sub">Проходите на посадку по указателям к вашему выходу.</p>
        </KioskFrame>
      );
    }

    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`}>
        <div className="kiosk-illustration">
          <UserIcon size={44} />
        </div>
        <p className="kiosk-instruction">{isGroup ? "Кого регистрируем?" : "Подтвердите пассажира"}</p>
        {isGroup && <p className="kiosk-sub">На этой брони несколько пассажиров — выберите, кого зарегистрировать сейчас</p>}
        <div className="kiosk-party-list">
          {lookup.members.map((m) => {
            const done = m.passenger.checkin_status === "CHECKED_IN";
            const isSelected = selected.has(m.passenger.id);
            return (
              <div
                key={m.passenger.id}
                className={`kiosk-party-row${done ? " done" : isSelected ? " selected" : ""}`}
                onClick={() => !done && toggleSelected(m.passenger.id)}
                role="checkbox"
                aria-checked={done || isSelected}
                tabIndex={done ? -1 : 0}
              >
                <div className="kiosk-party-checkbox">{done || isSelected ? "✓" : ""}</div>
                <div>
                  <div className="kiosk-party-name">{fullName(m)}</div>
                  <div className="kiosk-party-sub">{done ? `Уже зарегистрирован(а) · место ${m.passenger.seat}` : "Не зарегистрирован(а)"}</div>
                </div>
              </div>
            );
          })}
        </div>
        {error && <div className="kiosk-error">{error}</div>}
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={startProcessing} disabled={selected.size === 0}>
          {selected.size > 1 ? `Продолжить (${selected.size} чел.)` : "Продолжить"}
        </button>
      </KioskFrame>
    );
  }

  if (step === "rules" && lookup) {
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber}>
        <p className="kiosk-instruction">Что запрещено к провозу</p>
        <ul className="kiosk-rules-list">
          {PROHIBITED.map((item) => (
            <li key={item}>
              <span style={{ color: "var(--kiosk-teal)", fontWeight: 700 }}>—</span> {item}
            </li>
          ))}
        </ul>
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={beginCurrentPersonDocs}>
          Ознакомлен(а), продолжить
        </button>
      </KioskFrame>
    );
  }

  const member = currentMember();

  if (step === "document" && member && lookup) {
    return (
      <KioskFrame
        headerTitle={lookup.flight.flightNumber}
        headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`}
        step={queueIndex + 1}
        totalSteps={queue.length}
      >
        <div className="kiosk-illustration">
          <DocScannedIcon size={72} />
        </div>
        {queue.length > 1 && <p className="kiosk-sub" style={{ marginTop: 0 }}>Пассажир {queueIndex + 1} из {queue.length}</p>}
        <p className="kiosk-instruction">Отсканируйте паспорт: {fullName(member)}</p>
        <p className="kiosk-sub">Приложите документ развёрнутой страницей вниз к сканеру</p>
        <div className="kiosk-spacer" />
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={simulateScan}>
          Симулировать скан документа
        </button>
        <button type="button" className="kiosk-btn kiosk-btn-ghost" onClick={simulateScan}>
          Ввести данные вручную
        </button>
      </KioskFrame>
    );
  }

  if (step === "ticket" && member && lookup) {
    const isLast = queueIndex + 1 >= queue.length;
    return (
      <KioskFrame
        headerTitle={lookup.flight.flightNumber}
        headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`}
        step={queueIndex + 1}
        totalSteps={queue.length}
      >
        <p className="kiosk-instruction">Данные билета</p>
        <div className="kiosk-ticket">
          <div className="kiosk-ticket-route">
            {lookup.flight.origin} → {lookup.flight.destination}
          </div>
          <div className="kiosk-ticket-row">
            <span>{lookup.flight.flightNumber}</span>
            <span>{new Date(lookup.flight.std).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="kiosk-ticket-name">{fullName(member)}</div>
        </div>
        <div className="kiosk-field-label" style={{ textAlign: "center" }}>
          <BaggageFlowIcon size={16} className="mono" /> Количество мест багажа
        </div>
        <div className="kiosk-bag-counter">
          <button type="button" onClick={() => setBagCount((n) => Math.max(0, n - 1))} disabled={bagCount === 0} aria-label="Меньше">
            <MinusIcon size={20} />
          </button>
          <div className="kiosk-bag-counter-value">{bagCount}</div>
          <button type="button" onClick={() => setBagCount((n) => Math.min(9, n + 1))} disabled={bagCount === 9} aria-label="Больше">
            <PlusIcon size={20} />
          </button>
        </div>
        {error && <div className="kiosk-error">{error}</div>}
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={confirmCurrentPerson} disabled={loading}>
          {loading && <span className="kiosk-spinner" />}
          {loading ? "Регистрируем…" : isLast ? "Завершить регистрацию" : "Далее"}
        </button>
        {error && (
          <button type="button" className="kiosk-btn kiosk-btn-ghost" onClick={skipCurrentPerson}>
            Пропустить этого пассажира
          </button>
        )}
      </KioskFrame>
    );
  }

  if (step === "success" && results.length > 0 && lookup) {
    const allTags = results.flatMap((r) => r.bagTags);
    const hasBags = allTags.length > 0;
    const isGroup = results.length > 1;
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber}>
        <div className="kiosk-success-icon">
          <PlaneIcon size={40} />
        </div>
        <p className="kiosk-success-title">{isGroup ? `Регистрация завершена! (${results.length} чел.)` : "Регистрация завершена!"}</p>
        <div className="kiosk-ticket">
          <div className="kiosk-ticket-route">
            {results[0].flight.origin} → {results[0].flight.destination}
          </div>
          {results.map((r) => (
            <div className="kiosk-ticket-row" key={r.passenger.id}>
              <span>{r.passenger.surname}/{r.passenger.given_name}</span>
              <span>Место {r.passenger.seat} · № {String(r.passenger.checkin_sequence).padStart(4, "0")}</span>
            </div>
          ))}
        </div>

        <div className="kiosk-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PrinterIcon size={16} /> Печать посадочны{isGroup ? "х талонов" : "й талон"}…
        </div>

        {hasBags && (
          <>
            <div className="kiosk-field-label" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <TagIcon size={16} /> Бирки на багаж ({allTags.length})
            </div>
            {allTags.map((tag) => (
              <div key={tag} className="kiosk-tag-strip">
                {tag}
              </div>
            ))}
            <p className="kiosk-sub" style={{ marginTop: 0 }}>Оторвите и приклейте бирку за ручку каждого места багажа</p>
            <Link to={`/kiosk/bag-drop?pnr=${results[0].passenger.record_locator}&surname=${results[0].passenger.surname}`} className="kiosk-btn kiosk-btn-primary">
              Далее — сдать багаж
            </Link>
          </>
        )}
        {!hasBags && (
          <>
            <p className="kiosk-sub">Багажа нет — проходите к выходу на посадку по указателям.</p>
            <Link to="/kiosk" className="kiosk-btn kiosk-btn-secondary">
              Зарегистрировать ещё одну бронь
            </Link>
          </>
        )}
      </KioskFrame>
    );
  }

  return null;
}
