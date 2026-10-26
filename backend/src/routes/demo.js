import { Hono } from 'hono';
import { requireAuth, requireRole, userOf } from '../middleware/auth';
import { readJson } from '../utils/http';
import { isDate, nowLocal } from '../utils/time';
import { createDemoAppointments, loadDemoPool } from '../utils/demo';
import { isLiveOn, runLive } from '../utils/live';

// Datos de prueba: genera turnos ficticios de RM, TC y Rx para un día.
const demo = new Hono();
demo.use('*', requireAuth);

demo.post('/appointments', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  const date = isDate(body.date) ? body.date : nowLocal().date;
  // Los turnos de ejemplo se generan SOLO con los pacientes propios
  // (backend/demo-patients.local.json, cargado por npm run setup).
  if (!(await loadDemoPool(c.env.DB))) {
    return c.json(
      { error: 'No hay pacientes propios cargados: falta backend/demo-patients.local.json. Crealo, corré npm run setup y volvé a intentar.' },
      400
    );
  }
  return c.json({ date, ...(await createDemoAppointments(c.env.DB, date, userOf(c).id)) }, 201);
});

// Simulación en vivo de la actividad del día (ver utils/live.js).
demo.get('/live', async (c) => c.json({ live: await isLiveOn(c.env.DB), now: nowLocal() }));

demo.put('/live', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  const on = !!body.live;
  await c.env.DB.prepare("INSERT INTO settings (key, value) VALUES ('demo_live', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(on ? '1' : '0')
    .run();
  // Al encenderla se pone al día de inmediato con la hora actual.
  return c.json({ live: on, now: nowLocal(), ...(on ? await runLive(c.env.DB) : {}) });
});

export default demo;
