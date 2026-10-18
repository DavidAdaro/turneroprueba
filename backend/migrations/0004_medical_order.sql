-- Pedido médico en el turno. ALTER TABLE no es idempotente: npm run setup
-- registra las migraciones aplicadas en _migrations y no la repite.
ALTER TABLE appointments ADD COLUMN order_date TEXT;
ALTER TABLE appointments ADD COLUMN order_physician_license TEXT;
ALTER TABLE appointments ADD COLUMN order_code TEXT;
ALTER TABLE appointments ADD COLUMN order_observations TEXT;
