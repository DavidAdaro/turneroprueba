import { Hono } from 'hono';
import { requireAuth, requireRole, userOf } from '../middleware/auth';
import { clean, readJson, toInt } from '../utils/http';
import { APPOINTMENT_SELECT, logEvent } from '../utils/agenda';

// Informes: el médico informante toma los estudios realizados, redacta y
// firma. Una vez firmado el turno pasa a "reported" y queda para entrega.
const reports = new Hono();
reports.use('*', requireAuth);

const REPORT_SELECT = `SELECT r.*, u.name AS radiologist_name, u.license_number AS radiologist_license
  FROM reports r LEFT JOIN users u ON u.id = r.radiologist_id WHERE r.appointment_id = ?`;

// Lista de trabajo del informante. status: pending (sin informe o en
// borrador) | signed.
reports.get('/worklist', requireRole('admin', 'radiologist'), async (c) => {
  const status = c.req.query('status') === 'signed' ? 'signed' : 'pending';
  const where =
    status === 'signed'
      ? "r.status = 'signed'"
      : "a.status = 'completed' AND (r.id IS NULL OR r.status = 'draft')";
  const params = [];
  let extra = '';
  if (c.req.query('modality')) {
    extra += ' AND e.modality = ?';
    params.push(c.req.query('modality'));
  }
  const order = status === 'signed' ? 'a.completed_at DESC LIMIT 200' : 'a.completed_at ASC';
  const { results } = await c.env.DB.prepare(`${APPOINTMENT_SELECT} WHERE ${where}${extra} ORDER BY ${order}`)
    .bind(...params)
    .all();
  return c.json(results);
});

// Turno + informe + estudios previos del paciente (para comparar).
reports.get('/:appointmentId', async (c) => {
  const db = c.env.DB;
  const id = toInt(c.req.param('appointmentId'));
  const appointment = await db.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).bind(id).first();
  if (!appointment) return c.json({ error: 'Turno no encontrado' }, 404);
  const report = await db.prepare(REPORT_SELECT).bind(id).first();
  const { results: priors } = await db
    .prepare(
      `SELECT a.id, a.date, a.accession_number, a.study_instance_uid, s.name AS study_name, e.modality, r.conclusion, r.status AS report_status
       FROM appointments a JOIN studies s ON s.id = a.study_id JOIN equipment e ON e.id = a.equipment_id
       LEFT JOIN reports r ON r.appointment_id = a.id
       WHERE a.patient_id = ? AND a.id != ? AND a.status IN ('completed','reported','delivered')
       ORDER BY a.date DESC LIMIT 20`
    )
    .bind(appointment.patient_id, id)
    .all();
  return c.json({ appointment, report, priors });
});

// Guardar borrador.
reports.put('/:appointmentId', requireRole('radiologist'), async (c) => {
  const db = c.env.DB;
  const user = userOf(c);
  const id = toInt(c.req.param('appointmentId'));
  const appointment = await db.prepare('SELECT status FROM appointments WHERE id = ?').bind(id).first();
  if (!appointment) return c.json({ error: 'Turno no encontrado' }, 404);
  if (appointment.status !== 'completed') return c.json({ error: 'El estudio no está pendiente de informe' }, 400);
  const existing = await db.prepare('SELECT * FROM reports WHERE appointment_id = ?').bind(id).first();
  if (existing?.status === 'signed') return c.json({ error: 'El informe ya está firmado' }, 400);
  const body = await readJson(c);
  await db
    .prepare(
      `INSERT INTO reports (appointment_id, radiologist_id, technique, findings, conclusion, status, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', datetime('now'))
       ON CONFLICT(appointment_id) DO UPDATE SET radiologist_id = excluded.radiologist_id, technique = excluded.technique,
         findings = excluded.findings, conclusion = excluded.conclusion, updated_at = excluded.updated_at`
    )
    .bind(id, user.id, clean(body.technique), clean(body.findings), clean(body.conclusion))
    .run();
  return c.json(await db.prepare(REPORT_SELECT).bind(id).first());
});

// Firmar: requiere hallazgos y conclusión.
reports.post('/:appointmentId/sign', requireRole('radiologist'), async (c) => {
  const db = c.env.DB;
  const user = userOf(c);
  const id = toInt(c.req.param('appointmentId'));
  const report = await db.prepare('SELECT * FROM reports WHERE appointment_id = ?').bind(id).first();
  const appointment = await db.prepare('SELECT status FROM appointments WHERE id = ?').bind(id).first();
  if (!report || !appointment) return c.json({ error: 'Guardá el informe antes de firmarlo' }, 400);
  if (report.status === 'signed') return c.json({ error: 'El informe ya está firmado' }, 400);
  if (appointment.status !== 'completed') return c.json({ error: 'El estudio no está pendiente de informe' }, 400);
  if (!report.findings || !report.conclusion) return c.json({ error: 'El informe necesita hallazgos y conclusión para firmarse' }, 400);
  await db.batch([
    db
      .prepare("UPDATE reports SET status = 'signed', signed_at = datetime('now'), radiologist_id = ?, updated_at = datetime('now') WHERE appointment_id = ?")
      .bind(user.id, id),
    db.prepare("UPDATE appointments SET status = 'reported', updated_at = datetime('now') WHERE id = ?").bind(id),
    logEvent(db, id, user.id, 'signed', 'Informe firmado'),
  ]);
  return c.json(await db.prepare(REPORT_SELECT).bind(id).first());
});

export default reports;
