import { Hono } from 'hono';
import { requireAuth, requireRole, userOf } from '../middleware/auth';
import { readJson } from '../utils/http';
import { isDate, nowLocal } from '../utils/time';
import { createDemoAppointments, loadDemoPool } from '../utils/demo';

// Datos de prueba: genera turnos ficticios de RM, TC y Rx para un día.
const demo = new Hono();
demo.use('*', requireAuth, requireRole('admin'));

demo.post('/appointments', async (c) => {
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

export default demo;
