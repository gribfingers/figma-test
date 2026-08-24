import { Passenger } from "./api";

/** Same list the check-in flow offers (routes/checkin.ts has no dedicated enum on the wire, just free-form SSR codes). */
export const SSR_OPTIONS = ["WCHR", "WCHS", "UMNR", "BLND", "DEAF", "VGML", "PETC", "EXST"];

/**
 * Fields with no dedicated column yet — waitlist code, priority list,
 * passenger type, iAPP (checked in via mobile app), and the connecting
 * inbound/outbound flight number — stored as JSON in Passenger.extra,
 * same pattern as Flight.extra.
 */
export interface PassengerExtra {
  wl?: string;
  pl?: string;
  type?: string;
  iapp?: boolean;
  inbound?: string;
  outbound?: string;
}

export function parsePassengerExtra(p: Passenger): PassengerExtra {
  if (!p.extra) return {};
  try {
    return JSON.parse(p.extra);
  } catch {
    return {};
  }
}
