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
  (1, 'Resonador 1', 'MR', 'RM15T', 'Sala 1', '#7c3aed'),
  (2, 'Tomógrafo 1', 'CT', 'TC64', 'Sala 2', '#0891b2'),
  (3, 'Ecógrafo 1', 'US', 'ECO1', 'Consultorio 3', '#16a34a'),
  (4, 'Sala de Rayos 1', 'DX', 'RX1', 'Sala 4', '#ea580c'),
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
  (14, '430101', 'Mamografía bilateral', 'MG', 20, 0, 'No usar desodorante, talco ni cremas el día del estudio.', 40000),
  (15, '341004', 'TC de cerebro con contraste', 'CT', 20, 1, 'Ayuno de 4 horas. Traer creatinina reciente. Informar alergia al yodo/contraste previa.', 120000),
  (16, '341005', 'TC de tórax con contraste', 'CT', 20, 1, 'Ayuno de 4 horas. Traer creatinina reciente. Informar alergia al yodo/contraste previa.', 125000);

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

-- Los turnos de ejemplo (RM, TC y Rx con notas, observaciones, informes e
-- imágenes ficticias) se generan para cualquier día desde el Turnero con el
-- botón "Cargar turnos de ejemplo" (POST /api/demo/appointments).
