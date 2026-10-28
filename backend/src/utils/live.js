// Simulación en vivo: hace avanzar los turnos de HOY según la hora real del
// centro, como si recepción, técnicos e informantes trabajaran solos:
//   admisión ~12 min antes → inicio del estudio cuando el equipo se libera →
//   fin (imágenes al PACS) → informe firmado ~45 min después → entrega.
// Cada equipo atiende de a uno (utils/queue.js): los sobreturnos, las
// emergencias y los estudios que se alargan generan demora en esa consola.
// Algún que otro paciente no se presenta, y a lo largo del día entran
// emergencias espontáneas desde la guardia como sobreturno.
// Se activa con settings.demo_live = '1' y corre como mucho cada 15 s,
// disparada por cualquier pedido a la API (el Turnero refresca solo).
import { EMERGENCIES, GENERIC_TECH, STUDY_INFO } from './demo';
import { logEvent } from './agenda';
import { newDicomUid, simulatePacsReception } from './pacs';
import { runQueue, studyRun } from './queue';
import { fromMinutes, nowLocal, toMinutes } from './time';

const EVERY_MS = 15000;
const ADMIT_BEFORE = 12; // minutos antes del turno
const ABSENT_AFTER = 20; // si no vino a los 20 min, ausente
const REPORT_AFTER = 45; // informe firmado tras terminar
const DELIVER_AFTER = 150; // entrega tras terminar
let lastRun = 0;

const toUtc = (date, min) => new Date(`${date}T${fromMinutes(Math.max(0, Math.min(1439, min)))}:00-03:00`).toISOString().slice(0, 19).replace('T', ' ');
const hash = (n) => {
  let h = Math.imul(n ^ 0x5bd1e995, 2654435761);
  h ^= h >>> 13;
  return (Math.imul(h, 1597334677) >>> 0) % 1000;
};

export async function isLiveOn(db) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'demo_live'").first();
  return row?.value === '1';
}

// Llamado desde el middleware: no hace nada si está apagada o si corrió hace poco.
export async function maybeRunLive(db) {
  if (Date.now() - lastRun < EVERY_MS) return;
  lastRun = Date.now();
  if (!(await isLiveOn(db))) return;
  await runLive(db);
}

