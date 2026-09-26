import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KioskFrame } from "../../components/kiosk/KioskFrame";
import { KioskLangSwitcher } from "../../components/kiosk/KioskLangSwitcher";
import { FlameIcon, GasCylinderIcon, LiquidIcon, ToxicIcon, WeaponIcon } from "../../components/kiosk/KioskRuleIcons";
import { SeatMapGrid } from "../../components/SeatMapGrid";
import { useKioskLanguage } from "../../kioskI18n";
import { CheckinResult, kioskApi, LookupResult, PartyMember, SeatCell } from "../../kioskApi";

type Step = "welcome" | "rules" | "lookup" | "found" | "seats" | "confirm" | "baggage" | "success";

const PROHIBITED: { icon: typeof WeaponIcon; label: string }[] = [
  { icon: WeaponIcon, label: "Оружие, боеприпасы и их имитации" },
  { icon: FlameIcon, label: "Легковоспламеняющиеся и взрывчатые вещества" },
  { icon: ToxicIcon, label: "Едкие и отравляющие химические вещества" },
  { icon: GasCylinderIcon, label: "Сжатые и сжиженные газы (баллоны)" },
  { icon: LiquidIcon, label: "Жидкости в ручной клади свыше 100 мл" },
];

function yearsFromNow(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}
function fullName(p: { surname: string; given_name: string }) {
  return `${p.surname}/${p.given_name}`;
}
/** Seats are stored/keyed as zero-padded "004C" so they sort and match correctly — strip the
 * padding for anything shown to a passenger (e.g. "4C"). */
function formatSeat(seat: string): string {
  return seat.replace(/^0+(?=\d)/, "");
}
function randomWeight(): number {
  return 5 + Math.round(Math.random() * 23);
}

