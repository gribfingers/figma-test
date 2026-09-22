import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KioskFrame } from "../../components/kiosk/KioskFrame";
import { TagIcon } from "../../components/Icon";
import { BagDropResult, kioskApi, LookupResult } from "../../kioskApi";

type Step = "lookup" | "confirm" | "weighing" | "success" | "none";

export function KioskBagDrop() {
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("lookup");
  const [tag, setTag] = useState("");
  const [pnr, setPnr] = useState(params.get("pnr") ?? "");
  const [surname, setSurname] = useState(params.get("surname") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [drop, setDrop] = useState<BagDropResult | null>(null);

  async function runLookup(finder: () => Promise<LookupResult>) {
    setLoading(true);
    setError(null);
    try {
      const r = await finder();
      if (r.bagDroppedAt) {
        setLookup(r);
        setStep("none");
        return;
      }
      setLookup(r);
      setStep("confirm");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // If we arrived with pnr+surname already in the URL (from check-in success), look up straight away.
  useEffect(() => {
    if (params.get("pnr") && params.get("surname")) {
      runLookup(() => kioskApi.bagDropLookupByPnr(params.get("pnr")!, params.get("surname")!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitTag(e: FormEvent) {
    e.preventDefault();
    if (!tag.trim()) return;
    runLookup(() => kioskApi.bagDropLookupByTag(tag.trim()));
  }

  function submitPnr(e: FormEvent) {
    e.preventDefault();
    if (!pnr.trim() || !surname.trim()) return;
    runLookup(() => kioskApi.bagDropLookupByPnr(pnr.trim(), surname.trim()));
  }

  async function confirmDrop() {
    if (!lookup) return;
    setLoading(true);
    setError(null);
    setStep("weighing");
    try {
      // Brief simulated weighing pause — a real belt scale takes a moment; this just makes the
      // step legible instead of the confirmation appearing instantly.
      await new Promise((r) => setTimeout(r, 1400));
      const r = await kioskApi.bagDrop(lookup.passenger.id);
      setDrop(r);
      setStep("success");
    } catch (e) {
      setError((e as Error).message);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  if (step === "lookup") {
    return (
      <KioskFrame headerTitle="Сдача багажа" headerSub="Self bag-drop">
        <p className="kiosk-instruction">Отсканируйте бирку багажа</p>
        <form onSubmit={submitTag}>
          <input
            className="kiosk-field"
            value={tag}
            onChange={(e) => setTag(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Номер бирки"
            autoFocus
            inputMode="numeric"
          />
          <button type="submit" className="kiosk-btn kiosk-btn-primary" disabled={loading || !tag.trim()}>
            {loading ? "Ищем…" : "Найти по бирке"}
          </button>
        </form>
        <p className="kiosk-sub">или, если бирки под рукой нет —</p>
        <form onSubmit={submitPnr}>
          <div className="kiosk-field-label">Код бронирования (PNR)</div>
          <input className="kiosk-field" value={pnr} onChange={(e) => setPnr(e.target.value.toUpperCase())} maxLength={10} />
          <div className="kiosk-field-label">Фамилия</div>
          <input className="kiosk-field" value={surname} onChange={(e) => setSurname(e.target.value.toUpperCase())} maxLength={40} />
          {error && <div className="kiosk-error">{error}</div>}
          <button type="submit" className="kiosk-btn kiosk-btn-secondary" disabled={loading || !pnr.trim() || !surname.trim()}>
            {loading ? "Ищем…" : "Найти по брони"}
          </button>
        </form>
      </KioskFrame>
    );
  }

  if (step === "none" && lookup) {
    return (
      <KioskFrame headerTitle="Сдача багажа">
        <p className="kiosk-instruction">Багаж уже сдан</p>
        <p className="kiosk-sub">
          {lookup.passenger.surname}/{lookup.passenger.given_name}, рейс {lookup.flight.flightNumber} — все места багажа уже приняты.
        </p>
        <Link to="/kiosk/bag-drop" className="kiosk-btn kiosk-btn-secondary">
          Начать заново
        </Link>
      </KioskFrame>
    );
  }

  if (step === "confirm" && lookup) {
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`} step={1} totalSteps={2}>
        <p className="kiosk-instruction">Разместите багаж на ленте</p>
        <div className="kiosk-ticket">
          <div className="kiosk-ticket-name">
            {lookup.passenger.surname}/{lookup.passenger.given_name}
          </div>
          <div className="kiosk-ticket-row">
            <span>Мест багажа</span>
            <span>{lookup.bagTags.length}</span>
          </div>
        </div>
        {lookup.bagTags.map((t) => (
          <div key={t} className="kiosk-tag-strip">
            <TagIcon size={14} /> {t}
          </div>
        ))}
        {error && <div className="kiosk-error">{error}</div>}
        <div className="kiosk-spacer" />
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={confirmDrop} disabled={loading}>
          Багаж размещён на весах
        </button>
      </KioskFrame>
    );
  }

  if (step === "weighing") {
    return (
      <KioskFrame headerTitle="Сдача багажа" step={2} totalSteps={2}>
        <p className="kiosk-instruction">Взвешивание и сверка данных…</p>
        <div className="kiosk-illustration">
          <TagIcon size={64} />
        </div>
        <p className="kiosk-sub">Не убирайте багаж с ленты</p>
      </KioskFrame>
    );
  }

  if (step === "success" && drop && lookup) {
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} step={2} totalSteps={2}>
        <div className="kiosk-success-icon">✓</div>
        <p className="kiosk-success-title">Поздравляем! Ваш багаж сдан!</p>
        <div className="kiosk-desk-callout">
          <div className="kiosk-desk-callout-num">№ {drop.bagDropDesk}</div>
          <div className="kiosk-desk-callout-label">стойка отправки багажа</div>
        </div>
        <p className="kiosk-sub">Проходите на посадку по указателям к вашему выходу.</p>
        <Link to="/kiosk/bag-drop" className="kiosk-btn kiosk-btn-secondary">
          Сдать багаж другого пассажира
        </Link>
      </KioskFrame>
    );
  }

  return null;
}