export async function runLive(db, now = nowLocal()) {
  const date = now.date;
  const t = toMinutes(now.time);
  const tech = await db.prepare("SELECT id FROM users WHERE role = 'technician' AND active = 1 ORDER BY id LIMIT 1").first();
  const radiologist = await db.prepare("SELECT id FROM users WHERE role = 'radiologist' AND active = 1 ORDER BY id LIMIT 1").first();
  const system = (await db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").first())?.id ?? null;

  const emergencies = await addEmergencies(db, date, t, system);

  const { results } = await db
    .prepare(
      `SELECT a.*, s.code AS study_code, s.name AS study_name, s.duration_minutes AS study_minutes, e.modality, i.requires_authorization,
              (SELECT COUNT(*) FROM reports r WHERE r.appointment_id = a.id) AS has_report
       FROM appointments a JOIN studies s ON s.id = a.study_id JOIN equipment e ON e.id = a.equipment_id
       LEFT JOIN insurances i ON i.id = a.insurance_id
       WHERE a.date = ? AND a.status NOT IN ('cancelled', 'absent')`
    )
    .bind(date)
    .all();

  const prefix = date.replace(/-/g, '');
  const last = await db.prepare('SELECT MAX(accession_number) AS n FROM appointments WHERE accession_number LIKE ?').bind(`${prefix}-%`).first();
  let seq = last?.n ? Number(last.n.split('-')[1]) : 0;

  // Horario real de cada estudio, equipo por equipo. Los que no se van a
  // presentar no ocupan el equipo; lo ya registrado (inicio/fin) se respeta.
  const dayStart = Date.parse(`${date}T00:00:00-03:00`);
  const localMin = (ts) => (ts ? Math.round((Date.parse(`${ts.replace(' ', 'T')}Z`) - dayStart) / 60000) : null);
  const noShow = (a) => !a.overbook && hash(a.id) < 55 && (a.status === 'given' || a.status === 'confirmed');
  const real = new Map();
  for (const eqId of new Set(results.map((a) => a.equipment_id))) {
    const items = results
      .filter((a) => a.equipment_id === eqId && !noShow(a))
      .map((a) => ({
        key: a.id,
        s: toMinutes(a.start_time),
        dur: studyRun(a.study_minutes, a.id * 7919).dur,
        urgent: a.care_type === 'GUA',
        overbook: !!a.overbook,
        start: localMin(a.started_at),
        end: localMin(a.completed_at),
      }));
    for (const [k, v] of runQueue(items)) real.set(k, v);
  }

  const stmts = [];
  const counts = { admitted: 0, started: 0, completed: 0, reported: 0, delivered: 0, absent: 0, emergencies };
  for (const a of results) {
    if (a.status === 'delivered') continue;
    const s = toMinutes(a.start_time);
    const urgent = a.care_type === 'GUA';
    let status = a.status;
    const step = (sql, values, action, detail) => {
      stmts.push(db.prepare(`UPDATE appointments SET ${sql}, updated_at = datetime('now') WHERE id = ?`).bind(...values, a.id));
      stmts.push(logEvent(db, a.id, action === 'signed' ? radiologist?.id ?? system : action === 'start' || action === 'complete' ? tech?.id ?? system : system, action, detail));
    };

    if (status === 'given' || status === 'confirmed') {
      if (noShow(a)) {
        if (t >= s + ABSENT_AFTER) {
          step("status = 'absent'", [], 'absent', 'No se presentó (simulación en vivo)');
          counts.absent++;
        }
        continue;
      }
      if (t < s - ADMIT_BEFORE) continue;
      // Admisión: escanea el pedido si faltaba, autorización y N° de acceso.
      const accession = a.accession_number || `${prefix}-${String(++seq).padStart(4, '0')}`;
      const sets = ["status = 'arrived'", 'arrived_at = ?', 'order_received = 1', 'accession_number = ?', 'study_instance_uid = COALESCE(study_instance_uid, ?)'];
      const values = [toUtc(date, urgent ? s - 2 : s - ADMIT_BEFORE), accession, newDicomUid()];
      if (!a.order_code) {
        sets.push('order_date = ?', 'order_physician_license = ?', 'order_code = ?', 'order_observations = ?');
        values.push(date, `MP ${10000 + (a.id % 9000)}`, `${a.study_code} x1`, `Solicito ${a.study_name}. ${a.clinical_indication || ''}`.trim());
      }
      if (a.requires_authorization && !a.authorization_number) {
        sets.push('authorization_number = ?');
        values.push(`AUT-${prefix.slice(2)}${String(a.id % 1000).padStart(3, '0')}`);
      }
      step(sets.join(', '), values, 'admit', `N° de acceso ${accession}`);
      status = 'arrived';
      counts.admitted++;
    }
    const { start: rs, end: e } = real.get(a.id);
    if (status === 'arrived' && t >= rs) {
      step("status = 'in_progress', started_at = ?, technician_id = ?", [toUtc(date, rs), tech?.id ?? null], 'start', rs > s + 4 ? `Demora ${rs - s} min` : null);
      status = 'in_progress';
      counts.started++;
    }
    if (status === 'in_progress' && t >= e) {
      const sim = simulatePacsReception(a.modality);
      const incident = studyRun(a.study_minutes, a.id * 7919).incident;
      const note =
        a.technician_notes ||
        [urgent ? 'Estudio urgente de guardia; informe preliminar comunicado al médico de guardia.' : GENERIC_TECH[a.modality]?.[a.id % 3], incident && `Se demoró ${incident.minutes} min: ${incident.why}.`]
          .filter(Boolean)
          .join(' ') ||
        null;
      step(
        "status = 'completed', completed_at = ?, pacs_status = ?, image_count = ?, technician_notes = ?",
        [toUtc(date, e), sim.pacs_status, sim.image_count, note],
        'complete',
        `PACS (simulado): ${sim.image_count} imágenes recibidas`
      );
      status = 'completed';
      counts.completed++;
    }
    if (status === 'completed' && t >= e + (urgent ? 15 : REPORT_AFTER)) {
      const info = STUDY_INFO[a.study_code]?.report || { findings: 'Sin hallazgos significativos.', conclusion: 'Estudio sin alteraciones.' };
      const signedAt = toUtc(date, e + (urgent ? 15 : REPORT_AFTER));
      if (a.has_report) {
        stmts.push(
          db
            .prepare("UPDATE reports SET status = 'signed', signed_at = ?, radiologist_id = ?, conclusion = COALESCE(conclusion, ?), updated_at = datetime('now') WHERE appointment_id = ?")
            .bind(signedAt, radiologist?.id ?? null, info.conclusion, a.id)
        );
      } else {
        stmts.push(
          db
            .prepare("INSERT INTO reports (appointment_id, radiologist_id, technique, findings, conclusion, status, signed_at) VALUES (?, ?, ?, ?, ?, 'signed', ?)")
            .bind(a.id, radiologist?.id ?? null, `${a.study_name}.`, info.findings, info.conclusion, signedAt)
        );
      }
      step("status = 'reported'", [], 'signed', 'Informe firmado');
      status = 'reported';
      counts.reported++;
    }
    if (status === 'reported' && !urgent && t >= e + DELIVER_AFTER) {
      step("status = 'delivered', delivered_at = ?, delivered_to = 'Paciente'", [toUtc(date, e + DELIVER_AFTER)], 'deliver', 'Retiró: Paciente');
      counts.delivered++;
    }
  }

  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  return counts;
}

// Emergencias espontáneas: en cada hora de atención (8 a 19) hay ~40 % de
// chance de que llegue una desde la guardia, a un minuto fijo de esa hora.
// Se crean cuando llega ese minuto (si la simulación está corriendo), una sola vez.
async function addEmergencies(db, date, t, userId) {
  const day = Number(date.replace(/-/g, ''));
  const due = [];
  for (let h = 8; h < 20; h++) {
    const r = hash(day * 31 + h);
    if (r >= 400) continue;
    const min = h * 60 + 5 + (r % 50);
    // Solo las recientes: las de antes ya las cargó el generador de ejemplo.
    if (min <= t && min >= t - 15) due.push({ min, em: EMERGENCIES[r % EMERGENCIES.length] });
  }
  if (!due.length) return 0;

  let created = 0;
  for (const { min, em } of due) {
    const start = fromMinutes(min);
    const exists = await db
      .prepare("SELECT 1 FROM appointments WHERE date = ? AND start_time = ? AND care_type = 'GUA' AND overbook = 1 AND notes LIKE 'EMERGENCIA EN VIVO%'")
      .bind(date, start)
      .first();
    if (exists) continue;
    const study = await db.prepare('SELECT id, name, duration_minutes FROM studies WHERE code = ?').bind(em.study).first();
    const eq = await db
      .prepare('SELECT id FROM equipment WHERE modality = ? AND active = 1 ORDER BY (SELECT COUNT(*) FROM appointments WHERE equipment_id = equipment.id AND date = ? AND overbook = 1), id LIMIT 1')
      .bind(em.mod, date)
      .first();
    // Paciente sin turno hoy (preferentemente de relleno, ficticio).
    const patient = await db
      .prepare(
        `SELECT id, insurance_id FROM patients WHERE id NOT IN (SELECT patient_id FROM appointments WHERE date = ?)
         ORDER BY (dni LIKE '903%') DESC, (id * 7919 + ?) % 1009 LIMIT 1`
      )
      .bind(date, min)
      .first();
    if (!study || !eq || !patient) continue;
    const ref = `Guardia (Dr. ${['Rossi', 'Funes', 'Lagos', 'Videla'][min % 4]})`;
    await db
      .prepare(
        `INSERT INTO appointments (equipment_id, patient_id, study_id, date, start_time, end_time, status, overbook, care_type, insurance_id,
          referring_physician, clinical_indication, order_received, notes, created_by, order_date, order_physician_license, order_code, order_observations)
         VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 1, 'GUA', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        eq.id,
        patient.id,
        study.id,
        date,
        start,
        fromMinutes(Math.min(1439, min + study.duration_minutes)),
        patient.insurance_id,
        ref,
        em.ind,
        `EMERGENCIA EN VIVO desde guardia (${em.why}). Sin turno previo: atender como sobreturno, prioridad.`,
        userId,
        date,
        `MP ${20000 + (min % 9000)}`,
        `${em.study} x1`,
        `Pedido de guardia: ${study.name} URGENTE. ${em.ind}.`
      )
      .run();
    await db
      .prepare("INSERT INTO appointment_events (appointment_id, user_id, action, detail) SELECT id, ?, 'created', 'Emergencia espontánea (simulación en vivo)' FROM appointments WHERE date = ? AND start_time = ? AND care_type = 'GUA' AND notes LIKE 'EMERGENCIA EN VIVO%'")
      .bind(userId, date, start)
      .run();
    created++;
  }
  return created;
}
