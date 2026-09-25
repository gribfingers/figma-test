import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KioskFrame } from "../../components/kiosk/KioskFrame";
import { useKioskLanguage } from "../../kioskI18n";
import { BagDropResult, kioskApi, LookupResult, PartyMember } from "../../kioskApi";

type Step = "lookup" | "confirm" | "weighing" | "success" | "none";

function fullName(m: PartyMember) {
  return `${m.passenger.surname}/${m.passenger.given_name}`;
}

export function KioskBagDrop() {
  const { t } = useKioskLanguage();
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
      <KioskFrame>
        <h1 className="kiosk-title">{t("Сдача багажа")}</h1>
        <p className="kiosk-sub">{t("Отсканируйте бирку багажа")}</p>
        <form onSubmit={submitTag}>
          <input
            className="kiosk-field"
            value={tag}
            onChange={(e) => setTag(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={t("Номер бирки")}
            autoFocus
            inputMode="numeric"
          />
          <div className="kiosk-card-stack" style={{ paddingTop: 0, marginTop: 0 }}>
            <button type="submit" className="kiosk-card md primary" disabled={loading || !tag.trim()}>
              {loading && <span className="kiosk-spinner-dark" />}
              {loading ? t("Ищем…") : t("Найти по бирке")}
            </button>
          </div>
        </form>
        <p className="kiosk-sub" style={{ marginTop: 24 }}>
          {t("или, если бирки под рукой нет —")}
        </p>
        <form onSubmit={submitPnr}>
          <div className="kiosk-field-label">{t("Код бронирования (PNR)")}</div>
          <input className="kiosk-field" value={pnr} onChange={(e) => setPnr(e.target.value.toUpperCase())} maxLength={10} />
          <div className="kiosk-field-label">{t("Фамилия")}</div>
          <input className="kiosk-field" value={surname} onChange={(e) => setSurname(e.target.value.toUpperCase())} maxLength={40} />
          {error && <div className="kiosk-error">{error}</div>}
          <div className="kiosk-card-stack" style={{ paddingTop: 0, marginTop: 0 }}>
            <button type="submit" className="kiosk-card md" disabled={loading || !pnr.trim() || !surname.trim()}>
              {loading && <span className="kiosk-spinner-dark" />}
              {loading ? t("Ищем…") : t("Найти по брони")}
            </button>
          </div>
        </form>
      </KioskFrame>
    );
  }

  if (step === "none" && lookup) {
    const isGroup = lookup.members.length > 1;
    return (
      <KioskFrame>
        <h1 className="kiosk-title">{t("Багаж уже сдан")}</h1>
        <p className="kiosk-sub">
          {t("{who}, рейс {flight} — все места багажа уже приняты.", {
            who: isGroup ? t("Все пассажиры этой брони") : fullName(lookup.members[0]),
            flight: lookup.flight.flightNumber,
          })}
        </p>
        <div className="kiosk-card-stack">
          <Link to="/kiosk/bag-drop" className="kiosk-card md">
            {t("Начать заново")}
          </Link>
        </div>
      </KioskFrame>
    );
  }

  if (step === "confirm" && lookup) {
    const isGroup = lookup.members.length > 1;
    const totalTags = lookup.members.reduce((n, m) => n + m.bagTags.length, 0);
    return (
      <KioskFrame flightLabel={lookup.flight.flightNumber} stepBadge={t("Шаг {n} из 2", { n: 1 })}>
        <h1 className="kiosk-title">{t("Разместите багаж на ленте")}</h1>
        {lookup.members.map((m) => (
          <div className="kiosk-confirm-row" style={{ marginBottom: 12 }} key={m.passenger.id}>
            {isGroup && <div className="kiosk-confirm-name">{fullName(m)}</div>}
            <div className="kiosk-confirm-seat">{t("Мест багажа: {n}", { n: m.bagTags.length })}</div>
            {m.bagTags.map((tg) => (
              <div key={tg} className="kiosk-tag-card" style={{ fontSize: 16, marginTop: 8, marginBottom: 0 }}>
                {tg}
              </div>
            ))}
          </div>
        ))}
        {isGroup && <p className="kiosk-sub">{t("Всего мест багажа: {n}", { n: totalTags })}</p>}
        {error && <div className="kiosk-error">{error}</div>}
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card md primary" onClick={confirmDrop} disabled={loading}>
            {loading && <span className="kiosk-spinner-dark" />}
            {t("Багаж размещён на весах")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  if (step === "weighing") {
    return (
      <KioskFrame stepBadge={t("Шаг {n} из 2", { n: 2 })}>
        <h1 className="kiosk-title">{t("Взвешивание и сверка данных…")}</h1>
        <p className="kiosk-sub">{t("Не убирайте багаж с ленты")}</p>
      </KioskFrame>
    );
  }

  if (step === "success" && drop && lookup) {
    const isGroup = lookup.members.length > 1;
    return (
      <KioskFrame flightLabel={lookup.flight.flightNumber} stepBadge={t("Шаг {n} из 2", { n: 2 })}>
        <h1 className="kiosk-title success">{isGroup ? t("Поздравляем! Весь багаж сдан!") : t("Поздравляем! Ваш багаж сдан!")}</h1>
        <div className="kiosk-desk-callout">
          <div className="kiosk-desk-callout-num">{t("№ {n}", { n: drop.bagDropDesk })}</div>
          <div className="kiosk-desk-callout-label">{t("стойка отправки багажа")}</div>
        </div>
        <p className="kiosk-instruction">{t("Проходите на посадку по указателям к вашему выходу.")}</p>
        <div className="kiosk-card-stack">
          <Link to="/kiosk/bag-drop" className="kiosk-card md">
            {t("Сдать багаж другой брони")}
          </Link>
        </div>
      </KioskFrame>
    );
  }

  return null;
}
