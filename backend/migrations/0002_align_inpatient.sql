-- Alinea los nombres de equipo con los de InPatient y agrega las variantes
-- con contraste de TC de cerebro y de tórax. Idempotente: se puede correr
-- varias veces (npm run setup la aplica sin borrar datos).

-- 1) Nombres de equipo iguales a los de InPatient (Ecógrafo 1 ya coincidía;
--    Mamógrafo no tiene equivalente en InPatient y queda como está).
UPDATE equipment SET name = 'Resonador 1' WHERE name = 'Resonador 1.5T';
UPDATE equipment SET name = 'Tomógrafo 1' WHERE name = 'Tomógrafo 64 cortes';
UPDATE equipment SET name = 'Sala de Rayos 1' WHERE name = 'Sala de Rayos';

-- 2) Estudios con contraste que faltaban (solo si no existen).
INSERT INTO studies (code, name, modality, duration_minutes, contrast, preparation, private_price)
SELECT '341004', 'TC de cerebro con contraste', 'CT', 20, 1,
  'Ayuno de 4 horas. Traer creatinina reciente. Informar alergia al yodo/contraste previa.', 120000
WHERE NOT EXISTS (SELECT 1 FROM studies WHERE code = '341004');

INSERT INTO studies (code, name, modality, duration_minutes, contrast, preparation, private_price)
SELECT '341005', 'TC de tórax con contraste', 'CT', 20, 1,
  'Ayuno de 4 horas. Traer creatinina reciente. Informar alergia al yodo/contraste previa.', 125000
WHERE NOT EXISTS (SELECT 1 FROM studies WHERE code = '341005');

-- 3) Valores por obra social de los estudios nuevos (mismo criterio que el seed).
INSERT OR IGNORE INTO study_prices (study_id, insurance_id, price, copay)
SELECT s.id, i.id, ROUND(s.private_price * CASE i.code WHEN 'OSDE' THEN 0.8 WHEN 'PAMI' THEN 0.45 WHEN 'SMG' THEN 0.75 ELSE 0.6 END, 0),
       CASE i.code WHEN 'PAMI' THEN 0 ELSE ROUND(s.private_price * 0.05, 0) END
FROM studies s, insurances i
WHERE s.code IN ('341004', '341005') AND i.code != 'PART';
