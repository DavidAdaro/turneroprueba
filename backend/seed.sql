-- Datos de prueba. Todos los usuarios tienen la contraseña: turnero123
INSERT INTO settings (key, value) VALUES
  ('clinic_name', 'Centro de Imágenes (prueba)'),
  ('clinic_address', 'Av. Siempreviva 742, Córdoba'),
  ('clinic_phone', '0351 555-0000');

INSERT INTO insurances (id, name, code, requires_authorization) VALUES
  (1, 'Particular', 'PART', 0),
  (2, 'OSDE', 'OSDE', 0),
  (3, 'PAMI', 'PAMI', 1),
  (4, 'Swiss Medical', 'SMG', 1),
  (5, 'APROSS', 'APROSS', 1);

INSERT INTO users (name, email, password_hash, role, license_number) VALUES
  ('Administrador', 'admin@turnero.test', '$2a$10$4LsiadQQuLPCNH5OAVVNvO1JHfVvzYoHRqZmrQ/.DWiajTC7.3yiW', 'admin', NULL),
  ('Recepción', 'recepcion@turnero.test', '$2a$10$4LsiadQQuLPCNH5OAVVNvO1JHfVvzYoHRqZmrQ/.DWiajTC7.3yiW', 'reception', NULL),
  ('Técnico Pérez', 'tecnico@turnero.test', '$2a$10$4LsiadQQuLPCNH5OAVVNvO1JHfVvzYoHRqZmrQ/.DWiajTC7.3yiW', 'technician', NULL),
  ('Dra. Gómez', 'informante@turnero.test', '$2a$10$4LsiadQQuLPCNH5OAVVNvO1JHfVvzYoHRqZmrQ/.DWiajTC7.3yiW', 'radiologist', 'MP 12345');

INSERT INTO equipment (id, name, modality, ae_title, location, color) VALUES
  (1, 'Resonador 1.5T', 'MR', 'RM15T', 'Sala 1', '#7c3aed'),
  (2, 'Tomógrafo 64 cortes', 'CT', 'TC64', 'Sala 2', '#0891b2'),
  (3, 'Ecógrafo 1', 'US', 'ECO1', 'Consultorio 3', '#16a34a'),
  (4, 'Sala de Rayos', 'DX', 'RX1', 'Sala 4', '#ea580c'),
  (5, 'Mamógrafo', 'MG', 'MAMO1', 'Sala 5', '#db2777');

-- Lunes a viernes. Rayos y eco además sábado a la mañana.
INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes) VALUES
  (1, 1, '08:00', '20:00', 30),
  (1, 2, '08:00', '20:00', 30),
  (1, 3, '08:00', '20:00', 30),
  (1, 4, '08:00', '20:00', 30),
  (1, 5, '08:00', '20:00', 30),
  (2, 1, '08:00', '20:00', 15),
  (2, 2, '08:00', '20:00', 15),
  (2, 3, '08:00', '20:00', 15),
  (2, 4, '08:00', '20:00', 15),
  (2, 5, '08:00', '20:00', 15),
  (3, 1, '08:00', '13:00', 20),
  (3, 2, '08:00', '13:00', 20),
  (3, 3, '08:00', '13:00', 20),
  (3, 4, '08:00', '13:00', 20),
  (3, 5, '08:00', '13:00', 20),
  (3, 1, '15:00', '19:00', 20),
  (3, 2, '15:00', '19:00', 20),
  (3, 3, '15:00', '19:00', 20),
  (3, 4, '15:00', '19:00', 20),
  (3, 5, '15:00', '19:00', 20),
  (4, 1, '08:00', '18:00', 10),
  (4, 2, '08:00', '18:00', 10),
  (4, 3, '08:00', '18:00', 10),
  (4, 4, '08:00', '18:00', 10),
  (4, 5, '08:00', '18:00', 10),
  (5, 1, '09:00', '15:00', 20),
  (5, 2, '09:00', '15:00', 20),
  (5, 3, '09:00', '15:00', 20),
  (5, 4, '09:00', '15:00', 20),
  (5, 5, '09:00', '15:00', 20),
  (3, 6, '08:00', '12:00', 20),
  (4, 6, '08:00', '12:00', 10);

