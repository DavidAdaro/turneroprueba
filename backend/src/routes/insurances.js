import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { buildUpdate, clean, readJson, toBool } from '../utils/http';

const insurances = new Hono();
insurances.use('*', requireAuth);

insurances.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM insurances ORDER BY active DESC, name').all();
  return c.json(results);
});

insurances.post('/', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  const name = clean(body.name);
  if (!name) return c.json({ error: 'El nombre es obligatorio' }, 400);
  const row = await c.env.DB.prepare(
    'INSERT INTO insurances (name, code, requires_authorization, active) VALUES (?, ?, ?, 1) RETURNING *'
  )
    .bind(name, clean(body.code), toBool(body.requires_authorization))
    .first();
  return c.json(row, 201);
});

insurances.put('/:id', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  if ('name' in body && !clean(body.name)) return c.json({ error: 'El nombre es obligatorio' }, 400);
  const upd = buildUpdate('insurances', { name: clean, code: clean, requires_authorization: toBool, active: toBool }, body, c.req.param('id'));
  if (upd) await c.env.DB.prepare(upd.sql).bind(...upd.values).run();
  const row = await c.env.DB.prepare('SELECT * FROM insurances WHERE id = ?').bind(c.req.param('id')).first();
  return row ? c.json(row) : c.json({ error: 'Obra social no encontrada' }, 404);
});

export default insurances;
