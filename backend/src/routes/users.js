import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole, userOf } from '../middleware/auth';
import { clean, readJson, toBool } from '../utils/http';

const ROLES = ['admin', 'reception', 'technician', 'radiologist'];
const users = new Hono();
users.use('*', requireAuth);

const PUBLIC_FIELDS = 'id, name, email, role, license_number, active, created_at';

// Listado reducido (para elegir técnico/informante) disponible para todos.
users.get('/staff', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, role FROM users WHERE active = 1 ORDER BY name").all();
  return c.json(results);
});

users.use('*', requireRole('admin'));

users.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY name`).all();
  return c.json(results);
});

function validate(body, creating) {
  if ((creating || 'name' in body) && !clean(body.name)) return 'El nombre es obligatorio';
  if ((creating || 'email' in body) && !/^\S+@\S+\.\S+$/.test(body.email || '')) return 'Email inválido';
  if ((creating || 'role' in body) && !ROLES.includes(body.role)) return 'Rol inválido';
  if ((creating || body.password) && (!body.password || String(body.password).length < 8)) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  return null;
}

users.post('/', async (c) => {
  const body = await readJson(c);
  const error = validate(body, true);
  if (error) return c.json({ error }, 400);
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(body.email).first();
  if (exists) return c.json({ error: 'Ya existe un usuario con ese email' }, 409);
  const row = await c.env.DB.prepare(
    `INSERT INTO users (name, email, password_hash, role, license_number, active) VALUES (?, ?, ?, ?, ?, 1) RETURNING ${PUBLIC_FIELDS}`
  )
    .bind(clean(body.name), body.email.trim(), bcrypt.hashSync(body.password, 10), body.role, clean(body.license_number))
    .first();
  return c.json(row, 201);
});

users.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await readJson(c);
  const current = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!current) return c.json({ error: 'Usuario no encontrado' }, 404);
  const error = validate(body, false);
  if (error) return c.json({ error }, 400);

  const role = body.role ?? current.role;
  const active = 'active' in body ? toBool(body.active) : current.active;
  if (id === userOf(c).id && !active) return c.json({ error: 'No podés desactivar tu propio usuario' }, 400);
  // Nunca dejar el sistema sin un administrador activo.
  if (current.role === 'admin' && (role !== 'admin' || !active)) {
    const { n } = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?").bind(id).first();
    if (n === 0) return c.json({ error: 'Tiene que quedar al menos un administrador activo' }, 400);
  }
  if ('email' in body) {
    const other = await c.env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?').bind(body.email, id).first();
    if (other) return c.json({ error: 'Ya existe un usuario con ese email' }, 409);
  }

  await c.env.DB.prepare('UPDATE users SET name = ?, email = ?, role = ?, license_number = ?, active = ? WHERE id = ?')
    .bind(
      clean(body.name) ?? current.name,
      'email' in body ? body.email.trim() : current.email,
      role,
      'license_number' in body ? clean(body.license_number) : current.license_number,
      active,
      id
    )
    .run();
  if (body.password) {
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(bcrypt.hashSync(body.password, 10), id).run();
  }
  return c.json(await c.env.DB.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).bind(id).first());
});

export default users;
