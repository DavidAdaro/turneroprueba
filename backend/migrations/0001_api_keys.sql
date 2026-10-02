-- Para bases creadas antes de las API keys: npm run db:migrate:local
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
