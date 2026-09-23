import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KioskFrame } from "../../components/kiosk/KioskFrame";
import { TagIcon } from "../../components/Icon";
import { BagDropResult, kioskApi, LookupResult, PartyMember } from "../../kioskApi";

type Step = "lookup" | "confirm" | "weighing" | "success" | "none";

function fullName(m: PartyMember) {
  return `${m.passenger.surname}/${m.passenger.given_name}`;
}

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
      if (r.members.every((m) => m.bagDroppedAt)) {
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
      // Confirm every party member's bags in this one visit — one at a time, same booking-derived
      // desk number for all of them (see routes/kiosk.ts's bag-drop desk assignment).
      const pending = lookup.members.filter((m) => !m.bagDroppedAt);
      let last: BagDropResult | null = null;
      for (const m of pending) {
        last = await kioskApi.bagDrop(m.passenger.id);
      }
      if (last) setDrop(last);
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
        <div className="kiosk-illustration">
          <TagIcon size={44} />
        </div>
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
            {loading && <span className="kiosk-spinner" />}
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
            {loading && <span className="kiosk-spinner" />}
            {loading ? "Ищем…" : "Найти по брони"}
          </button>
        </form>
      </KioskFrame>
    );
  }

  if (step === "none" && lookup) {
    const isGroup = lookup.members.length > 1;
    return (
      <KioskFrame headerTitle="Сдача багажа">
        <p className="kiosk-instruction">Багаж уже сдан</p>
        <p className="kiosk-sub">
          {isGroup ? "Все пассажиры этой брони" : fullName(lookup.members[0])}, рейс {lookup.flight.flightNumber} — все места багажа уже приняты.
        </p>
        <Link to="/kiosk/bag-drop" className="kiosk-btn kiosk-btn-secondary">
          Начать заново
        </Link>
      </KioskFrame>
    );
  }

  if (step === "confirm" && lookup) {
    const isGroup = lookup.members.length > 1;
    const totalTags = lookup.members.reduce((n, m) => n + m.bagTags.length, 0);
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} headerSub={`${lookup.flight.origin} → ${lookup.flight.destination}`} step={1} totalSteps={2}>
        <p className="kiosk-instruction">Разместите багаж на ленте</p>
        {lookup.members.map((m) => (
          <div className="kiosk-ticket" key={m.passenger.id}>
            {isGroup && <div className="kiosk-ticket-name">{fullName(m)}</div>}
            <div className="kiosk-ticket-row">
              <span>Мест багажа</span>
              <span>{m.bagTags.length}</span>
            </div>
            {m.bagTags.map((t) => (
              <div key={t} className="kiosk-tag-strip" style={{ marginTop: 8 }}>
                <TagIcon size={14} /> {t}
              </div>
            ))}
          </div>
        ))}
        {isGroup && <p className="kiosk-sub" style={{ marginTop: 0 }}>Всего мест багажа: {totalTags}</p>}
        {error && <div className="kiosk-error">{error}</div>}
        <div className="kiosk-spacer" />
        <button type="button" className="kiosk-btn kiosk-btn-primary" onClick={confirmDrop} disabled={loading}>
          {loading && <span className="kiosk-spinner" />}
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
    const isGroup = lookup.members.length > 1;
    return (
      <KioskFrame headerTitle={lookup.flight.flightNumber} step={2} totalSteps={2}>
        <div className="kiosk-success-icon">✓</div>
        <p className="kiosk-success-title">{isGroup ? "Поздравляем! Весь багаж сдан!" : "Поздравляем! Ваш багаж сдан!"}</p>
        <div className="kiosk-desk-callout">
          <div className="kiosk-desk-callout-num">№ {drop.bagDropDesk}</div>
          <div className="kiosk-desk-callout-label">стойка отправки багажа</div>
        </div>
        <p className="kiosk-sub">Проходите на посадку по указателям к вашему выходу.</p>
        <Link to="/kiosk/bag-drop" className="kiosk-btn kiosk-btn-secondary">
          Сдать багаж другой брони
        </Link>
      </KioskFrame>
    );
  }

  return null;
}
