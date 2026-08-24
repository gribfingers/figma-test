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
