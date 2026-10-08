-- Segundo equipo de cada especialidad (Resonador 2, Tomógrafo 2, Ecógrafo 2,
-- Sala de Rayos 2, Mamógrafo 2) con los mismos horarios que su equipo 1.
-- Idempotente: se puede correr varias veces (npm run setup).

INSERT INTO equipment (name, modality, ae_title, location, color)
SELECT 'Resonador 2', 'MR', 'RM2', 'Sala 6', '#a855f7'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE name = 'Resonador 2');
INSERT INTO equipment (name, modality, ae_title, location, color)
SELECT 'Tomógrafo 2', 'CT', 'TC2', 'Sala 7', '#06b6d4'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE name = 'Tomógrafo 2');
INSERT INTO equipment (name, modality, ae_title, location, color)
SELECT 'Ecógrafo 2', 'US', 'ECO2', 'Consultorio 8', '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE name = 'Ecógrafo 2');
INSERT INTO equipment (name, modality, ae_title, location, color)
SELECT 'Sala de Rayos 2', 'DX', 'RX2', 'Sala 9', '#f97316'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE name = 'Sala de Rayos 2');
INSERT INTO equipment (name, modality, ae_title, location, color)
SELECT 'Mamógrafo 2', 'MG', 'MAMO2', 'Sala 10', '#ec4899'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE name = 'Mamógrafo 2');

-- Horarios: copia los del equipo 1 de la misma especialidad (solo si el
-- equipo nuevo todavía no tiene horarios).
INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes)
SELECT n.id, s.weekday, s.start_time, s.end_time, s.slot_minutes
FROM equipment n JOIN equipment o ON o.name = 'Resonador 1' JOIN schedules s ON s.equipment_id = o.id
WHERE n.name = 'Resonador 2' AND NOT EXISTS (SELECT 1 FROM schedules x WHERE x.equipment_id = n.id);
INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes)
SELECT n.id, s.weekday, s.start_time, s.end_time, s.slot_minutes
FROM equipment n JOIN equipment o ON o.name = 'Tomógrafo 1' JOIN schedules s ON s.equipment_id = o.id
WHERE n.name = 'Tomógrafo 2' AND NOT EXISTS (SELECT 1 FROM schedules x WHERE x.equipment_id = n.id);
INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes)
SELECT n.id, s.weekday, s.start_time, s.end_time, s.slot_minutes
FROM equipment n JOIN equipment o ON o.name = 'Ecógrafo 1' JOIN schedules s ON s.equipment_id = o.id
WHERE n.name = 'Ecógrafo 2' AND NOT EXISTS (SELECT 1 FROM schedules x WHERE x.equipment_id = n.id);
INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes)
SELECT n.id, s.weekday, s.start_time, s.end_time, s.slot_minutes
FROM equipment n JOIN equipment o ON o.name = 'Sala de Rayos 1' JOIN schedules s ON s.equipment_id = o.id
WHERE n.name = 'Sala de Rayos 2' AND NOT EXISTS (SELECT 1 FROM schedules x WHERE x.equipment_id = n.id);
INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes)
SELECT n.id, s.weekday, s.start_time, s.end_time, s.slot_minutes
FROM equipment n JOIN equipment o ON o.name = 'Mamógrafo' JOIN schedules s ON s.equipment_id = o.id
WHERE n.name = 'Mamógrafo 2' AND NOT EXISTS (SELECT 1 FROM schedules x WHERE x.equipment_id = n.id);
