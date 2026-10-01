import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { clean, readJson, toInt } from '../utils/http';
import { isDate, isTime, toMinutes } from '../utils/time';

// Bloqueos de agenda (vacaciones, licencias, feriados).
const blocks = new Hono();
blocks.use('*', requireAuth);

blocks.get('/', async (c) => {
  const from = c.req.query('from') || '0000-01-01';
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, e.name AS equipment_name FROM schedule_blocks b
     LEFT JOIN equipment e ON e.id = b.equipment_id
     WHERE b.end_date >= ? ORDER BY b.start_date`
  )
    .bind(from)
    .all();
  return c.json(results);
});

blocks.post('/', requireRole('admin', 'reception'), async (c) => {
  const body = await readJson(c);
  if (!isDate(body.start_date) || !isDate(body.end_date)) return c.json({ error: 'Fechas inválidas' }, 400);
  if (body.end_date < body.start_date) return c.json({ error: 'La fecha de fin debe ser igual o posterior a la de inicio' }, 400);
  const hasTimes = body.start_time || body.end_time;
  if (hasTimes) {
    if (!isTime(body.start_time) || !isTime(body.end_time)) return c.json({ error: 'Horario inválido (HH:MM)' }, 400);
    if (toMinutes(body.end_time) <= toMinutes(body.start_time)) return c.json({ error: 'La hora de fin debe ser posterior a la de inicio' }, 400);
  }
  const db = c.env.DB;
  const equipmentId = toInt(body.equipment_id);

  // Avisar cuántos turnos activos quedan dentro del bloqueo para reprogramarlos.
  const row = await db
    .prepare(
      `INSERT INTO schedule_blocks (equipment_id, start_date, end_date, start_time, end_time, reason)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(equipmentId, body.start_date, body.end_date, hasTimes ? body.start_time : null, hasTimes ? body.end_time : null, clean(body.reason))
    .first();

  let sql = `SELECT COUNT(*) AS n FROM appointments WHERE date BETWEEN ? AND ? AND status NOT IN ('cancelled','absent','completed','reported','delivered')`;
  const params = [body.start_date, body.end_date];
  if (equipmentId) {
    sql += ' AND equipment_id = ?';
    params.push(equipmentId);
  }
  if (hasTimes) {
    sql += ' AND start_time < ? AND end_time > ?';
    params.push(body.end_time, body.start_time);
  }
  const { n } = await db.prepare(sql).bind(...params).first();
  return c.json({ ...row, affected_appointments: n }, 201);
});

blocks.delete('/:id', requireRole('admin', 'reception'), async (c) => {
  await c.env.DB.prepare('DELETE FROM schedule_blocks WHERE id = ?').bind(c.req.param('id')).run();
  return c.body(null, 204);
});

export default blocks;
