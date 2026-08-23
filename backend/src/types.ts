export type FlightStatus = "SCHEDULED" | "CHECKIN_OPEN" | "BOARDING" | "CLOSED" | "DEPARTED";
export type CheckinStatus = "NOT_CHECKED_IN" | "CHECKED_IN";
export type BoardingStatus = "NOT_BOARDED" | "BOARDED" | "OFFLOADED" | "NO_SHOW";

/**
 * SSR (Special Service Request) codes — a small subset of the standard
 * IATA/ATA SSR code list used in reservations/DCS messaging.
 */
export const SSR_CODES = [
  "WCHR", // wheelchair - can walk to/from seat
  "WCHS", // wheelchair - cannot walk, needs assistance to seat
  "UMNR", // unaccompanied minor
  "BLND", // blind passenger
  "DEAF", // deaf passenger
  "VGML", // vegetarian meal
  "PETC", // passenger with pet in cabin
  "EXST", // extra seat purchased
] as const;
export type SsrCode = (typeof SSR_CODES)[number];

export interface Flight {
  id: number;
  flight_number: string;
  carrier_code: string;
  origin: string;
  destination: string;
  std: string; // scheduled time of departure, ISO
  aircraft_type: string;
  status: FlightStatus;
  last_checkin_sequence: number;
  closed_at: string | null;
}

export interface Passenger {
  id: number;
  record_locator: string;
  flight_id: number;
  surname: string;
  given_name: string;
  ticket_number: string;
  document_type: string;
  document_number: string | null;
  nationality: string | null;
  dob: string | null;
  doc_expiry: string | null;
  ssr: string; // JSON-encoded string[]
  infant: 0 | 1;
  bag_count: number;
  bag_weight_kg: number;
  checkin_status: CheckinStatus;
  boarding_status: BoardingStatus;
  seat: string | null;
  checkin_sequence: number | null;
  bcbp: string | null;
  created_at: string;
}