INSERT INTO studies (id, code, name, modality, duration_minutes, contrast, preparation, private_price) VALUES
  (1, '340101', 'RM de cerebro', 'MR', 30, 0, 'Retirar objetos metálicos. Informar si tiene marcapasos, implantes o claustrofobia.', 180000),
  (2, '340102', 'RM de cerebro con gadolinio', 'MR', 45, 1, 'Ayuno de 4 horas. Traer creatinina reciente. Informar marcapasos o implantes.', 240000),
  (3, '340201', 'RM de columna lumbar', 'MR', 30, 0, 'Retirar objetos metálicos.', 180000),
  (4, '340301', 'RM de rodilla', 'MR', 30, 0, 'Retirar objetos metálicos.', 170000),
  (5, '341001', 'TC de cerebro sin contraste', 'CT', 15, 0, NULL, 90000),
  (6, '341002', 'TC de tórax', 'CT', 15, 0, NULL, 95000),
  (7, '341003', 'TC de abdomen y pelvis con contraste', 'CT', 30, 1, 'Ayuno de 6 horas. Traer creatinina reciente. Tomar el contraste oral 1 hora antes.', 150000),
  (8, '180101', 'Ecografía abdominal', 'US', 20, 0, 'Ayuno de 6 horas.', 35000),
  (9, '180201', 'Ecografía tiroidea', 'US', 20, 0, NULL, 30000),
  (10, '180301', 'Ecografía ginecológica transvaginal', 'US', 20, 0, 'Vejiga vacía.', 35000),
  (11, '420101', 'Rx de tórax (frente y perfil)', 'DX', 10, 0, NULL, 15000),
  (12, '420201', 'Rx de columna lumbosacra', 'DX', 10, 0, NULL, 18000),
  (13, '420301', 'Rx de rodilla', 'DX', 10, 0, NULL, 14000),
  (14, '430101', 'Mamografía bilateral', 'MG', 20, 0, 'No usar desodorante, talco ni cremas el día del estudio.', 40000);

INSERT INTO study_prices (study_id, insurance_id, price, copay)
  SELECT s.id, i.id, ROUND(s.private_price * CASE i.id WHEN 2 THEN 0.8 WHEN 3 THEN 0.45 WHEN 4 THEN 0.75 ELSE 0.6 END, 0),
         CASE i.id WHEN 3 THEN 0 ELSE ROUND(s.private_price * 0.05, 0) END
  FROM studies s, insurances i WHERE i.id > 1;

INSERT INTO patients (dni, first_name, last_name, birth_date, sex, phone, email, insurance_id, insurance_plan, affiliate_number, weight_kg, notes) VALUES
  ('30111222', 'María', 'González', '1983-04-12', 'F', '5493515551111', 'maria@example.com', 2, '210', '61234567801', 64, NULL),
  ('25333444', 'Juan', 'Pérez', '1976-09-30', 'M', '5493515552222', NULL, 3, NULL, '150123456789', 88, 'Alérgico al iodo'),
  ('40555666', 'Lucía', 'Fernández', '1997-01-22', 'F', '5493515553333', 'lucia@example.com', 1, NULL, NULL, 58, NULL),
  ('18777888', 'Carlos', 'Rodríguez', '1955-11-05', 'M', '5493515554444', NULL, 5, NULL, '0034567', 92, 'Marcapasos (no apto RM)'),
  ('35999000', 'Ana', 'Martínez', '1990-06-18', 'F', '5493515555555', NULL, 4, 'SMG20', '80012345', 70, 'Claustrofobia leve');

-- Más pacientes de ejemplo.
INSERT INTO patients (dni, first_name, last_name, birth_date, sex, phone, insurance_id, affiliate_number, weight_kg) VALUES
  ('32504614', 'Cynthia Yamila', 'Callari', '1986-06-09', 'F', '5492615550001', 4, '80055501', 61),
  ('21374803', 'Walter Horacio', 'Torre', '1969-12-17', 'M', '5492615550002', 5, '0045501', 84),
  ('14677376', 'Esther Rosalia', 'Castro', '1961-10-05', 'F', '5492615550003', 3, '150555000301', 70),
  ('34952803', 'Francisco Andrés', 'Romero', '1989-09-19', 'M', '5492615550004', 5, '0045502', 79),
  ('27496639', 'Viviana', 'Gómez', '1979-06-03', 'F', '5492615550005', 1, NULL, 66),
  ('11105214', 'Carmelo Oscar', 'Módica', '1953-10-17', 'M', '5492615550006', 5, '0045503', 90),
  ('5996591', 'Dora Edith', 'Gatica', '1950-10-06', 'F', '5492615550007', 5, '0045504', 58),
  ('39767703', 'María Florencia', 'Hansen', '1996-03-26', 'F', '5492615550008', 5, '0045505', 55);

