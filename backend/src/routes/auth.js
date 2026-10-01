import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { requireAuth } from '../middleware/auth';
import { readJson } from '../utils/http';

const auth = new Hono();

const EXPIRES_IN_SECONDS = 12 * 60 * 60; // 12h, un turno de recepción completo

auth.post('/login', async (c) => {
  const { email, password } = await readJson(c);
  if (!email || !password) return c.json({ error: 'Email y contraseña son requeridos' }, 400);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND active = 1')
    .bind(email)
    .first();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const profile = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    licenseNumber: user.license_number,
  };
  const token = await sign({ ...profile, exp: Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS }, c.env.JWT_SECRET);
  return c.json({ token, user: profile });
});

auth.get('/me', requireAuth, (c) => c.json({ user: c.get('jwtPayload') }));

export default auth;
