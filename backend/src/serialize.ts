import { Passenger } from "./types";

export function serializePassenger(p: Passenger) {
  return {
    ...p,
    ssr: JSON.parse(p.ssr || "[]"),
    infant: !!p.infant,
  };
}