-- Turnos de HOY (fecha local Argentina = UTC-3) en distintos estados, para
-- ver el turnero lleno al entrar. Los timestamps se guardan en UTC.
INSERT INTO appointments (equipment_id, patient_id, study_id, date, start_time, end_time, status, insurance_id, order_received,
  referring_physician, accession_number, study_instance_uid, pacs_status, image_count, technician_id,
  arrived_at, started_at, completed_at, care_type, created_by)
SELECT 1, p.id, v.study_id, date('now', '-3 hours'), v.t, v.e, v.status, p.insurance_id, v.ord, 'Dr. Ejemplo',
  CASE WHEN v.arr IS NULL THEN NULL ELSE strftime('%Y%m%d', 'now', '-3 hours') || '-' || v.acc END,
  CASE WHEN v.arr IS NULL THEN NULL ELSE '2.25.' || v.acc || '1234567890123456789' END,
  CASE WHEN v.fin IS NULL THEN 'pending' ELSE 'received' END,
  CASE WHEN v.fin IS NULL THEN NULL ELSE v.imgs END,
  CASE WHEN v.ini IS NULL THEN NULL ELSE 3 END,
  CASE WHEN v.arr IS NULL THEN NULL ELSE datetime(date('now', '-3 hours') || ' ' || v.arr, '+3 hours') END,
  CASE WHEN v.ini IS NULL THEN NULL ELSE datetime(date('now', '-3 hours') || ' ' || v.ini, '+3 hours') END,
  CASE WHEN v.fin IS NULL THEN NULL ELSE datetime(date('now', '-3 hours') || ' ' || v.fin, '+3 hours') END,
  v.care, 2
FROM (
  WITH v(dni, study_id, t, e, status, ord, acc, arr, ini, fin, imgs, care) AS (VALUES
  ('32504614', 3, '08:00', '08:30', 'delivered', 1, '0001', '07:50', '08:00', '08:30', 312, 'INT'),
  ('14677376', 4, '08:30', '09:00', 'reported', 1, '0002', '08:06', '08:19', '09:14', 280, 'AMB'),
  ('34952803', 3, '09:00', '09:30', 'completed', 1, '0003', '08:38', '09:14', '09:53', 344, 'AMB'),
  ('27496639', 1, '09:30', '10:00', 'completed', 1, '0004', '09:30', '09:58', '10:50', 256, 'AMB'),
  ('11105214', 3, '10:00', '10:30', 'in_progress', 1, '0005', '10:34', '11:02', NULL, NULL, 'AMB'),
  ('5996591', 3, '10:30', '11:00', 'arrived', 1, '0006', '10:41', NULL, NULL, NULL, 'GUA'),
  ('39767703', 1, '11:00', '11:30', 'confirmed', 1, NULL, NULL, NULL, NULL, NULL, 'AMB'),
  ('21374803', 4, '11:30', '12:00', 'given', 0, NULL, NULL, NULL, NULL, NULL, 'AMB'),
  ('25333444', 1, '12:00', '12:30', 'absent', 1, NULL, NULL, NULL, NULL, NULL, 'AMB'),
  ('35999000', 4, '12:30', '13:00', 'cancelled', 0, NULL, NULL, NULL, NULL, NULL, 'AMB')
  ) SELECT * FROM v
) v JOIN patients p ON p.dni = v.dni;

INSERT INTO reports (appointment_id, radiologist_id, technique, findings, conclusion, status, signed_at)
SELECT a.id, 4, 'RM 1.5T, secuencias habituales.', 'Sin alteraciones de señal significativas.', 'Estudio dentro de límites normales.', 'signed', datetime('now')
FROM appointments a WHERE a.status IN ('reported', 'delivered');
