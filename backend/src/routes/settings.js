import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import { readJson } from '../utils/http';

// Datos del centro, plantilla del recordatorio por WhatsApp y visor PACS.
export const SETTINGS_KEYS = ['clinic_name', 'clinic_address', 'clinic_phone', 'reminder_template', 'viewer_url_template', 'report_footer'];

export const DEFAULT_SETTINGS = {
  clinic_name: 'Consultorio',
  clinic_address: '',
  clinic_phone: '',
  reminder_template:
    'Hola {paciente}, le recordamos su turno de {estudio} el {fecha} a las {hora} en {centro}. {preparacion} Traiga la orden médica, DNI y credencial de la obra social. Por favor confirme respondiendo este mensaje.',
  // URL del visor DICOM; {uid} = StudyInstanceUID, {accession} = N° de acceso.
  viewer_url_template: '',
  report_footer: '',
};

export async function loadSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results) s[r.key] = r.value ?? '';
  return s;
}

const settings = new Hono();
settings.use('*', requireAuth);

settings.get('/', async (c) => c.json(await loadSettings(c.env.DB)));

settings.put('/', requireRole('admin'), async (c) => {
  const body = await readJson(c);
  const stmts = SETTINGS_KEYS.filter((k) => k in body).map((k) =>
    c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(
      k,
      body[k] == null ? '' : String(body[k])
    )
  );
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json(await loadSettings(c.env.DB));
});

export default settings;
