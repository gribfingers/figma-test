import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { KioskFrame } from "../../components/kiosk/KioskFrame";
import { BaggageFlowIcon, DocScannedIcon, MinusIcon, PlaneIcon, PlusIcon, PrinterIcon, TagIcon } from "../../components/Icon";
import { CheckinResult, kioskApi, LookupResult } from "../../kioskApi";

type Step = "lookup" | "already" | "document" | "ticket" | "rules" | "success";

const PROHIBITED = [
  "Оружие, боеприпасы и их имитации",
  "Легковоспламеняющиеся и взрывчатые вещества",
  "Едкие и отравляющие химические вещества",
  "Сжатые и сжиженные газы (баллоны)",
  "Жидкости в ручной клади свыше 100 мл",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function yearsFromNow(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

export function KioskCheckIn() {
  const [step, setStep] = useState<Step>("lookup");
  const [pnr, setPnr] = useState("");
  const [surname, setSurname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [docExpiry, setDocExpiry] = useState(yearsFromNow(5));
  const [bagCount, setBagCount] = useState(1);
  const [result, setResult] = useState<CheckinResult | null>(null);

  async function submitLookup(e: FormEvent) {
    e.preventDefault();
    if (!pnr.trim() || !surname.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await kioskApi.lookupByPnr(pnr.trim(), surname.trim());
      setLookup(r);
      setStep(r.passenger.checkin_status === "CHECKED_IN" ? "already" : "document");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function simulateScan() {
    // No real passport reader in this demo — fills plausible values the
    // way a real kiosk's MRZ scan would, so the flow can move on.
    setDocumentNumber(String(100000000 + Math.floor(Math.random() * 900000000)));
    setDocExpiry(yearsFromNow(5));
    setStep("ticket");
  }

  async function confirmCheckin() {
    if (!lookup) return;
    setLoading(true);
    setError(null);
    try {
      const r = await kioskApi.checkin(lookup.passenger.id, {
        document_number: documentNumber || String(100000000 + Math.floor(Math.random() * 900000000)),
        doc_expiry: docExpiry,
        bag_count: bagCount,
      });
      setResult(r);
      setStep("success");
    } catch (e) {
      setError((e as Error).message);
      setStep("ticket");
    } finally {
      setLoading(false);
    }
  }

  if (step === "lookup") {
    return (
      <KioskFrame headerTitle="Самостоятельная регистрация" headerSub="Self-service check-in">
        <p className="kiosk-instruction">Найдите вашу бронь</p>
        <p className="kiosk-sub">Введите код бронирования и фамилию, как в билете</p>
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
            {loading ? "Ищем…" : "Найти бронь"}
          </button>
        </form>
      </KioskFrame>
    );
  }

  if (step === "already" && lookup) {
    const hasBags = lookup.passenger.bag_count > 0;
    return (
      <KioskFrame headerTitle="Самостоятельная регистрация">
        <p className="kiosk-instruction">Вы уже зарегистрированы</p>
        <div className="kiosk-ticket">
          <div className="kiosk-ticket-route">
            {lookup.flight.origin} → {lookup.flight.destination}
          </div>
          <div className="kiosk-ticket-row">
            <span>{lookup.flight.flightNumber}</span>
            <span>Место {lookup.passenger.seat}</span>
          </div>
          <div className="kiosk-ticket-name">
            {lookup.passenger.surname}/{lookup.passenger.given_name}
          </div>
        </div>
        {hasBags && !lookup.bagDroppedAt && (
          <Link to={`/kiosk/bag-drop?pnr=${lookup.passenger.record_locator}&surname=${lookup.passenger.surname}`} className="kiosk-btn kiosk-btn-primary">
            Сдать багаж
          </Link>
        )}
        <div className="kiosk-sub" style={{ marginTop: hasBags ? 8 : 0 }}>
          {hasBags && lookup.bagDroppedAt ? "Багаж уже сдан. " : ""}Проходите на регистрацию для посадки к вашему выходу.
        </div>
      </KioskFrame>
    );
  }

  if (step === "document" && lookup) {
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`} step={1} totalSteps={4}>
        <div className="kiosk-illustration">
          <DocScannedIcon size={72} />
        </div>
        <p className="kiosk-instruction">Отсканируйте первую страницу паспорта</p>
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

  if (step === "ticket" && lookup) {
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`} step={2} totalSteps={4}>
        <p className="kiosk-instruction">Данные вашего билета</p>
        <div className="kiosk-ticket">
          <div className="kiosk-ticket-route">
            {lookup.flight.origin} → {lookup.flight.destination}
          </div>
          <div className="kiosk-ticket-row">
            <span>{lookup.flight.flightNumber}</span>
            <span>{new Date(lookup.flight.std).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="kiosk-ticket-name">
            {lookup.passenger.surname}/{lookup.passenger.given_name}
          </div>
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
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={() => setStep("rules")}>
          Продолжить
        </button>
      </KioskFrame>
    );
  }

  if (step === "rules" && lookup) {
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} step={3} totalSteps={4}>
        <p className="kiosk-instruction">Что запрещено к провозу</p>
        <ul className="kiosk-rules-list">
          {PROHIBITED.map((item) => (
            <li key={item}>
              <span style={{ color: "var(--kiosk-teal)", fontWeight: 700 }}>—</span> {item}
            </li>
          ))}
        </ul>
        {error && <div className="kiosk-error">{error}</div>}
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={confirmCheckin} disabled={loading}>
          {loading ? "Регистрируем…" : "Ознакомлен(а), продолжить"}
        </button>
      </KioskFrame>
    );
  }

  if (step === "success" && result) {
    const hasBags = result.bagTags.length > 0;
    return (
      <KioskFrame headerTitle={result.flight.flightNumber} step={4} totalSteps={4}>
        <div className="kiosk-success-icon">
          <PlaneIcon size={40} />
        </div>
        <p className="kiosk-success-title">Регистрация завершена!</p>
        <div className="kiosk-ticket">
          <div className="kiosk-ticket-route">
            {result.flight.origin} → {result.flight.destination}
          </div>
          <div className="kiosk-ticket-row">
            <span>{result.passenger.surname}/{result.passenger.given_name}</span>
            <span>Место {result.passenger.seat}</span>
          </div>
          <div className="kiosk-ticket-row">
            <span>Посадочный талон</span>
            <span>№ {String(result.passenger.checkin_sequence).padStart(4, "0")}</span>
          </div>
        </div>

        <div className="kiosk-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PrinterIcon size={16} /> Печать посадочного талона…
        </div>

        {hasBags && (
          <>
            <div className="kiosk-field-label" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <TagIcon size={16} /> Бирки на багаж ({result.bagTags.length})
            </div>
            {result.bagTags.map((tag) => (
              <div key={tag} className="kiosk-tag-strip">
                {tag}
              </div>
            ))}
            <p className="kiosk-sub" style={{ marginTop: 0 }}>Оторвите и приклейте бирку за ручку каждого места багажа</p>
            <Link to={`/kiosk/bag-drop?pnr=${result.passenger.record_locator}&surname=${result.passenger.surname}`} className="kiosk-btn kiosk-btn-primary">
              Далее — сдать багаж
            </Link>
          </>
        )}
        {!hasBags && (
          <>
            <p className="kiosk-sub">Багажа нет — проходите к выходу на посадку по указателям.</p>
            <Link to="/kiosk" className="kiosk-btn kiosk-btn-secondary">
              Зарегистрировать ещё одного пассажира
            </Link>
          </>
        )}
      </KioskFrame>
    );
  }

  return null;
}
