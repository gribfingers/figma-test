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
  middle_name: string | null;
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
  extra: string | null;
}

export type PassengerSearchMode = "surname" | "pnr" | "eticket" | "doc";

export interface PassengerSearchResult extends Passenger {
  flight_number: string;
  carrier_code: string;
  origin: string;
  destination: string;
  std: string;
  flight_status: string;
}

export interface SeatCell {
  seat: string;
  cabin_class: "J" | "Y";
  exit_row: number;
  passenger_id: number | null;
  surname: string | null;
  given_name: string | null;
  record_locator: string | null;
  boarding_status: string | null;
  dob: string | null;
  extra: string | null;
}

export interface User {
  id: number;
  login: string;
  first_name: string;
  last_name: string;
  role: "superadmin" | "user";
  can_edit: number;
  company: string | null;
  avatar: string | null;
  timezone: string;
  bio: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string | null;
  image: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  login: string;
  company: string | null;
  avatar: string | null;
  lastMessage: Message | null;
  unreadCount: number;
}

const TOKEN_KEY = "dcs_token";
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (res.status === 401) {
    setToken(null);
    // App.tsx listens for this to drop back to the login screen without a full page reload.
    window.dispatchEvent(new Event("dcs-unauthorized"));
  }
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
  updateSeat: (flightId: number, seat: string, data: { exit_row?: boolean; extra?: string }) =>
    request<SeatCell>(`/flights/${flightId}/seats/${seat}`, { method: "PATCH", body: JSON.stringify(data) }),
  passengers: (flightId: number, q?: string) =>
    request<Passenger[]>(`/flights/${flightId}/passengers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  addPassenger: (flightId: number, data: Partial<Passenger>) =>
    request<Passenger>(`/flights/${flightId}/passengers`, { method: "POST", body: JSON.stringify(data) }),
  updatePassenger: (flightId: number, passengerId: number, data: Partial<Passenger>) =>
    request<Passenger>(`/flights/${flightId}/passengers/${passengerId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePassenger: (flightId: number, passengerId: number) =>
    request<void>(`/flights/${flightId}/passengers/${passengerId}`, { method: "DELETE" }),

  searchPassengers: (by: PassengerSearchMode, q: string) =>
    request<PassengerSearchResult[]>(`/checkin/search?by=${by}&q=${encodeURIComponent(q)}`),
  checkin: (passengerId: number, data: Record<string, unknown>) =>
    request<{ passenger: Passenger; bcbp: string }>(`/checkin/${passengerId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  changeSeat: (passengerId: number, seat: string) =>
    request<Passenger>(`/checkin/${passengerId}/seat`, { method: "POST", body: JSON.stringify({ seat }) }),
  swapSeats: (passengerId: number, otherPassengerId: number) =>
    request<{ a: Passenger; b: Passenger }>(`/checkin/swap-seats`, {
      method: "POST",
      body: JSON.stringify({ passengerId, otherPassengerId }),
    }),

  boardingList: (flightId: number) =>
    request<{ passengers: Passenger[]; counts: Record<string, number> }>(`/boarding/${flightId}/passengers`),
  scanBoardingPass: (bcbp: string) =>
    request<{ passenger: Passenger; decoded: Record<string, unknown> }>("/boarding/scan", {
      method: "POST",
      body: JSON.stringify({ bcbp }),
    }),
  offload: (flightId: number, passengerId: number) =>
    request<Passenger>(`/boarding/${flightId}/offload/${passengerId}`, { method: "POST" }),
  unboard: (flightId: number, passengerId: number) =>
    request<Passenger>(`/boarding/${flightId}/unboard/${passengerId}`, { method: "POST" }),
  closeFlight: (flightId: number) =>
    request<{ flight: Flight; pfs: string }>(`/boarding/${flightId}/close`, { method: "POST" }),

  pnl: (flightId: number) => request<string>(`/manifest/${flightId}/pnl`),
  pfs: (flightId: number) => request<string>(`/manifest/${flightId}/pfs`),

  login: (login: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  updateMe: (data: { avatar?: string; timezone?: string; bio?: string }) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  listUsers: () => request<User[]>("/users"),
  createUser: (data: {
    login: string;
    first_name: string;
    last_name: string;
    role?: "superadmin" | "user";
    can_edit?: boolean;
    company?: string;
  }) => request<{ user: User; password: string }>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (
    id: number,
    data: Partial<{ first_name: string; last_name: string; role: "superadmin" | "user"; can_edit: boolean; company: string }>
  ) => request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  resetUserPassword: (id: number) => request<{ password: string }>(`/users/${id}/reset-password`, { method: "POST" }),
  deleteUser: (id: number) => request<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" }),

  listContacts: () => request<Contact[]>("/messages/contacts"),
  unreadMessageCount: () => request<{ count: number }>("/messages/unread-count"),
  getThread: (userId: number) => request<Message[]>(`/messages/${userId}`),
  sendMessage: (userId: number, data: { body?: string; image?: string }) =>
    request<Message>(`/messages/${userId}`, { method: "POST", body: JSON.stringify(data) }),
};
