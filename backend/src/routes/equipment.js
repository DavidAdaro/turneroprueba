import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { buildUpdate, clean, readJson, toBool, toInt } from '../utils/http';
import { isTime, toMinutes } from '../utils/time';

export const MODALITIES = {
  MR: 'Resonancia magnética',
  CT: 'Tomografía computada',
  US: 'Ecografía',
  DX: 'Radiología digital',
  MG: 'Mamografía',
  NM: 'Medicina nuclear',
  XA: 'Angiografía',
  DXA: 'Densitometría',
};

const equipment = new Hono();
equipment.use('*', requireAuth);

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const toColor = (v) => (COLOR_RE.test(v || '') ? v : '#2563eb');
const toModality = (v) => (v && MODALITIES[String(v).toUpperCase()] ? String(v).toUpperCase() : null);

equipment.get('/modalities', (c) => c.json(MODALITIES));

equipment.get('/', async (c) => {
  const db = c.env.DB;
  const [{ results: rows }, { results: schedules }] = await Promise.all([
    db.prepare('SELECT * FROM equipment ORDER BY active DESC, modality, name').all(),
    db.prepare('SELECT * FROM schedules ORDER BY weekday, start_time').all(),
  ]);
  return c.json(rows.map((e) => ({ ...e, schedules: schedules.filter((s) => s.equipment_id === e.id) })));
});

equipment.post('/', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  const name = clean(body.name);
  const modality = toModality(body.modality);
  if (!name || !modality) return c.json({ error: 'Nombre y modalidad son obligatorios' }, 400);
  const row = await c.env.DB.prepare(
    'INSERT INTO equipment (name, modality, ae_title, location, color, active) VALUES (?, ?, ?, ?, ?, 1) RETURNING *'
  )
    .bind(name, modality, clean(body.ae_title), clean(body.location), toColor(body.color))
    .first();
  return c.json({ ...row, schedules: [] }, 201);
});

equipment.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await readJson(c);
  if ('name' in body && !clean(body.name)) return c.json({ error: 'El nombre es obligatorio' }, 400);
  if ('modality' in body && !toModality(body.modality)) return c.json({ error: 'Modalidad inválida' }, 400);
  const upd = buildUpdate(
    'equipment',
    { name: clean, modality: toModality, ae_title: clean, location: clean, color: toColor, active: toBool },
    body,
    id
  );
  if (upd) await c.env.DB.prepare(upd.sql).bind(...upd.values).run();
  const row = await c.env.DB.prepare('SELECT * FROM equipment WHERE id = ?').bind(id).first();
  return row ? c.json(row) : c.json({ error: 'Equipo no encontrado' }, 404);
});

// ---- Horarios de atención ----

equipment.post('/:id/schedules', requireRole('admin'), async (c) => {
  const equipmentId = Number(c.req.param('id'));
  const body = await readJson(c);
  const weekday = toInt(body.weekday);
  const slot = toInt(body.slot_minutes);
  if (weekday === null || weekday < 0 || weekday > 6) return c.json({ error: 'Día de la semana inválido' }, 400);
  if (!isTime(body.start_time) || !isTime(body.end_time)) return c.json({ error: 'Horario inválido (HH:MM)' }, 400);
  const s = toMinutes(body.start_time);
  const e = toMinutes(body.end_time);
  if (e <= s) return c.json({ error: 'La hora de fin debe ser posterior a la de inicio' }, 400);
  if (!slot || slot < 5 || slot > 240) return c.json({ error: 'La duración del turno debe estar entre 5 y 240 minutos' }, 400);

  const { results: same } = await c.env.DB.prepare('SELECT * FROM schedules WHERE equipment_id = ? AND weekday = ?')
    .bind(equipmentId, weekday)
    .all();
  const clash = same.find((x) => s < toMinutes(x.end_time) && toMinutes(x.start_time) < e);
  if (clash) return c.json({ error: `Se superpone con la franja ${clash.start_time}–${clash.end_time}` }, 400);

  const row = await c.env.DB.prepare(
    'INSERT INTO schedules (equipment_id, weekday, start_time, end_time, slot_minutes) VALUES (?, ?, ?, ?, ?) RETURNING *'
  )
    .bind(equipmentId, weekday, body.start_time, body.end_time, slot)
    .first();
  return c.json(row, 201);
});

equipment.delete('/:id/schedules/:scheduleId', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM schedules WHERE id = ? AND equipment_id = ?')
    .bind(c.req.param('scheduleId'), c.req.param('id'))
    .run();
  return c.body(null, 204);
});

export default equipment;
