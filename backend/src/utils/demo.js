import { nextAccessionNumber, newDicomUid } from './pacs';
import { fromMinutes, nowLocal, toMinutes } from './time';
import { canDo, conditionTexts, conditionsForPool, patientNotesFor, zoneOf } from './demoConditions';

// Datos 100 % ficticios para probar el RIS: pacientes (DNI 9000xxxx),
// turnos de RM, TC y Rx con notas, observaciones e informes. Las imágenes
// las genera el visor de demostración a partir de cada turno.
//
// Se generan de a un día (POST /api/demo/appointments) y el frontend recorre
// el rango (3 semanas atrás y 3 adelante). Cada día usa pocas consultas a D1
// (todo en batch) para no pasar el límite por invocación del plan gratuito.

export const DEMO_PATIENTS = [
  { dni: '90000001', first_name: 'Lucía', last_name: 'Benítez', birth_date: '1984-03-12', sex: 'F', insurance: 'OSDE', affiliate_number: '61200001', weight_kg: 62, conditions: ['claustrophobia'], extra: null },
  { dni: '90000002', first_name: 'Martín', last_name: 'Aguirre', birth_date: '1971-07-28', sex: 'M', insurance: 'PAMI', affiliate_number: '150900000201', weight_kg: 94, conditions: ['iodine'], extra: null },
  { dni: '90000003', first_name: 'Sofía', last_name: 'Quiroga', birth_date: '1995-11-02', sex: 'F', insurance: 'SMG', affiliate_number: '80090003', weight_kg: 57, conditions: [], extra: null },
  { dni: '90000004', first_name: 'Ernesto', last_name: 'Villalba', birth_date: '1948-01-19', sex: 'M', insurance: 'PAMI', affiliate_number: '150900000401', weight_kg: 78, conditions: ['pacemaker'], extra: 'Usa silla de ruedas' },
  { dni: '90000005', first_name: 'Carla', last_name: 'Domínguez', birth_date: '1989-05-07', sex: 'F', insurance: 'APROSS', affiliate_number: '0090005', weight_kg: 70, conditions: ['iodine'], extra: 'Embarazo descartado (test negativo)' },
  { dni: '90000006', first_name: 'Raúl', last_name: 'Ferreyra', birth_date: '1963-09-30', sex: 'M', insurance: 'OSDE', affiliate_number: '61200006', weight_kg: 101, conditions: ['dialysis', 'glaucoma'], extra: 'Diabético' },
  { dni: '90000007', first_name: 'Ana Paula', last_name: 'Medina', birth_date: '2001-02-14', sex: 'F', insurance: 'PART', affiliate_number: null, weight_kg: 54, conditions: [], extra: null },
  { dni: '90000008', first_name: 'Jorge', last_name: 'Sosa', birth_date: '1957-12-03', sex: 'M', insurance: 'APROSS', affiliate_number: '0090008', weight_kg: 83, conditions: ['prosthesis'], extra: null },
  { dni: '90000009', first_name: 'Valentina', last_name: 'Ríos', birth_date: '1978-08-21', sex: 'F', insurance: 'SMG', affiliate_number: '80090009', weight_kg: 66, conditions: ['glaucoma'], extra: null },
  { dni: '90000010', first_name: 'Héctor', last_name: 'Luna', birth_date: '1966-04-09', sex: 'M', insurance: 'PAMI', affiliate_number: '150900001001', weight_kg: 88, conditions: ['claustrophobia'], extra: 'Hipoacusia: hablarle de frente' },
  { dni: '90000011', first_name: 'Florencia', last_name: 'Paz', birth_date: '1992-10-25', sex: 'F', insurance: 'OSDE', affiliate_number: '61200011', weight_kg: 60, conditions: ['pacemakerMR'], extra: null },
  { dni: '90000012', first_name: 'Diego', last_name: 'Molina', birth_date: '1986-06-16', sex: 'M', insurance: 'APROSS', affiliate_number: '0090012', weight_kg: 76, conditions: [], extra: 'Lesión deportiva, viene con muletas' },
];

