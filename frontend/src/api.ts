export type OpsStatus = "SCHEDULED" | "DELAYED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED";

export interface Flight {
  id: number;
  flight_number: string;
  carrier_code: string;
  origin: string;
  destination: string;
  std: string;
  aircraft_type: string;
  status: string;
  last_checkin_sequence: number;
  closed_at: string | null;
  terminal: string | null;
  gate: string | null;
  aircraft_reg: string | null;
  aircraft_version: string | null;
  etd: string | null;
  sta: string | null;
  ata: string | null;
  ops_status: OpsStatus;
  extra: string | null;
}

export interface Passenger {
  id: number;
  record_locator: string;
  flight_id: number;
  surname: string;
  given_name: string;
  ticket_number: string;
  document_type: string | null;
  document_number: string | null;
  nationality: string | null;
  dob: string | null;
  doc_expiry: string | null;
  ssr: string[];
  infant: boolean;
  gender: "M" | "F" | null;
  bag_count: number;
  bag_weight_kg: number;
  checkin_status: "NOT_CHECKED_IN" | "CHECKED_IN";
  boarding_status: "NOT_BOARDED" | "BOARDED" | "OFFLOADED" | "NO_SHOW";
  seat: string | null;
  checkin_sequence: number | null;
  bcbp: string | null;
  created_at: string;
}

export interface SeatCell {
  seat: string;
  cabin_class: "J" | "Y";
  exit_row: number;
  passenger_id: number | null;
  surname: string | null;
  given_name: string | null;
  record_locator: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const isText = res.headers.get("content-type")?.includes("text/plain");
  const body = res.status === 204 ? undefined : isText ? await res.text() : await res.json();
  if (!res.ok) {
    const message = typeof body === "object" && body?.error ? body.error : String(body);
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  listFlights: () => request<Flight[]>("/flights"),
  getFlight: (id: number) => request<Flight>(`/flights/${id}`),
  createFlight: (data: Partial<Flight>) =>
    request<Flight>("/flights", { method: "POST", body: JSON.stringify(data) }),
  updateFlight: (id: number, data: Partial<Flight>) =>
    request<Flight>(`/flights/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  seatmap: (flightId: number) => request<SeatCell[]>(`/flights/${flightId}/seatmap`),
  passengers: (flightId: number, q?: string) =>
    request<Passenger[]>(`/flights/${flightId}/passengers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  addPassenger: (flightId: number, data: Partial<Passenger>) =>
    request<Passenger>(`/flights/${flightId}/passengers`, { method: "POST", body: JSON.stringify(data) }),
  updatePassenger: (flightId: number, passengerId: number, data: Partial<Passenger>) =>
    request<Passenger>(`/flights/${flightId}/passengers/${passengerId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePassenger: (flightId: number, passengerId: number) =>
    request<void>(`/flights/${flightId}/passengers/${passengerId}`, { method: "DELETE" }),

  findByLocator: (locator: string) =>
    request<(Passenger & { flight_number: string; carrier_code: string; origin: string; destination: string; std: string; flight_status: string })[]>(
      `/checkin/pnr/${encodeURIComponent(locator)}`
    ),
  checkin: (passengerId: number, data: Record<string, unknown>) =>
    request<{ passenger: Passenger; bcbp: string }>(`/checkin/${passengerId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  changeSeat: (passengerId: number, seat: string) =>
    request<Passenger>(`/checkin/${passengerId}/seat`, { method: "POST", body: JSON.stringify({ seat }) }),

  boardingList: (flightId: number) =>
    request<{ passengers: Passenger[]; counts: Record<string, number> }>(`/boarding/${flightId}/passengers`),
  scanBoardingPass: (bcbp: string) =>
    request<{ passenger: Passenger; decoded: Record<string, unknown> }>("/boarding/scan", {
      method: "POST",
      body: JSON.stringify({ bcbp }),
    }),
  offload: (flightId: number, passengerId: number) =>
    request<Passenger>(`/boarding/${flightId}/offload/${passengerId}`, { method: "POST" }),
  closeFlight: (flightId: number) =>
    request<{ flight: Flight; pfs: string }>(`/boarding/${flightId}/close`, { method: "POST" }),

  pnl: (flightId: number) => request<string>(`/manifest/${flightId}/pnl`),
  pfs: (flightId: number) => request<string>(`/manifest/${flightId}/pfs`),
};