export function KioskCheckIn() {
  const { t } = useKioskLanguage();
  const [step, setStep] = useState<Step>("welcome");
  const [pnr, setPnr] = useState("");
  const [surname, setSurname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [queue, setQueue] = useState<PartyMember[]>([]);

  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [seatPicks, setSeatPicks] = useState<Record<number, string>>({});
  const [activePaxId, setActivePaxId] = useState<number | null>(null);

  const [checkinResults, setCheckinResults] = useState<CheckinResult[]>([]);
  const [checkinWarnings, setCheckinWarnings] = useState<string[]>([]);
  const [bagIndex, setBagIndex] = useState(0);
  const [bagWeights, setBagWeights] = useState<number[]>([]);
  const [allBagTags, setAllBagTags] = useState<string[]>([]);

  function resetAll() {
    setStep("welcome");
    setPnr("");
    setSurname("");
    setError(null);
    setLookup(null);
    setQueue([]);
    setSeats([]);
    setSeatPicks({});
    setActivePaxId(null);
    setCheckinResults([]);
    setCheckinWarnings([]);
    setBagIndex(0);
    setBagWeights([]);
    setAllBagTags([]);
  }

  async function submitLookup(e: FormEvent) {
    e.preventDefault();
    if (!pnr.trim() || !surname.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await kioskApi.lookupByPnr(pnr.trim(), surname.trim());
      setLookup(r);
      setQueue(r.members.filter((m) => m.passenger.checkin_status === "NOT_CHECKED_IN"));
      setStep("found");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function proceedToSeats() {
    if (queue.length === 0 || !lookup) return;
    setLoading(true);
    setError(null);
    try {
      const flightId = queue[0].passenger.flight_id;
      const seatRows = await kioskApi.seatmap(flightId);
      setSeats(seatRows);
      setSeatPicks({});
      setActivePaxId(queue[0].passenger.id);
      setStep("seats");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function pickSeat(seat: string) {
    if (!activePaxId) return;
    setSeatPicks((prev) => {
      const next = { ...prev, [activePaxId]: seat };
      // Auto-advance to the next passenger in the queue who still needs a seat.
      const remaining = queue.find((m) => m.passenger.id !== activePaxId && !next[m.passenger.id]);
      if (remaining) setActivePaxId(remaining.passenger.id);
      return next;
    });
  }

  async function confirmCheckinAll() {
    setLoading(true);
    setError(null);
    const results: CheckinResult[] = [];
    const warnings: string[] = [];
    for (const member of queue) {
      const seat = seatPicks[member.passenger.id];
      try {
        const r = await kioskApi.checkin(member.passenger.id, {
          document_number: String(100000000 + Math.floor(Math.random() * 900000000)),
          doc_expiry: yearsFromNow(5),
          bag_count: 0,
          seat,
        });
        results.push(r);
      } catch (e) {
        warnings.push(`${fullName(member.passenger)}: ${(e as Error).message}`);
      }
    }
    setCheckinResults(results);
    setCheckinWarnings(warnings);
    setLoading(false);
    setStep("confirm");
  }

  function goToBaggage() {
    setBagIndex(0);
    setBagWeights([]);
    setStep("baggage");
  }

  async function printBagsAndAdvance() {
    const current = checkinResults[bagIndex];
    if (!current) return;
    setLoading(true);
    setError(null);
    try {
      if (bagWeights.length > 0) {
        const r = await kioskApi.addBags(current.passenger.id, bagWeights.length);
        setAllBagTags((prev) => [...prev, ...r.bagTags]);
      }
      if (bagIndex + 1 < checkinResults.length) {
        setBagIndex((i) => i + 1);
        setBagWeights([]);
      } else {
        setStep("success");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ---- Screen 1: Welcome ----
  if (step === "welcome") {
    return (
      <KioskFrame>
        <KioskLangSwitcher />
        <h1 className="kiosk-title">{t("Добро пожаловать в киоск регистрации пассажиров на рейс")}</h1>
        <div className="kiosk-card-stack kiosk-card-stack-top">
          <button type="button" className="kiosk-card lg primary" onClick={() => setStep("rules")}>
            {t("Продолжить")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  // ---- Screen 2: Prohibited items ----
  if (step === "rules") {
    return (
      <KioskFrame flightLabel={lookup?.flight.flightNumber}>
        <h1 className="kiosk-title">{t("Что запрещено к провозу")}</h1>
        <ul className="kiosk-rules-list">
          {PROHIBITED.map(({ icon: Icon, label }) => (
            <li key={label}>
              <span className="kiosk-rule-icon">
                <Icon />
              </span>
              <span className="label">{t(label)}</span>
            </li>
          ))}
        </ul>
        <div className="kiosk-card-stack kiosk-card-stack-top">
          <button type="button" className="kiosk-card md primary" onClick={() => setStep("lookup")}>
            {t("Начать регистрацию")}
          </button>
        </div>
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card sm" onClick={() => setStep("welcome")}>
            {t("Назад")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  // ---- Screen 3 (adapted): booking lookup — no real passport scanner, so this
  // replaces the reference's passport-scan animation with a data-entry card
  // styled in the same system. ----
  if (step === "lookup") {
    return (
      <KioskFrame stepBadge={t("Шаг {n} из 3", { n: 1 })}>
        <h1 className="kiosk-title">{t("Найдите вашу бронь")}</h1>
        <p className="kiosk-sub">
          {t("Введите код бронирования и фамилию любого пассажира — если летите группой, зарегистрируем всех сразу")}
        </p>
        <form onSubmit={submitLookup}>
          <div className="kiosk-field-label">{t("Код бронирования (PNR)")}</div>
          <input
            className="kiosk-field"
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            placeholder={t("Например, ABC123")}
            autoFocus
            maxLength={10}
          />
          <div className="kiosk-field-label">{t("Фамилия")}</div>
          <input className="kiosk-field" value={surname} onChange={(e) => setSurname(e.target.value.toUpperCase())} placeholder="IVANOV" maxLength={40} />
          {error && <div className="kiosk-error">{error}</div>}
          <div className="kiosk-card-stack">
            <button type="submit" className="kiosk-card md primary" disabled={loading || !pnr.trim() || !surname.trim()}>
              {loading && <span className="kiosk-spinner-dark" />}
              {loading ? t("Ищем…") : t("Найти бронь")}
            </button>
            <button type="button" className="kiosk-card sm" onClick={() => setStep("rules")}>
              {t("Назад")}
            </button>
          </div>
        </form>
      </KioskFrame>
    );
  }

  // ---- Screen 4: found passengers ----
  if (step === "found" && lookup) {
    if (queue.length === 0) {
      const anyBags = lookup.members.find((m) => m.bagTags.length > 0 && !m.bagDroppedAt);
      return (
        <KioskFrame flightLabel={lookup.flight.flightNumber} stepBadge={t("Шаг {n} из 3", { n: 1 })}>
          <h1 className="kiosk-title">{t("На рейс {flight} уже зарегистрированы все пассажиры этой брони", { flight: lookup.flight.flightNumber })}</h1>
          <div className="kiosk-found-list">
            {lookup.members.map((m) => (
              <div className="kiosk-found-row" key={m.passenger.id}>
                <span className="kiosk-found-dot" />
                <div>
                  <div className="kiosk-found-name">{fullName(m.passenger)}</div>
                  <div className="kiosk-found-sub">{t("Место {seat}", { seat: m.passenger.seat ? formatSeat(m.passenger.seat) : "" })}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="kiosk-card-stack">
            {anyBags && (
              <Link to={`/kiosk/bag-drop?pnr=${anyBags.passenger.record_locator}&surname=${anyBags.passenger.surname}`} className="kiosk-card md primary">
                {t("Сдать багаж")}
              </Link>
            )}
            <button type="button" className="kiosk-card sm" onClick={resetAll}>
              {t("Назад")}
            </button>
          </div>
        </KioskFrame>
      );
    }
    return (
      <KioskFrame flightLabel={lookup.flight.flightNumber} stepBadge={t("Шаг {n} из 3", { n: 1 })}>
        <p className="kiosk-flight-line">{t("Ваш рейс {flight}", { flight: lookup.flight.flightNumber })}</p>
        <div className="kiosk-found-list">
          {lookup.members.map((m) => (
            <div className="kiosk-found-row" key={m.passenger.id}>
              <span className="kiosk-found-dot" />
              <div>
                <div className="kiosk-found-name">{fullName(m.passenger)}</div>
                {m.passenger.checkin_status === "CHECKED_IN" && (
                  <div className="kiosk-found-sub">
                    {t("Уже зарегистрирован(а) · место {seat}", { seat: m.passenger.seat ? formatSeat(m.passenger.seat) : "" })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="kiosk-sub">{t("Теперь вы можете перейти к выбору мест в салоне самолёта")}</p>
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card md primary" onClick={proceedToSeats} disabled={loading}>
            {loading && <span className="kiosk-spinner-dark" />}
            {t("Перейти к выбору мест")}
          </button>
          <button type="button" className="kiosk-card sm" onClick={resetAll}>
            {t("Назад")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  // ---- Screen 5: seat selection ----
  if (step === "seats" && lookup) {
    const occupied = new Set(seats.filter((s) => s.passenger_id).map((s) => s.seat));
    const takenByOthers = new Set(Object.entries(seatPicks).filter(([id]) => Number(id) !== activePaxId).map(([, seat]) => seat));
    const ineligible = new Set([...occupied, ...takenByOthers]);
    const allPicked = queue.every((m) => seatPicks[m.passenger.id]);
    return (
      <KioskFrame flightLabel={lookup.flight.flightNumber} stepBadge={t("Шаг {n} из 3", { n: 2 })}>
        <h1 className="kiosk-title alt">{t("Выбор места")}</h1>
        <div className="kiosk-pax-tabs">
          {queue.map((m) => (
            <button
              key={m.passenger.id}
              type="button"
              className={`kiosk-pax-tab${activePaxId === m.passenger.id ? " active" : ""}`}
              onClick={() => setActivePaxId(m.passenger.id)}
            >
              <span className="kiosk-pax-tab-name">{fullName(m.passenger)}</span>
              <span className={`kiosk-pax-seat-badge${seatPicks[m.passenger.id] ? "" : " empty"}`}>
                {seatPicks[m.passenger.id] ? formatSeat(seatPicks[m.passenger.id]) : "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="kiosk-seatmap-wrap">
          <div className="kiosk-seatmap-scroll">
            {seats.length > 0 && (
              <SeatMapGrid seats={seats} selected={activePaxId ? seatPicks[activePaxId] ?? null : null} onSelect={pickSeat} ineligibleSeats={ineligible} />
            )}
          </div>
        </div>
        <p className="kiosk-seatmap-hint">
          {t("Выберите места в салоне самолёта. После этого вы сможете зарегистрироваться на рейс, а затем — оформить багаж")}
        </p>
        {error && <div className="kiosk-error">{error}</div>}
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card md primary" onClick={confirmCheckinAll} disabled={!allPicked || loading}>
            {loading && <span className="kiosk-spinner-dark" />}
            {loading ? t("Регистрируем…") : t("Зарегистрировать")}
          </button>
          <button type="button" className="kiosk-card sm" onClick={() => setStep("found")}>
            {t("Назад")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  // ---- Screen 6: confirmation ----
  if (step === "confirm" && checkinResults.length > 0) {
    return (
      <KioskFrame flightLabel={checkinResults[0].flight.flightNumber} stepBadge={t("Шаг {n} из 3", { n: 3 })}>
        <h1 className="kiosk-title alt">{t("На рейс {flight} зарегистрированы:", { flight: checkinResults[0].flight.flightNumber })}</h1>
        <div className="kiosk-confirm-list">
          {checkinResults.map((r) => (
            <div className="kiosk-confirm-row" key={r.passenger.id}>
              <div className="kiosk-confirm-name">{fullName(r.passenger)}</div>
              <div className="kiosk-confirm-seat">{t("Место {seat}", { seat: r.passenger.seat ? formatSeat(r.passenger.seat) : "" })}</div>
            </div>
          ))}
        </div>
        {checkinWarnings.length > 0 && (
          <div className="kiosk-error">{t("Не удалось зарегистрировать: {list}", { list: checkinWarnings.join("; ") })}</div>
        )}
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card md primary" onClick={goToBaggage}>
            {t("Перейти к регистрации багажа")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  // ---- Screens 7/8: baggage, per passenger ----
  if (step === "baggage" && checkinResults[bagIndex]) {
    const current = checkinResults[bagIndex];
    const isLast = bagIndex + 1 >= checkinResults.length;
    const stepBadge =
      t("Шаг {n} из 3", { n: 3 }) + (checkinResults.length > 1 ? ` · ${bagIndex + 1}/${checkinResults.length}` : "");
    return (
      <KioskFrame flightLabel={current.flight.flightNumber} stepBadge={stepBadge}>
        <h1 className="kiosk-title">{t("Регистрация багажа")}</h1>
        <p className="kiosk-instruction">
          {checkinResults.length > 1 && <>{fullName(current.passenger)}. </>}
          {t("Поставьте одно место вашего багажа на платформу слева от дисплея")}
        </p>
        {bagWeights.length > 0 && (
          <div className="kiosk-bag-weight-list">
            {bagWeights.map((w, i) => (
              <div className="kiosk-bag-weight-card" key={i}>
                <span className="kiosk-bag-weight-value">{t("{w} кг", { w })}</span>
                <button type="button" className="kiosk-bag-weight-remove" onClick={() => setBagWeights((ws) => ws.filter((_, idx) => idx !== i))}>
                  {t("Удалить")}
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <div className="kiosk-error">{error}</div>}
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card md" onClick={() => setBagWeights((ws) => [...ws, randomWeight()])} disabled={bagWeights.length >= 9}>
            {t("Добавить место багажа")}
          </button>
          <button type="button" className="kiosk-card md primary" onClick={printBagsAndAdvance} disabled={loading}>
            {loading && <span className="kiosk-spinner-dark" />}
            {loading
              ? t("Печатаем…")
              : bagWeights.length > 0
              ? t("Распечатать багажные бирки")
              : isLast
              ? t("Без багажа — завершить")
              : t("Без багажа — далее")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  // ---- Screen 9: success ----
  if (step === "success") {
    return (
      <KioskFrame flightLabel={checkinResults[0]?.flight.flightNumber}>
        <h1 className="kiosk-title success">{t("Счастливого полёта!")}</h1>
        {allBagTags.length > 0 && (
          <>
            <div className="kiosk-tags-label">{t("Багажные бирки:")}</div>
            {allBagTags.map((tag) => (
              <div key={tag} className="kiosk-tag-card">
                {tag}
              </div>
            ))}
            <p className="kiosk-instruction" style={{ marginTop: 20 }}>
              {t("Теперь вам следует отнести багаж на ленту транспортёра")}
            </p>
            <img
              className="kiosk-belt-photo"
              alt=""
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='265' viewBox='0 0 360 265'%3E%3Crect width='360' height='265' fill='%23e2e8f0'/%3E%3Crect y='170' width='360' height='40' fill='%2394a3b8'/%3E%3Crect x='30' y='140' width='55' height='35' rx='6' fill='%232563eb'/%3E%3Crect x='110' y='150' width='45' height='30' rx='6' fill='%23334155'/%3E%3Crect x='180' y='135' width='60' height='40' rx='6' fill='%23c46900'/%3E%3Crect x='260' y='148' width='50' height='32' rx='6' fill='%23337f00'/%3E%3C/svg%3E"
            />
          </>
        )}
        {allBagTags.length === 0 && <p className="kiosk-instruction">{t("Багажа нет — проходите к выходу на посадку по указателям.")}</p>}
        <div className="kiosk-card-stack">
          <button type="button" className="kiosk-card md primary" onClick={resetAll}>
            {t("Закончить сеанс регистрации")}
          </button>
        </div>
      </KioskFrame>
    );
  }

  return null;
}
