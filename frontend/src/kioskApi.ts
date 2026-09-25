// Minimal, deliberately separate fetch wrapper for the self-service kiosk —
// no auth token, no 401/dcs-unauthorized handling (kiosk endpoints are
// public and never 401), unlike api.ts's request(). Keeps the kiosk surface
// fully independent of the agent app's auth machinery.
//
// SeatCell is imported type-only from api.ts so the kiosk's seat picker can
// reuse the same SeatMapGrid component the agent app uses (per the real
// seat map, not a kiosk-specific reimplementation) — this has zero runtime
// dependency on api.ts's auth machinery, just the shared shape.
import type { SeatCell } from "./api";
export type { SeatCell };

export interface KioskPassenger {
  id: number;
  flight_id: number;
  record_locator: string;
  surname: string;
  given_name: string;
  middle_name: string | null;
  ticket_number: string;
  bag_count: number;
  checkin_status: "NOT_CHECKED_IN" | "CHECKED_IN";
  seat: string | null;
  checkin_sequence: number | null;
  bcbp: string | null;
  class: "C" | "Y";
}

export interface KioskFlight {
  flightNumber: string;
  origin: string;
  destination: string;
  std: string;
}

/** One member of the travel party sharing a PNR + flight. */
export interface PartyMember {
  passenger: KioskPassenger;
  bagTags: string[];
  bagDroppedAt: string | null;
}

export interface LookupResult {
  members: PartyMember[];
  flight: KioskFlight;
}

export interface CheckinResult {
  passenger: KioskPassenger;
  flight: KioskFlight;
  bcbp: string;
  bagTags: string[];
}

export interface BagDropResult {
  bagDroppedAt: string;
  bagDropDesk: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/kiosk${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = res.status === 204 ? undefined : await res.json();
  if (!res.ok) {
    const message = typeof body === "object" && body?.error ? body.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const kioskApi = {
  lookupByPnr: (pnr: string, surname: string) =>
    request<LookupResult>(`/lookup?pnr=${encodeURIComponent(pnr)}&surname=${encodeURIComponent(surname)}`),
  lookupByEticket: (eticket: string) => request<LookupResult>(`/lookup?eticket=${encodeURIComponent(eticket)}`),
  checkin: (
    passengerId: number,
    data: { document_number: string; nationality?: string; dob?: string; doc_expiry: string; bag_count: number; seat?: string }
  ) => request<CheckinResult>(`/${passengerId}/checkin`, { method: "POST", body: JSON.stringify(data) }),
  seatmap: (flightId: number) => request<SeatCell[]>(`/seatmap/${flightId}`),
  addBags: (passengerId: number, count: number) =>
    request<{ bagTags: string[]; allBagTags: string[] }>(`/${passengerId}/bags`, { method: "POST", body: JSON.stringify({ count }) }),
  bagDropLookupByTag: (tag: string) => request<LookupResult>(`/bag-drop/lookup?tag=${encodeURIComponent(tag)}`),
  bagDropLookupByPnr: (pnr: string, surname: string) =>
    request<LookupResult>(`/bag-drop/lookup?pnr=${encodeURIComponent(pnr)}&surname=${encodeURIComponent(surname)}`),
  bagDrop: (passengerId: number) => request<BagDropResult>(`/${passengerId}/bag-drop`, { method: "POST" }),
};
