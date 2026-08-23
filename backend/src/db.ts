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
  closed_at TEXT
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
  bag_count INTEGER NOT NULL DEFAULT 0,
  bag_weight_kg REAL NOT NULL DEFAULT 0,
  checkin_status TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN',
  boarding_status TEXT NOT NULL DEFAULT 'NOT_BOARDED',
  seat TEXT,
  checkin_sequence INTEGER,
  bcbp TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_passengers_flight ON passengers(flight_id);
CREATE INDEX IF NOT EXISTS idx_passengers_locator ON passengers(record_locator);
`);
