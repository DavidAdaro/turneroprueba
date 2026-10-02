import { nextAccessionNumber, newDicomUid } from './pacs';
import { fromMinutes, nowLocal, toMinutes } from './time';

// Datos 100 % ficticios para probar el RIS: pacientes (DNI 90.000.0xx),
// turnos de RM, TC y Rx con notas, observaciones e informes. Las imágenes
// las genera el visor de demostración a partir de cada turno.

export const DEMO_PATIENTS = [
  { dni: '90000001', first_name: 'Lucía', last_name: 'Benítez', birth_date: '1984-03-12', sex: 'F', insurance: 'OSDE', affiliate_number: '61200001', weight_kg: 62, notes: 'Claustrofobia moderada' },
  { dni: '90000002', first_name: 'Martín', last_name: 'Aguirre', birth_date: '1971-07-28', sex: 'M', insurance: 'PAMI', affiliate_number: '150900000201', weight_kg: 94, notes: 'Alergia al iodo (urticaria en 2019)' },
  { dni: '90000003', first_name: 'Sofía', last_name: 'Quiroga', birth_date: '1995-11-02', sex: 'F', insurance: 'SMG', affiliate_number: '80090003', weight_kg: 57, notes: null },
  { dni: '90000004', first_name: 'Ernesto', last_name: 'Villalba', birth_date: '1948-01-19', sex: 'M', insurance: 'PAMI', affiliate_number: '150900000401', weight_kg: 78, notes: 'Marcapasos (no apto RM). Usa silla de ruedas' },
  { dni: '90000005', first_name: 'Carla', last_name: 'Domínguez', birth_date: '1989-05-07', sex: 'F', insurance: 'APROSS', affiliate_number: '0090005', weight_kg: 70, notes: 'Embarazo descartado (test negativo)' },
  { dni: '90000006', first_name: 'Raúl', last_name: 'Ferreyra', birth_date: '1963-09-30', sex: 'M', insurance: 'OSDE', affiliate_number: '61200006', weight_kg: 101, notes: 'Diabético, creatinina 1.1 (semana pasada)' },
  { dni: '90000007', first_name: 'Ana Paula', last_name: 'Medina', birth_date: '2001-02-14', sex: 'F', insurance: 'PART', affiliate_number: null, weight_kg: 54, notes: null },
  { dni: '90000008', first_name: 'Jorge', last_name: 'Sosa', birth_date: '1957-12-03', sex: 'M', insurance: 'APROSS', affiliate_number: '0090008', weight_kg: 83, notes: 'Prótesis de cadera izquierda (titanio)' },
  { dni: '90000009', first_name: 'Valentina', last_name: 'Ríos', birth_date: '1978-08-21', sex: 'F', insurance: 'SMG', affiliate_number: '80090009', weight_kg: 66, notes: null },
  { dni: '90000010', first_name: 'Héctor', last_name: 'Luna', birth_date: '1966-04-09', sex: 'M', insurance: 'PAMI', affiliate_number: '150900001001', weight_kg: 88, notes: 'Hipoacusia: hablarle de frente' },
  { dni: '90000011', first_name: 'Florencia', last_name: 'Paz', birth_date: '1992-10-25', sex: 'F', insurance: 'OSDE', affiliate_number: '61200011', weight_kg: 60, notes: null },
  { dni: '90000012', first_name: 'Diego', last_name: 'Molina', birth_date: '1986-06-16', sex: 'M', insurance: 'APROSS', affiliate_number: '0090012', weight_kg: 76, notes: 'Lesión deportiva, viene con muletas' },
];

