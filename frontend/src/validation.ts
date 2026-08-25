// Keystroke-level input filters for free-text fields — they strip invalid
// characters as the user types instead of only flagging errors afterwards,
// so a field simply can't hold the wrong kind of value.

/** Digits only (e.g. Gate, Max KZ/kg, Terminal, Check-in desk). */
export function digitsOnly(value: string, maxLen?: number): string {
  const cleaned = value.replace(/[^0-9]/g, "");
  return maxLen != null ? cleaned.slice(0, maxLen) : cleaned;
}

/** Letters/digits/hyphen, uppercased (e.g. A/C reg, seat config, partner flight). */
export function alphanumericUpper(value: string, maxLen?: number): string {
  const cleaned = value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
  return maxLen != null ? cleaned.slice(0, maxLen) : cleaned;
}

/** Digits and colon only, HH:MM length (e.g. departure/arrival time). */
export function timeInput(value: string): string {
  return value.replace(/[^0-9:]/g, "").slice(0, 5);
}

/** Digits and hyphen only, YYYY-MM-DD length (e.g. departure/arrival date). */
export function dateInput(value: string): string {
  return value.replace(/[^0-9-]/g, "").slice(0, 10);
}

/** HH:MM input mask — keeps digits only and auto-inserts the colon as they're typed. */
export function maskTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** dd.mm.yyyy input mask — keeps digits only and auto-inserts the dots as they're typed. */
export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}
