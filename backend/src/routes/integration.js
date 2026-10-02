import { Hono } from 'hono';
import { readJson, toInt } from '../utils/http';
import { APPOINTMENT_SELECT, logEvent } from '../utils/agenda';
import { isDate, nowLocal } from '../utils/time';
import { SCOPES, hashApiKey, parseScopes } from '../utils/apiKeys';

// Endpoints para sistemas externos (InPatient, PACS, broker de worklist),
// servidor a servidor. Autenticación por header X-API-Key con una key
// generada en Configuración → API keys; cada key solo puede usar los
// endpoints de los permisos que se le dieron. INTEGRATION_API_KEY (secreto
// del Worker, opcional) sigue funcionando como key maestra con todos los
// permisos.
const integration = new Hono();

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const ya = new Uint8Array(y);
  return new Uint8Array(x).every((v, i) => v === ya[i]);
}

integration.use('*', async (c, next) => {
  const given = c.req.header('X-API-Key') || '';
  if (!given) return c.json({ error: 'Falta el header X-API-Key' }, 401);

  if (c.env.INTEGRATION_API_KEY && (await sameSecret(given, c.env.INTEGRATION_API_KEY))) {
    c.set('apiScopes', Object.keys(SCOPES));
    return next();
  }

  const row = await c.env.DB.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL')
    .bind(await hashApiKey(given))
    .first();
  if (!row) return c.json({ error: 'API key inválida o revocada' }, 401);
  c.set('apiScopes', parseScopes(row.scopes));
  await c.env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run();
  return next();
});

const requireScope = (scope) => async (c, next) =>
  c.get('apiScopes').includes(scope) ? next() : c.json({ error: `La API key no tiene el permiso "${scope}"` }, 403);

const dicomDate = (d) => (d ? d.replace(/-/g, '') : '');
// Sin acentos: el juego de caracteres DICOM por defecto es ASCII.
const ascii = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const dicomName = (last, first) => ascii(`${last}^${first}`).toUpperCase();

// Modality Worklist en JSON (atributos con nombre DICOM), para que un
// broker MWL (p. ej. un plugin de Orthanc o dcm4chee) la sirva a la
// modalidad. Incluye pacientes admitidos o en sala del día.
integration.get('/worklist', requireScope('worklist:read'), async (c) => {
  const date = isDate(c.req.query('date')) ? c.req.query('date') : nowLocal().date;
  const params = [date];
  let where = "a.date = ? AND a.status IN ('arrived','in_progress')";
  if (c.req.query('ae_title')) {
    where += ' AND e.ae_title = ?';
    params.push(c.req.query('ae_title'));
  }
  if (c.req.query('modality')) {
    where += ' AND e.modality = ?';
    params.push(c.req.query('modality'));
  }
  const { results } = await c.env.DB.prepare(`${APPOINTMENT_SELECT} WHERE ${where} ORDER BY a.start_time`).bind(...params).all();
  return c.json(
    results.map((a) => ({
      AccessionNumber: a.accession_number,
      StudyInstanceUID: a.study_instance_uid,
      PatientID: a.dni,
      PatientName: dicomName(a.patient_last_name, a.patient_first_name),
      PatientBirthDate: dicomDate(a.patient_birth_date),
      PatientSex: a.patient_sex || '',
      PatientWeight: a.patient_weight_kg || '',
      ReferringPhysicianName: a.referring_physician || '',
      RequestedProcedureID: a.accession_number,
      RequestedProcedureDescription: a.study_name,
      ScheduledProcedureStepSequence: [
        {
          Modality: a.modality,
          ScheduledStationAETitle: a.ae_title || '',
          ScheduledProcedureStepStartDate: dicomDate(a.date),
          ScheduledProcedureStepStartTime: a.start_time.replace(':', '') + '00',
          ScheduledProcedureStepDescription: a.study_name,
          ScheduledProcedureStepID: a.accession_number,
        },
      ],
    }))
  );
});

// El PACS avisa que recibió el estudio (modo PACS_MODE=external). Busca por
// N° de acceso; si el técnico no había finalizado, lo pasa a realizado.
integration.post('/study-received', requireScope('pacs:write'), async (c) => {
  const db = c.env.DB;
  const body = await readJson(c);
  if (!body.accession_number) return c.json({ error: 'Falta accession_number' }, 400);
  const appt = await db.prepare('SELECT * FROM appointments WHERE accession_number = ?').bind(body.accession_number).first();
  if (!appt) return c.json({ error: 'N° de acceso desconocido' }, 404);
  const toComplete = ['arrived', 'in_progress'].includes(appt.status);
  await db.batch([
    db
      .prepare(
        `UPDATE appointments SET pacs_status = 'received', image_count = ?, study_instance_uid = COALESCE(?, study_instance_uid),
         ${toComplete ? "status = 'completed', completed_at = datetime('now'), " : ''}updated_at = datetime('now') WHERE id = ?`
      )
      .bind(toInt(body.image_count), body.study_instance_uid || null, appt.id),
    logEvent(db, appt.id, null, 'pacs', `PACS: estudio recibido${body.image_count ? ` (${body.image_count} imágenes)` : ''}`),
  ]);
  return c.json({ ok: true, appointment_id: appt.id });
});

// Turnero del día para sistemas externos (p. ej. InPatient): un turno por
// elemento con paciente, estudio, cobertura, horarios y estado. Filtros
// opcionales: date (AAAA-MM-DD, por defecto hoy), modality, ae_title.
integration.get('/schedule', requireScope('schedule:read'), async (c) => {
  const date = isDate(c.req.query('date')) ? c.req.query('date') : nowLocal().date;
  const params = [date];
  let where = 'a.date = ?';
  if (c.req.query('modality')) {
    where += ' AND e.modality = ?';
    params.push(c.req.query('modality'));
  }
  if (c.req.query('ae_title')) {
    where += ' AND e.ae_title = ?';
    params.push(c.req.query('ae_title'));
  }
  const { results } = await c.env.DB.prepare(`${APPOINTMENT_SELECT} WHERE ${where} ORDER BY a.start_time, e.name`).bind(...params).all();
  return c.json({
    date,
    appointments: results.map((a) => ({
      appointment_id: a.id,
      date: a.date,
      start_time: a.start_time,
      end_time: a.end_time,
      status: a.status,
      overbook: !!a.overbook,
      care_type: a.care_type,
      accession_number: a.accession_number,
      study_instance_uid: a.study_instance_uid,
      patient: {
        dni: a.dni,
        last_name: a.patient_last_name,
        first_name: a.patient_first_name,
        birth_date: a.patient_birth_date,
        sex: a.patient_sex,
        phone: a.patient_phone,
      },
      study: { code: a.study_code, name: a.study_name, modality: a.modality, contrast: !!a.study_contrast },
      equipment: { id: a.equipment_id, name: a.equipment_name, ae_title: a.ae_title },
      insurance: a.insurance_name ? { name: a.insurance_name, code: a.insurance_code, affiliate_number: a.affiliate_number } : null,
      authorization_number: a.authorization_number,
      referring_physician: a.referring_physician,
      order_received: !!a.order_received,
      arrived_at: a.arrived_at,
      started_at: a.started_at,
      completed_at: a.completed_at,
      pacs_status: a.pacs_status,
      report_status: a.report_status,
    })),
  });
});

export default integration;
