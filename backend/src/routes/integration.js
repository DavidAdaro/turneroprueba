import { Hono } from 'hono';
import { readJson, toInt } from '../utils/http';
import { APPOINTMENT_SELECT, logEvent } from '../utils/agenda';
import { nowLocal } from '../utils/time';

// Endpoints para equipos / PACS (servidor a servidor), autenticados con el
// header X-API-Key = INTEGRATION_API_KEY (secreto del Worker).
const integration = new Hono();

integration.use('*', async (c, next) => {
  const expected = c.env.INTEGRATION_API_KEY;
  const given = c.req.header('X-API-Key') || '';
  if (!expected) return c.json({ error: 'Integración deshabilitada (falta INTEGRATION_API_KEY)' }, 503);
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const same = new Uint8Array(a).every((x, i) => x === new Uint8Array(b)[i]);
  if (!same) return c.json({ error: 'API key inválida' }, 401);
  return next();
});

const dicomDate = (d) => (d ? d.replace(/-/g, '') : '');
// Sin acentos: el juego de caracteres DICOM por defecto es ASCII.
const ascii = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const dicomName = (last, first) => ascii(`${last}^${first}`).toUpperCase();

// Modality Worklist en JSON (atributos con nombre DICOM), para que un
// broker MWL (p. ej. un plugin de Orthanc o dcm4chee) la sirva a la
// modalidad. Incluye pacientes admitidos o en sala del día.
integration.get('/worklist', async (c) => {
  const date = c.req.query('date') || nowLocal().date;
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
integration.post('/study-received', async (c) => {
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

export default integration;
