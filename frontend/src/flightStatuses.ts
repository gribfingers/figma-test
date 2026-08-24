// Flight status glossary — per "Функциональные требования, управление
// статусами рейсов" (flight status management functional requirements).
export interface FlightStatusOption {
  key: string;
  labelRu: string;
  labelEn: string;
  description: string;
  source: string;
}

export const FLIGHT_STATUSES: FlightStatusOption[] = [
  {
    key: "inactive",
    labelRu: "Неактивен",
    labelEn: "Inactive",
    description: "Until passenger lists are received (present in the operational schedule).",
    source: "Automatic / system",
  },
  {
    key: "active_not_open",
    labelRu: "Активен/регистрация закрыта",
    labelEn: "Active/Not open",
    description: "Lists received. Flight prep possible (DCS window open, host notified).",
    source: "Manual / automatic (notifications)",
  },
  {
    key: "open",
    labelRu: "Открыт",
    labelEn: "Open",
    description: "Check-in and boarding possible; the BDG indicator turns on once boarding starts.",
    source: "Manual",
  },
  {
    key: "checkin_closed",
    labelRu: "Регистрация закончена",
    labelEn: "Check in Closed",
    description: "Check-in desks closed. Gate and transfer desks may keep operating.",
    source: "Manual",
  },
  {
    key: "gate_closed",
    labelRu: "Посадка окончена",
    labelEn: "Gate Closed",
    description: "End of boarding (no further boarding). Passenger/bag-tag offload lists are generated.",
    source: "Manual",
  },
  {
    key: "push_back",
    labelRu: "Отправление",
    labelEn: "Push Back",
    description: "RTM and PSM messages sent.",
    source: "Manual",
  },
  {
    key: "take_off",
    labelRu: "Взлет",
    labelEn: "Take Off",
    description: "Flight has departed; active DCS work on the flight is finished.",
    source: "Manual",
  },
  {
    key: "return",
    labelRu: "Возврат",
    labelEn: "Return",
    description: 'Return to the "Gate Closed" status.',
    source: "Manual",
  },
  {
    key: "on_hold",
    labelRu: "Пауза",
    labelEn: "On hold",
    description: "Technical pause, e.g. for a config change, re-seating checks, or LO handling.",
    source: "Automatic or manual",
  },
  {
    key: "canceled_no_host",
    labelRu: "Отмена (без хоста)",
    labelEn: "Canceled (no Host)",
    description: "Check-in/boarding blocked; check-in can be cancelled or passengers rebooked onto other flights.",
    source: "Manual",
  },
  {
    key: "open_airport_only",
    labelRu: "Регистрация только а/п",
    labelEn: "Open for airport only",
    description: "Web, CUSS and through check-in are blocked.",
    source: "Manual",
  },
  {
    key: "fit",
    labelRu: "Заблокирован для изменений",
    labelEn: "FIT",
    description: "No changes of any kind allowed; used in case of incidents.",
    source: "Manual",
  },
];
