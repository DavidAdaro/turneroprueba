import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import auth from './routes/auth';
import settings from './routes/settings';
import users from './routes/users';
import insurances from './routes/insurances';
import equipment from './routes/equipment';
import studies from './routes/studies';
import blocks from './routes/blocks';
import patients from './routes/patients';
import appointments from './routes/appointments';
import reports from './routes/reports';
import stats from './routes/stats';
import integration from './routes/integration';
import apiKeys from './routes/apiKeys';
import demo from './routes/demo';

const app = new Hono();

app.use('/api/*', async (c, next) => {
  // Las rutas de integración las llaman servidores, no navegadores.
  if (c.req.path.startsWith('/api/integration')) return next();
  return cors({ origin: c.env.CORS_ORIGIN || '*' })(c, next);
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', auth);
app.route('/api/settings', settings);
app.route('/api/users', users);
app.route('/api/insurances', insurances);
app.route('/api/equipment', equipment);
app.route('/api/studies', studies);
app.route('/api/blocks', blocks);
app.route('/api/patients', patients);
app.route('/api/appointments', appointments);
app.route('/api/reports', reports);
app.route('/api/stats', stats);
app.route('/api/api-keys', apiKeys);
app.route('/api/demo', demo);
app.route('/api/integration', integration);

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.status === 401) return c.json({ error: 'Sesión vencida o inválida' }, 401);
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

export default app;
