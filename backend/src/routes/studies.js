import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { buildUpdate, clean, readJson, toBool, toInt } from '../utils/http';
import { MODALITIES } from './equipment';

// Catálogo de estudios con su valor particular y por obra social.
const studies = new Hono();
studies.use('*', requireAuth);

const toPrice = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const toModality = (v) => (v && MODALITIES[String(v).toUpperCase()] ? String(v).toUpperCase() : null);
const toDuration = (v) => {
  const n = toInt(v);
  return n && n >= 5 && n <= 240 ? n : 20;
};

studies.get('/', async (c) => {
  const db = c.env.DB;
  const [{ results: rows }, { results: prices }] = await Promise.all([
    db.prepare('SELECT * FROM studies ORDER BY active DESC, modality, name').all(),
    db.prepare('SELECT * FROM study_prices').all(),
  ]);
  return c.json(rows.map((s) => ({ ...s, prices: prices.filter((x) => x.study_id === s.id) })));
});

studies.post('/', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  const name = clean(body.name);
  const modality = toModality(body.modality);
  if (!name || !modality) return c.json({ error: 'Nombre y modalidad son obligatorios' }, 400);
  const row = await c.env.DB.prepare(
    `INSERT INTO studies (code, name, modality, duration_minutes, contrast, preparation, private_price, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1) RETURNING *`
  )
    .bind(clean(body.code), name, modality, toDuration(body.duration_minutes), toBool(body.contrast), clean(body.preparation), toPrice(body.private_price))
    .first();
  return c.json({ ...row, prices: [] }, 201);
});

studies.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await readJson(c);
  if ('name' in body && !clean(body.name)) return c.json({ error: 'El nombre es obligatorio' }, 400);
  if ('modality' in body && !toModality(body.modality)) return c.json({ error: 'Modalidad inválida' }, 400);
  const upd = buildUpdate(
    'studies',
    {
      code: clean,
      name: clean,
      modality: toModality,
      duration_minutes: toDuration,
      contrast: toBool,
      preparation: clean,
      private_price: toPrice,
      active: toBool,
    },
    body,
    id
  );
  if (upd) await c.env.DB.prepare(upd.sql).bind(...upd.values).run();
  const row = await c.env.DB.prepare('SELECT * FROM studies WHERE id = ?').bind(id).first();
  return row ? c.json(row) : c.json({ error: 'Estudio no encontrado' }, 404);
});

// Reemplaza los valores por obra social: [{ insurance_id, price, copay }].
studies.put('/:id/prices', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await readJson(c);
  const items = Array.isArray(body.prices) ? body.prices : [];
  const db = c.env.DB;
  const stmts = [db.prepare('DELETE FROM study_prices WHERE study_id = ?').bind(id)];
  for (const it of items) {
    const insuranceId = toInt(it.insurance_id);
    if (!insuranceId) continue;
    stmts.push(
      db
        .prepare('INSERT INTO study_prices (study_id, insurance_id, price, copay) VALUES (?, ?, ?, ?)')
        .bind(id, insuranceId, toPrice(it.price), toPrice(it.copay))
    );
  }
  await db.batch(stmts);
  const { results } = await db.prepare('SELECT * FROM study_prices WHERE study_id = ?').bind(id).all();
  return c.json(results);
});

export default studies;