// Un turno de ejemplo por fila. study: código del catálogo del seed.
const PLAN = [
  { dni: '90000001', mod: 'MR', study: '340101', time: '08:00', care: 'AMB', ref: 'Dra. Castillo', ind: 'Cefalea crónica refractaria', notes: 'Claustrofobia: ofrecer música y tapones. Acompañante puede entrar.', tech: 'Se completó el protocolo con pausas. Sin incidencias.', report: { findings: 'Parénquima encefálico de señal conservada. Sistema ventricular de tamaño y morfología normales. No se observan lesiones ocupantes de espacio ni áreas de restricción en difusión.', conclusion: 'RM de cerebro sin hallazgos patológicos.' } },
  { dni: '90000003', mod: 'DX', study: '420101', time: '08:10', care: 'AMB', ref: 'Dr. Navarro', ind: 'Tos persistente de 3 semanas', notes: 'Trae radiografía previa de 2024 para comparar.', tech: 'Proyecciones frente y perfil en bipedestación.', report: { findings: 'Campos pulmonares sin infiltrados ni consolidaciones. Senos costofrénicos libres. Silueta cardíaca de tamaño normal.', conclusion: 'Radiografía de tórax sin alteraciones.' } },
  { dni: '90000002', mod: 'CT', study: '341002', time: '08:30', care: 'INT', ref: 'Dr. Ibáñez (Clínica Médica)', ind: 'Control de nódulo pulmonar', notes: 'Internado piso 3, cama 12. Viene en camilla. NO usar contraste iodado (alergia).', tech: 'TC sin contraste por antecedente alérgico. Cortes de 1 mm.', report: { findings: 'Nódulo sólido de 6 mm en lóbulo superior derecho, sin cambios respecto del estudio previo. No se observan adenomegalias mediastinales.', conclusion: 'Nódulo pulmonar estable. Sugiere control en 12 meses.' } },
  { dni: '90000006', mod: 'CT', study: '341003', time: '09:00', care: 'AMB', ref: 'Dra. Peralta', ind: 'Dolor abdominal en fosa ilíaca derecha', notes: 'Diabético: confirmar suspensión de metformina 48 h posteriores al contraste.', tech: 'Contraste EV 100 ml + oral. Sin reacciones adversas.', report: { findings: 'Hígado, bazo y páncreas sin alteraciones. Apéndice cecal de calibre normal. Litiasis renal derecha de 4 mm no obstructiva.', conclusion: 'Litiasis renal derecha no obstructiva. Sin signos de apendicitis.' } },
  { dni: '90000008', mod: 'DX', study: '420201', time: '09:10', care: 'AMB', ref: 'Dr. Correa (Traumatología)', ind: 'Lumbalgia mecánica', notes: 'Tiene prótesis de cadera: avisar en la toma.', tech: 'Se repitió la proyección lateral por rotación del paciente.', report: { findings: 'Rectificación de la lordosis lumbar. Disminución del espacio discal L4-L5 con osteofitos marginales.', conclusion: 'Cambios degenerativos lumbares, a predominio L4-L5.' } },
  { dni: '90000005', mod: 'MR', study: '340201', time: '09:30', care: 'AMB', ref: 'Dr. Correa (Traumatología)', ind: 'Lumbociatalgia izquierda', notes: 'Trae CD con RM anterior para comparar.', tech: 'Movimiento leve en secuencia T2 axial; se repitió.', report: { findings: 'Protrusión discal posterocentral L5-S1 que contacta la raíz S1 izquierda. Resto de los discos con señal conservada.', conclusion: 'Protrusión discal L5-S1 con contacto radicular S1 izquierdo.' } },
  { dni: '90000010', mod: 'CT', study: '341001', time: '10:00', care: 'GUA', ref: 'Guardia (Dr. Rossi)', ind: 'Traumatismo de cráneo leve', notes: 'Viene de guardia: prioridad. Hipoacusia, hablarle de frente.', tech: 'TC de cerebro sin contraste. Paciente colaborador.', report: null },
  { dni: '90000012', mod: 'MR', study: '340301', time: '10:30', care: 'AMB', ref: 'Dr. Correa (Traumatología)', ind: 'Sospecha de lesión de menisco interno', notes: 'Viene con muletas: ayudarlo a subir a la camilla.', tech: null, report: null },
  { dni: '90000009', mod: 'DX', study: '420301', time: '11:00', care: 'AMB', ref: 'Dra. Paredes', ind: 'Gonalgia derecha', notes: null, tech: null, report: null },
  { dni: '90000004', mod: 'CT', study: '341002', time: '11:30', care: 'AMB', ref: 'Dr. Ibáñez', ind: 'Disnea de esfuerzo', notes: 'Marcapasos: por eso TC y no RM. Usa silla de ruedas.', tech: null, report: null },
  { dni: '90000011', mod: 'MR', study: '340102', time: '12:00', care: 'AMB', ref: 'Dra. Castillo', ind: 'Control de adenoma hipofisario', notes: 'Con gadolinio: confirmar creatinina antes de entrar. Ayuno de 4 h.', tech: null, report: null },
  { dni: '90000007', mod: 'DX', study: '420101', time: '12:30', care: 'AMB', ref: 'Medicina laboral', ind: 'Examen preocupacional', notes: 'Preocupacional: entregar el resultado a la empresa.', tech: null, report: null },
];

const DONE = ['delivered', 'reported', 'completed'];

// Hora local del centro (UTC-3) → timestamp UTC de SQLite.
const toUtc = (date, hhmm) => new Date(`${date}T${hhmm}:00-03:00`).toISOString().slice(0, 19).replace('T', ' ');
const plus = (hhmm, min) => fromMinutes(Math.min(23 * 60 + 59, Math.max(0, toMinutes(hhmm) + min)));

// Estado de cada turno según el día: pasado → realizados, hoy → según la
// hora actual, futuro → pendientes.
function statusFor(date, item, index, now) {
  if (date > now.date) return index % 3 === 0 ? 'given' : 'confirmed';
  if (date < now.date) return index === 8 ? 'absent' : DONE[index % 3];
  const diff = toMinutes(now.time) - toMinutes(item.time);
  if (diff > 50) return index === 8 ? 'absent' : DONE[index % 3];
  if (diff > 15) return 'in_progress';
  if (diff > -20) return 'arrived';
  return index % 3 === 0 ? 'given' : 'confirmed';
}

