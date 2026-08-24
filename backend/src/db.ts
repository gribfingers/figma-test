import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DB_PATH ?? path.join(__dirname, "..", "data.sqlite3");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_number TEXT NOT NULL,
  carrier_code TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  std TEXT NOT NULL,
  aircraft_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  last_checkin_sequence INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  terminal TEXT,
  gate TEXT,
  aircraft_reg TEXT,
  aircraft_version TEXT,
  etd TEXT,
  sta TEXT,
  ata TEXT,
  ops_status TEXT NOT NULL DEFAULT 'SCHEDULED'
);

CREATE TABLE IF NOT EXISTS seats (
  flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  seat TEXT NOT NULL,
  cabin_class TEXT NOT NULL,
  exit_row INTEGER NOT NULL DEFAULT 0,
  passenger_id INTEGER,
  PRIMARY KEY (flight_id, seat)
);

CREATE TABLE IF NOT EXISTS passengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_locator TEXT NOT NULL,
  flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  surname TEXT NOT NULL,
  given_name TEXT NOT NULL,
  ticket_number TEXT NOT NULL,
  document_type TEXT,
  document_number TEXT,
  nationality TEXT,
  dob TEXT,
  doc_expiry TEXT,
  ssr TEXT NOT NULL DEFAULT '[]',
  infant INTEGER NOT NULL DEFAULT 0,
  gender TEXT,
  bag_count INTEGER NOT NULL DEFAULT 0,
  bag_weight_kg REAL NOT NULL DEFAULT 0,
  checkin_status TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN',
  boarding_status TEXT NOT NULL DEFAULT 'NOT_BOARDED',
  seat TEXT,
  checkin_sequence INTEGER,
  bcbp TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  extra TEXT
);

CREATE INDEX IF NOT EXISTS idx_passengers_flight ON passengers(flight_id);
CREATE INDEX IF NOT EXISTS idx_passengers_locator ON passengers(record_locator);
`);

// Lightweight migration for databases created before the FIDS columns existed.
const existingFlightColumns = new Set(
  (db.prepare("PRAGMA table_info(flights)").all() as { name: string }[]).map((c) => c.name)
);
const flightMigrations: [string, string][] = [
  ["terminal", "ALTER TABLE flights ADD COLUMN terminal TEXT"],
  ["gate", "ALTER TABLE flights ADD COLUMN gate TEXT"],
  ["aircraft_reg", "ALTER TABLE flights ADD COLUMN aircraft_reg TEXT"],
  ["aircraft_version", "ALTER TABLE flights ADD COLUMN aircraft_version TEXT"],
  ["etd", "ALTER TABLE flights ADD COLUMN etd TEXT"],
  ["sta", "ALTER TABLE flights ADD COLUMN sta TEXT"],
  ["ata", "ALTER TABLE flights ADD COLUMN ata TEXT"],
  ["ops_status", "ALTER TABLE flights ADD COLUMN ops_status TEXT NOT NULL DEFAULT 'SCHEDULED'"],
  ["extra", "ALTER TABLE flights ADD COLUMN extra TEXT"],
];
for (const [column, ddl] of flightMigrations) {
  if (!existingFlightColumns.has(column)) db.exec(ddl);
}

const existingPassengerColumns = new Set(
  (db.prepare("PRAGMA table_info(passengers)").all() as { name: string }[]).map((c) => c.name)
);
const passengerMigrations: [string, string][] = [
  ["gender", "ALTER TABLE passengers ADD COLUMN gender TEXT"],
  ["extra", "ALTER TABLE passengers ADD COLUMN extra TEXT"],
];
for (const [column, ddl] of passengerMigrations) {
  if (!existingPassengerColumns.has(column)) db.exec(ddl);
}
