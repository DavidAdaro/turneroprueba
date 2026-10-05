import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { buildUpdate, clean, readJson, toInt } from '../utils/http';
import { isDate } from '../utils/time';
import { normText, sqlNorm } from '../utils/search';

const patients = new Hono();
patients.use('*', requireAuth);

const SELECT = `SELECT p.*, i.name AS insurance_name FROM patients p LEFT JOIN insurances i ON i.id = p.insurance_id`;
const normDni = (v) => String(v || '').replace(/\D/g, '');

const FIELDS = {
  first_name: clean,
  last_name: clean,
  birth_date: (v) => (isDate(v) ? v : null),
  sex: (v) => (['F', 'M', 'O'].includes(v) ? v : null),
  phone: clean,
  email: clean,
  insurance_id: toInt,
  insurance_plan: clean,
  affiliate_number: clean,
  weight_kg: (v) => (Number(v) > 0 ? Number(v) : null),
  notes: clean,
};

// Búsqueda por DNI, apellido o nombre.
patients.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const limit = Math.min(toInt(c.req.query('limit')) || 50, 200);
  if (!q) {
    const { results } = await c.env.DB.prepare(`${SELECT} ORDER BY p.created_at DESC LIMIT ?`).bind(limit).all();
    return c.json(results);
  }
  const dni = normDni(q);
  const like = `%${normText(q)}%`;
  const { results } = await c.env.DB.prepare(
    `${SELECT} WHERE (? != '' AND p.dni LIKE ?) OR ${sqlNorm("p.last_name || ' ' || p.first_name")} LIKE ? OR ${sqlNorm("p.first_name || ' ' || p.last_name")} LIKE ?
     ORDER BY p.last_name, p.first_name LIMIT ?`
  )
    .bind(dni, `${dni}%`, like, like, limit)
    .all();
  return c.json(results);
});

patients.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`${SELECT} WHERE p.id = ?`).bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Paciente no encontrado' }, 404);
  const { results: appointments } = await c.env.DB.prepare(
    `SELECT a.*, e.name AS equipment_name, e.modality, s.name AS study_name, r.status AS report_status
     FROM appointments a JOIN equipment e ON e.id = a.equipment_id JOIN studies s ON s.id = a.study_id
     LEFT JOIN reports r ON r.appointment_id = a.id
     WHERE a.patient_id = ? ORDER BY a.date DESC, a.start_time DESC`
  )
    .bind(row.id)
    .all();
  const stats = {
    total: appointments.length,
    done: appointments.filter((a) => ['completed', 'reported', 'delivered'].includes(a.status)).length,
    absent: appointments.filter((a) => a.status === 'absent').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
  };
  return c.json({ ...row, appointments, stats });
});

patients.post('/', requireRole('admin', 'reception', 'technician'), async (c) => {
  const body = await readJson(c);
  const dni = normDni(body.dni);
  if (dni.length < 6) return c.json({ error: 'DNI inválido' }, 400);
  if (!clean(body.first_name) || !clean(body.last_name)) return c.json({ error: 'Nombre y apellido son obligatorios' }, 400);
  const exists = await c.env.DB.prepare('SELECT id FROM patients WHERE dni = ?').bind(dni).first();
  if (exists) return c.json({ error: 'Ya existe un paciente con ese DNI', patient_id: exists.id }, 409);
  const cols = Object.keys(FIELDS);
  const row = await c.env.DB.prepare(
    `INSERT INTO patients (dni, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')}) RETURNING id`
  )
    .bind(dni, ...cols.map((k) => FIELDS[k](body[k])))
    .first();
  return c.json(await c.env.DB.prepare(`${SELECT} WHERE p.id = ?`).bind(row.id).first(), 201);
});

patients.put('/:id', requireRole('admin', 'reception', 'technician'), async (c) => {
  const id = c.req.param('id');
  const body = await readJson(c);
  if (('first_name' in body && !clean(body.first_name)) || ('last_name' in body && !clean(body.last_name))) {
    return c.json({ error: 'Nombre y apellido son obligatorios' }, 400);
  }
  if ('dni' in body) {
    const dni = normDni(body.dni);
    if (dni.length < 6) return c.json({ error: 'DNI inválido' }, 400);
    const other = await c.env.DB.prepare('SELECT id FROM patients WHERE dni = ? AND id != ?').bind(dni, id).first();
    if (other) return c.json({ error: 'Ya existe otro paciente con ese DNI' }, 409);
    await c.env.DB.prepare('UPDATE patients SET dni = ? WHERE id = ?').bind(dni, id).run();
  }
  const upd = buildUpdate('patients', FIELDS, body, id);
  if (upd) await c.env.DB.prepare(upd.sql).bind(...upd.values).run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE p.id = ?`).bind(id).first();
  return row ? c.json(row) : c.json({ error: 'Paciente no encontrado' }, 404);
});

export default patients;
