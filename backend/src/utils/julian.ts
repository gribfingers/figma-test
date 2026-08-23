/**
 * BCBP (IATA Resolution 792) dates are encoded as a 3-digit day-of-year
 * ("Julian date" in IATA terminology, not a true astronomical Julian day).
 */
export function toJulianDayOfYear(isoDate: string): string {
  const d = new Date(isoDate);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diff = Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
  return String(diff).padStart(3, "0");
}

export function julianDayOfYearToDate(year: number, dayOfYear: number): Date {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + dayOfYear - 1);
  return d;
}