// Plantilla del día. study: código del catálogo del seed. El día de hoy usa
// estos pacientes y notas tal cual; los demás días rotan pacientes del
// padrón generado y notas genéricas.
const PLAN = [
  { dni: '90000001', mod: 'MR', study: '340101', time: '08:00', care: 'AMB', ref: 'Dra. Castillo', ind: 'Cefalea crónica refractaria', notes: 'Acompañante puede entrar.', tech: 'Bobina de cabeza de 32 canales.', report: { findings: 'Parénquima encefálico de señal conservada. Sistema ventricular de tamaño y morfología normales. No se observan lesiones ocupantes de espacio ni áreas de restricción en difusión.', conclusion: 'RM de cerebro sin hallazgos patológicos.' } },
  { dni: '90000003', mod: 'DX', study: '420101', time: '08:10', care: 'AMB', ref: 'Dr. Navarro', ind: 'Tos persistente de 3 semanas', notes: 'Trae radiografía previa de 2024 para comparar.', tech: 'Proyecciones frente y perfil en bipedestación.', report: { findings: 'Campos pulmonares sin infiltrados ni consolidaciones. Senos costofrénicos libres. Silueta cardíaca de tamaño normal.', conclusion: 'Radiografía de tórax sin alteraciones.' } },
  { dni: '90000002', mod: 'CT', study: '341002', time: '08:30', care: 'INT', ref: 'Dr. Ibáñez (Clínica Médica)', ind: 'Control de nódulo pulmonar', notes: 'Internado piso 3, cama 12. Viene en camilla.', tech: 'Cortes de 1 mm.', report: { findings: 'Nódulo sólido de 6 mm en lóbulo superior derecho, sin cambios respecto del estudio previo. No se observan adenomegalias mediastinales.', conclusion: 'Nódulo pulmonar estable. Sugiere control en 12 meses.' } },
  { dni: '90000006', mod: 'CT', study: '341003', time: '09:00', care: 'AMB', ref: 'Dra. Peralta', ind: 'Dolor abdominal en fosa ilíaca derecha', notes: 'Diabético: suspender metformina 48 h después del contraste.', tech: 'Contraste oral 1 h antes.', report: { findings: 'Hígado, bazo y páncreas sin alteraciones. Apéndice cecal de calibre normal. Litiasis renal derecha de 4 mm no obstructiva.', conclusion: 'Litiasis renal derecha no obstructiva. Sin signos de apendicitis.' } },
  { dni: '90000008', mod: 'DX', study: '420201', time: '09:10', care: 'AMB', ref: 'Dr. Correa (Traumatología)', ind: 'Lumbalgia mecánica', notes: null, tech: 'Se repitió la proyección lateral por rotación del paciente.', report: { findings: 'Rectificación de la lordosis lumbar. Disminución del espacio discal L4-L5 con osteofitos marginales.', conclusion: 'Cambios degenerativos lumbares, a predominio L4-L5.' } },
  { dni: '90000005', mod: 'MR', study: '340201', time: '09:30', care: 'AMB', ref: 'Dr. Correa (Traumatología)', ind: 'Lumbociatalgia izquierda', notes: 'Trae CD con RM anterior para comparar.', tech: 'Movimiento leve en secuencia T2 axial; se repitió.', report: { findings: 'Protrusión discal posterocentral L5-S1 que contacta la raíz S1 izquierda. Resto de los discos con señal conservada.', conclusion: 'Protrusión discal L5-S1 con contacto radicular S1 izquierdo.' } },
  { dni: '90000010', mod: 'CT', study: '341001', time: '10:00', care: 'GUA', ref: 'Guardia (Dr. Rossi)', ind: 'Traumatismo de cráneo leve', notes: 'Viene de guardia: prioridad. Hipoacusia, hablarle de frente.', tech: 'TC de cerebro sin contraste.', report: { findings: 'No se observan colecciones hemáticas intra ni extraaxiales. Línea media centrada. Sistema ventricular de tamaño normal.', conclusion: 'TC de cerebro sin lesiones traumáticas agudas.' } },
  { dni: '90000012', mod: 'MR', study: '340301', time: '10:30', care: 'AMB', ref: 'Dr. Correa (Traumatología)', ind: 'Sospecha de lesión de menisco interno', notes: 'Viene con muletas: ayudarlo a subir a la camilla.', tech: 'Bobina de rodilla, secuencias de rutina.', report: { findings: 'Señal lineal en el cuerno posterior del menisco interno que contacta la superficie articular inferior. Ligamentos cruzados indemnes. Leve derrame articular.', conclusion: 'Ruptura del cuerno posterior del menisco interno.' } },
  { dni: '90000009', mod: 'DX', study: '420301', time: '11:00', care: 'AMB', ref: 'Dra. Paredes', ind: 'Gonalgia derecha', notes: null, tech: 'Frente y perfil con carga.', report: { findings: 'Leve disminución del espacio articular femorotibial interno. Sin lesiones óseas agudas.', conclusion: 'Gonartrosis incipiente.' } },
  { dni: '90000004', mod: 'CT', study: '341002', time: '11:30', care: 'AMB', ref: 'Dr. Ibáñez', ind: 'Disnea de esfuerzo', notes: 'Usa silla de ruedas: asistir en la transferencia.', tech: 'Paciente trasladado con tabla de transferencia.', report: { findings: 'Parénquima pulmonar sin consolidaciones. Leve aumento del índice cardiotorácico. Sin derrame pleural.', conclusion: 'Leve cardiomegalia. Sin hallazgos pulmonares agudos.' } },
  { dni: '90000011', mod: 'MR', study: '340102', time: '12:00', care: 'AMB', ref: 'Dra. Castillo', ind: 'Control de adenoma hipofisario', notes: 'Ayuno de 4 h. Confirmar creatinina antes de entrar.', tech: 'Gadolinio macrocíclico 7 ml.', report: { findings: 'Hipófisis de altura conservada con lesión hipocaptante de 5 mm en el lóbulo derecho, sin cambios respecto del control previo. Tallo hipofisario centrado.', conclusion: 'Microadenoma hipofisario estable.' } },
  { dni: '90000007', mod: 'DX', study: '420101', time: '12:30', care: 'AMB', ref: 'Medicina laboral', ind: 'Examen preocupacional', notes: 'Preocupacional: entregar el resultado a la empresa.', tech: 'Proyección PA en inspiración.', report: { findings: 'Campos pulmonares claros. Silueta cardíaca de tamaño normal. Estructuras óseas sin alteraciones.', conclusion: 'Radiografía de tórax normal.' } },
];