export async function createDemoAppointments(db, date, userId) {
  const now = nowLocal();
  const [{ results: equipment }, { results: studies }, { results: insurances }, tech, radiologist] = await Promise.all([
    db.prepare('SELECT * FROM equipment WHERE active = 1 ORDER BY id').all(),
    db.prepare('SELECT * FROM studies WHERE active = 1').all(),
    db.prepare('SELECT * FROM insurances').all(),
    db.prepare("SELECT id FROM users WHERE role = 'technician' AND active = 1 ORDER BY id LIMIT 1").first(),
    db.prepare("SELECT id FROM users WHERE role = 'radiologist' AND active = 1 ORDER BY id LIMIT 1").first(),
  ]);
  const insuranceId = (code) => insurances.find((i) => i.code === code)?.id ?? null;

  // Pacientes ficticios (se crean una sola vez).
  for (const p of DEMO_PATIENTS) {
    await db
      .prepare(
        `INSERT INTO patients (dni, first_name, last_name, birth_date, sex, phone, insurance_id, affiliate_number, weight_kg, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dni) DO NOTHING`
      )
      .bind(p.dni, p.first_name, p.last_name, p.birth_date, p.sex, `54926100${p.dni.slice(-5)}`, insuranceId(p.insurance), p.affiliate_number, p.weight_kg, p.notes)
      .run();
  }
  const { results: patients } = await db
    .prepare(`SELECT id, dni, insurance_id FROM patients WHERE dni IN (${DEMO_PATIENTS.map(() => '?').join(',')})`)
    .bind(...DEMO_PATIENTS.map((p) => p.dni))
    .all();

  let created = 0;
  let skipped = 0;
  for (const [index, item] of PLAN.entries()) {
    const patient = patients.find((p) => p.dni === item.dni);
    const eq = equipment.find((e) => e.modality === item.mod);
    const study = studies.find((s) => s.code === item.study) || studies.find((s) => s.modality === item.mod);
    if (!patient || !eq || !study) {
      skipped++;
      continue;
    }
    const exists = await db
      .prepare('SELECT 1 FROM appointments WHERE patient_id = ? AND date = ? AND start_time = ?')
      .bind(patient.id, date, item.time)
      .first();
    if (exists) {
      skipped++;
      continue;
    }

    const status = statusFor(date, item, index, now);
    const admitted = ['arrived', 'in_progress', ...DONE].includes(status);
    const started = ['in_progress', ...DONE].includes(status);
    const done = DONE.includes(status);
    const end = plus(item.time, study.duration_minutes);
    const accession = admitted ? await nextAccessionNumber(db, date) : null;

    const row = await db
      .prepare(
        `INSERT INTO appointments (equipment_id, patient_id, study_id, date, start_time, end_time, status, care_type,
          insurance_id, authorization_number, referring_physician, clinical_indication, order_received, notes,
          accession_number, study_instance_uid, pacs_status, image_count, technician_id, technician_notes,
          arrived_at, started_at, completed_at, delivered_at, delivered_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
      )
      .bind(
        eq.id,
        patient.id,
        study.id,
        date,
        item.time,
        end,
        status,
        item.care,
        patient.insurance_id,
        admitted ? `AUT-${date.replace(/-/g, '').slice(2)}${String(index + 1).padStart(2, '0')}` : null,
        item.ref,
        item.ind,
        status === 'given' ? 0 : 1,
        item.notes,
        accession,
        admitted ? newDicomUid() : null,
        done ? 'received' : 'pending',
        done ? (item.mod === 'DX' ? 2 : { MR: 240, CT: 380 }[item.mod] + index * 7) : null,
        started ? tech?.id ?? null : null,
        done ? item.tech : null,
        admitted ? toUtc(date, plus(item.time, -12)) : null,
        started ? toUtc(date, plus(item.time, 4)) : null,
        done ? toUtc(date, plus(item.time, study.duration_minutes + 6)) : null,
        status === 'delivered' ? toUtc(date, plus(item.time, 240)) : null,
        status === 'delivered' ? 'Paciente' : null,
        userId
      )
      .first();

    if (['reported', 'delivered'].includes(status) && item.report) {
      await db
        .prepare(
          `INSERT INTO reports (appointment_id, radiologist_id, technique, findings, conclusion, status, signed_at)
           VALUES (?, ?, ?, ?, ?, 'signed', ?)`
        )
        .bind(row.id, radiologist?.id ?? null, `${study.name}.`, item.report.findings, item.report.conclusion, toUtc(date, plus(item.time, 120)))
        .run();
    } else if (status === 'completed' && item.report) {
      // Un borrador para que el informante tenga algo empezado.
      await db
        .prepare("INSERT INTO reports (appointment_id, radiologist_id, technique, findings, status) VALUES (?, ?, ?, ?, 'draft')")
        .bind(row.id, radiologist?.id ?? null, `${study.name}.`, item.report.findings)
        .run();
    }
    await db
      .prepare("INSERT INTO appointment_events (appointment_id, user_id, action, detail) VALUES (?, ?, 'created', 'Turno de ejemplo')")
      .bind(row.id, userId)
      .run();
    created++;
  }
  return { created, skipped };
}
