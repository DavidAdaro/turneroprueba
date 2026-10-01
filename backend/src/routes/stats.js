import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { toInt } from '../utils/http';
import { isDate, nowLocal, addDays } from '../utils/time';

const stats = new Hono();
stats.use('*', requireAuth, requireRole('admin', 'reception'));

function range(c) {
  const today = nowLocal().date;
  const from = isDate(c.req.query('from')) ? c.req.query('from') : addDays(today, -30);
  const to = isDate(c.req.query('to')) ? c.req.query('to') : today;
  return { from, to };
}

// Tablero: por estado, por modalidad/equipo, por obra social, tiempos.
stats.get('/', async (c) => {
  const db = c.env.DB;
  const { from, to } = range(c);
  const q = (sql) => db.prepare(sql).bind(from, to).all().then((r) => r.results);
  const [byStatus, byEquipment, byInsurance, byDay, turnaround] = await Promise.all([
    q('SELECT status, COUNT(*) AS n FROM appointments WHERE date BETWEEN ? AND ? GROUP BY status'),
    q(`SELECT e.name, e.modality, COUNT(*) AS total,
         SUM(a.status IN ('completed','reported','delivered')) AS done,
         SUM(a.status = 'absent') AS absent
       FROM appointments a JOIN equipment e ON e.id = a.equipment_id
       WHERE a.date BETWEEN ? AND ? AND a.status != 'cancelled' GROUP BY e.id ORDER BY total DESC`),
    q(`SELECT COALESCE(i.name, 'Sin cobertura') AS name, COUNT(*) AS n
       FROM appointments a LEFT JOIN insurances i ON i.id = a.insurance_id
       WHERE a.date BETWEEN ? AND ? AND a.status IN ('completed','reported','delivered') GROUP BY a.insurance_id ORDER BY n DESC`),
    q(`SELECT date, COUNT(*) AS total, SUM(status IN ('completed','reported','delivered')) AS done
       FROM appointments WHERE date BETWEEN ? AND ? AND status != 'cancelled' GROUP BY date ORDER BY date`),
    q(`SELECT
         AVG((julianday(a.started_at) - julianday(a.arrived_at)) * 1440) AS wait_minutes,
         AVG((julianday(r.signed_at) - julianday(a.completed_at)) * 24) AS report_hours
       FROM appointments a LEFT JOIN reports r ON r.appointment_id = a.id
       WHERE a.date BETWEEN ? AND ?`),
  ]);
  return c.json({ from, to, byStatus, byEquipment, byInsurance, byDay, turnaround: turnaround[0] });
});

// Facturación: estudios realizados en el período con su valor por OS.
stats.get('/billing', async (c) => {
  const { from, to } = range(c);
  const insuranceId = toInt(c.req.query('insurance_id'));
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.date, a.accession_number, a.authorization_number, p.dni, p.last_name, p.first_name, p.affiliate_number,
       s.code AS study_code, s.name AS study_name, e.modality, COALESCE(i.name, 'Particular') AS insurance_name, a.insurance_id,
       COALESCE(sp.price, CASE WHEN a.insurance_id IS NULL THEN s.private_price ELSE 0 END) AS price,
       COALESCE(sp.copay, 0) AS copay, (sp.study_id IS NULL AND a.insurance_id IS NOT NULL) AS missing_price
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN studies s ON s.id = a.study_id
     JOIN equipment e ON e.id = a.equipment_id
     LEFT JOIN insurances i ON i.id = a.insurance_id
     LEFT JOIN study_prices sp ON sp.study_id = a.study_id AND sp.insurance_id = a.insurance_id
     WHERE a.date BETWEEN ? AND ? AND a.status IN ('completed','reported','delivered')
       ${insuranceId ? 'AND a.insurance_id = ?' : ''}
     ORDER BY insurance_name, a.date`
  )
    .bind(from, to, ...(insuranceId ? [insuranceId] : []))
    .all();
  return c.json({ from, to, rows: results });
});

export default stats;