// Padrón de pacientes inventados para el resto de los días (DNI 90001000+).
const FIRST_F = ['María', 'Laura', 'Silvia', 'Paula', 'Gabriela', 'Natalia', 'Mónica', 'Romina', 'Julieta', 'Camila', 'Andrea', 'Verónica', 'Cecilia', 'Mariela', 'Agustina'];
const FIRST_M = ['Juan', 'Carlos', 'Luis', 'Pablo', 'Sergio', 'Gustavo', 'Marcelo', 'Fernando', 'Nicolás', 'Matías', 'Ricardo', 'Alberto', 'Eduardo', 'Federico', 'Tomás'];
const LAST = ['Gómez', 'Rodríguez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Romero', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Rojas', 'Herrera', 'Suárez', 'Ortiz', 'Ponce', 'Vega', 'Cabrera', 'Godoy', 'Arias'];
const PATIENT_NOTES = [null, null, null, null, 'Hipertenso', 'Alergia a la penicilina', null, 'Usa audífonos', 'Diabético tipo 2', 'Movilidad reducida: usa bastón', null, null, null];
const POOL_SIZE = 100;

export const GENERATED_PATIENTS = Array.from({ length: POOL_SIZE }, (_, i) => {
  const female = i % 2 === 0;
  const year = 1945 + ((i * 7) % 61);
  const insurance = year < 1960 ? 'PAMI' : ['OSDE', 'SMG', 'APROSS', 'PART', 'APROSS'][i % 5];
  return {
    dni: String(90001000 + i),
    first_name: (female ? FIRST_F : FIRST_M)[(i * 3) % 15],
    last_name: LAST[(i * 11) % LAST.length],
    birth_date: `${year}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    sex: female ? 'F' : 'M',
    insurance,
    affiliate_number: insurance === 'PART' ? null : String(70000000 + i * 37),
    weight_kg: 50 + ((i * 13) % 45),
    conditions: conditionsForPool(i),
    extra: PATIENT_NOTES[i % PATIENT_NOTES.length],
  };
});

const GENERIC_NOTES = [
  null,
  'Trae estudios previos en CD.',
  'Confirmó por WhatsApp.',
  'Solicita turno temprano por trabajo.',
  null,
  'Viene acompañado por un familiar.',
  'Pidió factura a nombre de la empresa.',
  'Recordar traer la orden original firmada.',
  null,
  'Control evolutivo: comparar con estudio anterior.',
];
// Estudios de las otras especialidades (ecografía y mamografía). sex: solo
// para pacientes de ese sexo.
const EXTRA_PLAN = [
  { mod: 'US', study: '180101', time: '08:20', care: 'AMB', ref: 'Dra. Peralta', ind: 'Dolor en hipocondrio derecho', notes: null, tech: null, report: { findings: 'Hígado de tamaño y ecoestructura conservados. Vesícula alitiásica de paredes finas. Vía biliar no dilatada. Bazo y páncreas sin alteraciones.', conclusion: 'Ecografía abdominal dentro de límites normales.' } },
  { mod: 'US', study: '180201', time: '15:20', care: 'AMB', ref: 'Dra. Castillo', ind: 'Control de nódulo tiroideo', notes: null, tech: null, report: { findings: 'Glándula tiroides de tamaño normal. Nódulo isoecoico de 6 mm en lóbulo derecho, de bordes regulares, sin calcificaciones.', conclusion: 'Nódulo tiroideo de aspecto benigno (TI-RADS 2).' } },
  { mod: 'US', study: '180301', time: '11:20', care: 'AMB', ref: 'Dra. Paredes', ind: 'Control ginecológico anual', notes: null, tech: null, sex: 'F', report: { findings: 'Útero en anteversión de tamaño normal. Endometrio lineal de 7 mm. Ambos ovarios de tamaño y morfología conservados.', conclusion: 'Ecografía ginecológica normal.' } },
  { mod: 'MG', study: '430101', time: '09:40', care: 'AMB', ref: 'Dra. Paredes', ind: 'Control mamario anual', notes: null, tech: null, sex: 'F', report: { findings: 'Mamas de densidad tipo B. No se observan nódulos, microcalcificaciones sospechosas ni distorsiones de la arquitectura.', conclusion: 'BI-RADS 1. Control anual.' } },
];

const GENERIC_TECH = {
  MR: ['Protocolo completo sin incidencias.', 'Paciente colaborador, sin artefactos de movimiento.', 'Se agregó secuencia adicional a pedido del médico.'],
  CT: ['Adquisición sin incidencias.', 'Cortes finos con reconstrucciones multiplanares.', 'Paciente colaborador.'],
  DX: ['Proyecciones de rutina sin repeticiones.', 'Se repitió una proyección por movimiento.', 'Paciente en bipedestación.'],
  US: ['Estudio con transductor convexo de 3,5 MHz.', 'Buena ventana acústica.', 'Ventana acústica limitada por gas intestinal.'],
  MG: ['Proyecciones CC y MLO bilaterales.', 'Compresión bien tolerada.', 'Se agregó proyección magnificada.'],
};

// Pacientes propios para la demo (backend/demo-patients.local.json, cargado
// por npm run setup en settings.demo_pool). Si existen, la demo usa SOLO
// esos pacientes y el frontend genera solo días pasados.
export async function loadDemoPool(db) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'demo_pool'").first();
  try {
    const pool = JSON.parse(row?.value || 'null');
    return Array.isArray(pool) && pool.length ? pool.map((p) => ({ ...p, conditions: p.conditions || [] })) : null;
  } catch {
    return null;
  }
}

// 2 o 3 turnos por día con los pacientes propios, cada uno a lo sumo una vez
// por día, en cualquier especialidad compatible (sexo, marcapasos → no RM).
function poolItems(pool, offset, weekday) {
  const all = [...PLAN, ...EXTRA_PLAN];
  const want = 2 + (mix(offset + 500, 1) % 2);
  const used = new Set();
  const items = [];
  for (let n = 0; n < all.length * 3 && items.length < want; n++) {
    const index = mix(offset + 700, n) % all.length;
    const item = all[index];
    if (weekday === 6 && item.mod !== 'DX') continue;
    if (items.some((x) => x.item.time === item.time)) continue;
    const candidates = pool.filter((p) => !used.has(p.dni) && canDo(p.conditions, item.mod) && (!item.sex || item.sex === p.sex));
    if (!candidates.length) continue;
    const patient = candidates[mix(offset + 900, n) % candidates.length];
    used.add(patient.dni);
    items.push({
      index,
      r: mix(offset + 7, index + 300),
      item,
      patient,
      notes: GENERIC_NOTES[mix(offset, index + 50) % GENERIC_NOTES.length],
      tech: GENERIC_TECH[item.mod][mix(offset, index + 90) % 3],
    });
  }
  return items;
}

const DONE = ['delivered', 'reported', 'completed'];

// Hora local del centro (UTC-3) → timestamp UTC de SQLite.
const toUtc = (date, hhmm) => new Date(`${date}T${hhmm}:00-03:00`).toISOString().slice(0, 19).replace('T', ' ');
const plus = (hhmm, min) => fromMinutes(Math.min(23 * 60 + 59, Math.max(0, toMinutes(hhmm) + min)));
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const mix = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 1597334677);
  h ^= h >>> 15;
  return (Math.imul(h, 2246822519) >>> 0) % 1000;
};

// Estado de cada turno según el día: pasado → realizados (algún ausente o
// cancelado), hoy → según la hora actual, futuro → pendientes.
function statusFor(date, item, index, now, r) {
  if (date > now.date) return r < 350 ? 'given' : 'confirmed';
  const diff = date < now.date ? Infinity : toMinutes(now.time) - toMinutes(item.time);
  if (diff > 50) {
    if (r < 60) return 'absent';
    if (r < 90) return 'cancelled';
    // Lo de hace más de 2 días ya está informado o entregado.
    if (daysBetween(date, now.date) > 2) return r < 600 ? 'delivered' : 'reported';
    return DONE[index % 3];
  }
  if (diff > 15) return 'in_progress';
  if (diff > -20) return 'arrived';
  return r < 350 ? 'given' : 'confirmed';
}

export async function createDemoAppointments(db, date, userId) {
  const now = nowLocal();
  const offset = daysBetween(now.date, date);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return { created: 0, skipped: 0 }; // domingo: cerrado

  const [{ results: equipment }, { results: studies }, { results: insurances }, tech, radiologist] = await Promise.all([
    db.prepare('SELECT * FROM equipment WHERE active = 1 ORDER BY id').all(),
    db.prepare('SELECT * FROM studies WHERE active = 1').all(),
    db.prepare('SELECT * FROM insurances').all(),
    db.prepare("SELECT id FROM users WHERE role = 'technician' AND active = 1 ORDER BY id LIMIT 1").first(),
    db.prepare("SELECT id FROM users WHERE role = 'radiologist' AND active = 1 ORDER BY id LIMIT 1").first(),
  ]);
  const insuranceId = (code) => insurances.find((i) => i.code === code)?.id ?? null;

  // Turnos del día: con pacientes propios, poolItems; si no, hoy la
  // plantilla completa y otros días ~75 % de los horarios con pacientes
  // rotados. Sábado solo rayos.
  const pool = await loadDemoPool(db);
  const items = pool ? poolItems(pool, offset, weekday) : [];
  for (const [index, item] of pool ? [] : PLAN.entries()) {
    const r = mix(offset + 1000, index);
    if (weekday === 6 && item.mod !== 'DX') continue;
    if (offset !== 0 && r < 250) continue;
    let patient = DEMO_PATIENTS.find((p) => p.dni === item.dni);
    if (offset !== 0) {
      // Rota el padrón; saltea pacientes que no pueden hacer el estudio (marcapasos → RM).
      let k = (offset * 17 + index * 29 + 1000 * POOL_SIZE) % POOL_SIZE;
      while (!canDo(GENERATED_PATIENTS[k].conditions, item.mod)) k = (k + 1) % POOL_SIZE;
      patient = GENERATED_PATIENTS[k];
    }
    items.push({
      index,
      r: mix(offset + 7, index + 300), // independiente del que decide si hay turno
      item,
      patient,
      notes: offset === 0 ? item.notes : GENERIC_NOTES[mix(offset, index + 50) % GENERIC_NOTES.length],
      tech: offset === 0 ? item.tech : GENERIC_TECH[item.mod][mix(offset, index + 90) % 3],
    });
  }
  if (!items.length) return { created: 0, skipped: 0 };

  // Pacientes (se crean una sola vez).
  const people = [...new Map(items.map((x) => [x.patient.dni, x.patient])).values()];
  await db.batch(
    people.map((p) =>
      db
        .prepare(
          `INSERT INTO patients (dni, first_name, last_name, birth_date, sex, phone, insurance_id, affiliate_number, weight_kg, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dni) DO NOTHING`
        )
        .bind(p.dni, p.first_name, p.last_name, p.birth_date, p.sex, `5492610${p.dni.slice(-6)}`, insuranceId(p.insurance), p.affiliate_number, p.weight_kg, patientNotesFor(p.conditions, p.extra))
    )
  );
  const dnis = people.map((p) => p.dni);
  const [{ results: patients }, { results: existing }, firstAccession] = await Promise.all([
    db.prepare(`SELECT id, dni, insurance_id FROM patients WHERE dni IN (${dnis.map(() => '?').join(',')})`).bind(...dnis).all(),
    db.prepare("SELECT patient_id, equipment_id, start_time, end_time FROM appointments WHERE date = ? AND status != 'cancelled'").bind(date).all(),
    nextAccessionNumber(db, date),
  ]);
  const [prefix, firstSeq] = firstAccession.split('-');
  let seq = Number(firstSeq);

  const stmts = [];
  let created = 0;
  let skipped = 0;
  for (const { index, r, item, patient: p, notes, tech: techNotes } of items) {
    const patient = patients.find((x) => x.dni === p.dni);
    // Reparte entre los equipos de esa modalidad (equipo 1, 2, …).
    const sameMod = equipment.filter((e) => e.modality === item.mod);
    const eq = sameMod.length ? sameMod[mix(offset + 41, index + 3) % sameMod.length] : null;
    const study = studies.find((x) => x.code === item.study) || studies.find((x) => x.modality === item.mod);
    // Datos mínimos para poder dar el turno.
    if (!patient || !eq || !study) {
      skipped++;
      continue;
    }
    let time = item.time;
    if (pool) {
      // Con pacientes propios se SUMAN turnos a lo que ya haya: si el
      // horario del equipo está ocupado se busca el siguiente libre (de a
      // 10 min). Un paciente no repite turno en el mismo día.
      const dur = study.duration_minutes;
      const clash = (t) =>
        existing.some((e) => e.equipment_id === eq.id && toMinutes(e.start_time) < toMinutes(t) + dur && toMinutes(t) < toMinutes(e.end_time));
      for (let k = 0; k < 60 && clash(time); k++) time = plus(time, 10);
      if (existing.some((e) => e.patient_id === patient.id) || clash(time) || toMinutes(time) + dur > 20 * 60) {
        skipped++;
        continue;
      }
      existing.push({ patient_id: patient.id, equipment_id: eq.id, start_time: time, end_time: plus(time, dur) });
    } else if (existing.some((e) => e.patient_id === patient.id || e.start_time === item.time)) {
      // No duplicar: mismo paciente u horario ocupado.
      skipped++;
      continue;
    }

    const status = statusFor(date, { ...item, time }, index, now, r);
    const cond = conditionTexts(p.conditions, { mod: item.mod, contrast: !!study.contrast, zone: zoneOf(study.name) }, (n) => mix(offset + 31 * index, n));
    const turnNotes = [cond.note, notes].filter(Boolean).join(' ') || null;
    // La observación genérica se reemplaza si la condición trae la suya (para no contradecirse).
    const techText = (cond.tech ? [offset === 0 ? techNotes : null, cond.tech] : [techNotes]).filter(Boolean).join(' ') || null;
    const findings = item.report ? [cond.report, item.report.findings].filter(Boolean).join(' ') : null;
    const admitted = ['arrived', 'in_progress', ...DONE].includes(status);
    const started = ['in_progress', ...DONE].includes(status);
    const done = DONE.includes(status);
    const accession = admitted ? `${prefix}-${String(seq++).padStart(4, '0')}` : null;

    stmts.push(
      db
        .prepare(
          `INSERT INTO appointments (equipment_id, patient_id, study_id, date, start_time, end_time, status, care_type,
            insurance_id, authorization_number, referring_physician, clinical_indication, order_received, notes, cancel_reason,
            accession_number, study_instance_uid, pacs_status, image_count, technician_id, technician_notes,
            arrived_at, started_at, completed_at, delivered_at, delivered_to, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          eq.id,
          patient.id,
          study.id,
          date,
          time,
          plus(time, study.duration_minutes),
          status,
          offset === 0 ? item.care : r % 9 === 0 ? 'INT' : r % 13 === 0 ? 'GUA' : 'AMB',
          patient.insurance_id,
          admitted ? `AUT-${date.replace(/-/g, '').slice(2)}${String(index + 1).padStart(2, '0')}` : null,
          item.ref,
          item.ind,
          status === 'given' ? 0 : 1,
          turnNotes,
          status === 'cancelled' ? 'El paciente reprogramó por teléfono' : null,
          accession,
          admitted ? newDicomUid() : null,
          done ? 'received' : 'pending',
          done ? ({ DX: 2, MG: 4 }[item.mod] ?? { MR: 240, CT: 380, US: 18 }[item.mod] + (r % 60)) : null,
          started ? tech?.id ?? null : null,
          done ? techText : null,
          admitted ? toUtc(date, plus(time, -12)) : null,
          started ? toUtc(date, plus(time, 4)) : null,
          done ? toUtc(date, plus(time, study.duration_minutes + 6)) : null,
          status === 'delivered' ? toUtc(date, plus(time, 300)) : null,
          status === 'delivered' ? 'Paciente' : null,
          userId
        )
    );
    // Informe firmado o borrador, enlazado por N° de acceso.
    if (item.report && ['reported', 'delivered', 'completed'].includes(status)) {
      const signed = status !== 'completed';
      stmts.push(
        db
          .prepare(
            `INSERT INTO reports (appointment_id, radiologist_id, technique, findings, conclusion, status, signed_at)
             SELECT id, ?, ?, ?, ?, ?, ? FROM appointments WHERE accession_number = ?`
          )
          .bind(
            radiologist?.id ?? null,
            `${study.name}.`,
            findings,
            signed ? item.report.conclusion : null,
            signed ? 'signed' : 'draft',
            signed ? toUtc(date, plus(time, 120)) : null,
            accession
          )
      );
    }
    stmts.push(
      db
        .prepare(
          `INSERT INTO appointment_events (appointment_id, user_id, action, detail)
           SELECT id, ?, 'created', 'Turno de ejemplo' FROM appointments WHERE patient_id = ? AND date = ? AND start_time = ?`
        )
        .bind(userId, patient.id, date, time)
    );
    created++;
  }
  if (stmts.length) await db.batch(stmts);
  return { created, skipped };
}
