-- Mini RIS (sector Imágenes): esquema completo de D1 (SQLite).
-- Fechas 'YYYY-MM-DD' y horas 'HH:MM' en hora local del centro.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS appointment_events;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS study_prices;
DROP TABLE IF EXISTS studies;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS schedule_blocks;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS insurances;
DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Obras sociales / prepagas ("Particular" es una más).
CREATE TABLE insurances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  requires_authorization INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Equipos / salas: el recurso sobre el que se dan los turnos.
-- modality: código DICOM (MR, CT, US, DX, MG, NM, ...).
CREATE TABLE equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  ae_title TEXT,                -- AE Title DICOM (para la worklist)
  location TEXT,
  color TEXT NOT NULL DEFAULT '#2563eb',
  active INTEGER NOT NULL DEFAULT 1
);

-- admin: configuración. reception: turnos, admisión y entrega.
-- technician: worklist y realización. radiologist: informes.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reception', 'technician', 'radiologist')),
  license_number TEXT,          -- matrícula (firma de informes)
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Horarios de atención semanales por equipo (0 = domingo ... 6 = sábado).
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 20
);

-- Bloqueos: mantenimiento, feriados. equipment_id NULL = todo el centro.
-- Sin horas = día entero.
CREATE TABLE schedule_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  reason TEXT
);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT NOT NULL UNIQUE,     -- también se usa como Patient ID DICOM
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT,
  sex TEXT CHECK (sex IN ('F', 'M', 'O') OR sex IS NULL),
  phone TEXT,
  email TEXT,
  insurance_id INTEGER REFERENCES insurances(id) ON DELETE SET NULL,
  insurance_plan TEXT,
  affiliate_number TEXT,
  weight_kg REAL,
  notes TEXT,                   -- alergias, marcapasos, claustrofobia...
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catálogo de estudios (procedimientos) por modalidad.
CREATE TABLE studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,                    -- código de nomenclador
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  contrast INTEGER NOT NULL DEFAULT 0,
  preparation TEXT,             -- indicaciones para el paciente
  private_price REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE study_prices (
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  insurance_id INTEGER NOT NULL REFERENCES insurances(id) ON DELETE CASCADE,
  price REAL NOT NULL DEFAULT 0,
  copay REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (study_id, insurance_id)
);

-- Un turno = una orden de estudio. Flujo:
-- given → confirmed → arrived (admitido, con N° de acceso) → in_progress
-- (en sala) → completed (adquirido, en PACS) → reported (informe firmado)
-- → delivered (entregado). Salidas: absent, cancelled.
CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  study_id INTEGER NOT NULL REFERENCES studies(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'given' CHECK (status IN
    ('given', 'confirmed', 'arrived', 'in_progress', 'completed', 'reported', 'delivered', 'absent', 'cancelled')),
  overbook INTEGER NOT NULL DEFAULT 0,
  care_type TEXT NOT NULL DEFAULT 'AMB' CHECK (care_type IN ('AMB', 'INT', 'GUA')), -- ambulatorio / internado / guardia
  insurance_id INTEGER REFERENCES insurances(id) ON DELETE SET NULL,
  authorization_number TEXT,
  referring_physician TEXT,     -- médico derivante
  clinical_indication TEXT,     -- diagnóstico presuntivo de la orden
  order_received INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  cancel_reason TEXT,
  accession_number TEXT UNIQUE, -- se genera en la admisión
  study_instance_uid TEXT,
  pacs_status TEXT NOT NULL DEFAULT 'pending' CHECK (pacs_status IN ('pending', 'received', 'error')),
  image_count INTEGER,
  technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  technician_notes TEXT,
  reminder_sent_at TEXT,
  arrived_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  delivered_at TEXT,
  delivered_to TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_appointments_day ON appointments(date, equipment_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Informe del estudio (uno por turno).
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  radiologist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  technique TEXT,
  findings TEXT,
  conclusion TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  signed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Auditoría de cada paso del turno.
CREATE TABLE appointment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_appointment ON appointment_events(appointment_id);

-- API keys para sistemas externos (InPatient, PACS, broker de worklist).
-- Solo se guarda el hash SHA-256; la key completa se muestra una sola vez.
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT '[]',   -- JSON: ["schedule:read", "worklist:read", "pacs:write"]
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);
