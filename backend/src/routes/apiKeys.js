import { Hono } from 'hono';
import { requireAuth, requireRole, userOf } from '../middleware/auth';
import { clean, readJson } from '../utils/http';
import { SCOPES, generateApiKey, hashApiKey, keyPrefixOf, parseScopes } from '../utils/apiKeys';

// Alta, listado y revocación de API keys (solo administrador).
const apiKeys = new Hono();
apiKeys.use('*', requireAuth, requireRole('admin'));

const serialize = (row) => ({
  id: row.id,
  name: row.name,
  key_prefix: row.key_prefix,
  scopes: parseScopes(row.scopes),
  created_by_name: row.created_by_name ?? null,
  created_at: row.created_at,
  last_used_at: row.last_used_at,
  revoked_at: row.revoked_at,
});

apiKeys.get('/scopes', (c) => c.json(SCOPES));

apiKeys.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT k.*, u.name AS created_by_name FROM api_keys k LEFT JOIN users u ON u.id = k.created_by
     ORDER BY k.revoked_at IS NOT NULL, k.created_at DESC`
  ).all();
  return c.json(results.map(serialize));
});

apiKeys.post('/', async (c) => {
  const body = await readJson(c);
  const name = clean(body.name);
  if (!name) return c.json({ error: 'Poné un nombre para identificar la key (ej. "InPatient")' }, 400);
  const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes.filter((s) => s in SCOPES))] : [];
  if (!scopes.length) return c.json({ error: 'Elegí al menos un permiso' }, 400);

  const key = generateApiKey();
  const row = await c.env.DB.prepare(
    'INSERT INTO api_keys (name, key_prefix, key_hash, scopes, created_by) VALUES (?, ?, ?, ?, ?) RETURNING *'
  )
    .bind(name, keyPrefixOf(key), await hashApiKey(key), JSON.stringify(scopes), userOf(c).id)
    .first();
  // La key completa viaja solo en esta respuesta.
  return c.json({ ...serialize(row), key }, 201);
});

// Revocar es inmediato y no se puede deshacer.
apiKeys.delete('/:id', async (c) => {
  const res = await c.env.DB.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL")
    .bind(c.req.param('id'))
    .run();
  if (!res.meta.changes) return c.json({ error: 'API key no encontrada o ya revocada' }, 404);
  return c.body(null, 204);
});

export default apiKeys;
