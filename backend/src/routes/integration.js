import { Hono } from 'hono';
import { Resvg } from '@cf-wasm/resvg';
import { readJson, toInt } from '../utils/http';
import { APPOINTMENT_SELECT, logEvent } from '../utils/agenda';
import { isDate, nowLocal } from '../utils/time';
import { SCOPES, hashApiKey, parseScopes } from '../utils/apiKeys';
import { MODALITIES } from './equipment';
import { buildOrderImageSvg } from '../utils/orderImageSvg';
// Datos binarios de la tipografía (ver wrangler.jsonc, regla Data para
// **/*.ttf) — resvg no tiene ninguna fuente del sistema disponible en el
// sandbox de Workers, así que hay que pasarle una propia o el texto se
// renderiza en blanco.
import caveatFont from '../assets/Caveat-Regular.ttf';

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

// Pedido médico del turno (mismos nombres que los pedidos de InPatient).
const medicalOrderOf = (a) => ({
  received: !!a.order_received,
  ordering_physician: a.referring_physician,
  ordering_physician_license: a.order_physician_license,
  order_date: a.order_date,
  code: a.order_code,
  study_requested: a.study_name,
  reason: a.clinical_indication,
  observations: a.order_observations,
  authorization_number: a.authorization_number,
});

// ---- Datos clínicos (permiso clinical:read) ----
// Solo se expone el texto de informes FIRMADOS; un borrador figura como
// { status: 'draft' } sin contenido.
async function signedReports(db, where, params) {
  const { results } = await db
    .prepare(
      `SELECT r.appointment_id, r.technique, r.findings, r.conclusion, r.signed_at, u.name AS radiologist_name, u.license_number AS radiologist_license
       FROM reports r JOIN appointments a ON a.id = r.appointment_id LEFT JOIN users u ON u.id = r.radiologist_id
       WHERE r.status = 'signed' AND ${where}`
    )
    .bind(...params)
    .all();
  return new Map(results.map((r) => [r.appointment_id, r]));
}

function clinicalOf(a, reports) {
  const r = reports.get(a.id);
  return {
    patient_notes: a.patient_notes, // alergias, marcapasos, claustrofobia…
    clinical_indication: a.clinical_indication, // diagnóstico presuntivo de la orden
    appointment_notes: a.notes, // notas del turno
    technician_notes: a.technician_notes, // observaciones del técnico
    report: r
      ? {
          status: 'signed',
          technique: r.technique,
          findings: r.findings,
          conclusion: r.conclusion,
          signed_at: r.signed_at,
          radiologist: r.radiologist_name,
          radiologist_license: r.radiologist_license,
        }
      : a.report_status === 'draft'
        ? { status: 'draft' }
        : null,
  };
}

// Lista de equipos (consolas). "name" es el valor que acepta
// /schedule?equipment=. Query (opcionales):
//   modality         MR | CT | US | DX | MG ...
//   include_inactive 1 para incluir equipos desactivados (por defecto no).
integration.get('/equipment', requireScope('schedule:read'), async (c) => {
  const db = c.env.DB;
  const where = [];
  const params = [];
  if (c.req.query('include_inactive') !== '1') where.push('active = 1');
  if (c.req.query('modality')) {
    where.push('modality = ?');
    params.push(c.req.query('modality').toUpperCase());
  }
  const [{ results: rows }, { results: schedules }] = await Promise.all([
    db
      .prepare(`SELECT * FROM equipment${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY modality, name`)
      .bind(...params)
      .all(),
    db.prepare('SELECT * FROM schedules ORDER BY weekday, start_time').all(),
  ]);
  return c.json({
    equipment: rows.map((e) => ({
      id: e.id,
      name: e.name,
      modality: e.modality,
      modality_name: MODALITIES[e.modality] || e.modality,
      ae_title: e.ae_title,
      location: e.location,
      active: !!e.active,
      schedules: schedules
        .filter((s) => s.equipment_id === e.id)
        .map((s) => ({ weekday: s.weekday, start_time: s.start_time, end_time: s.end_time, slot_minutes: s.slot_minutes })),
    })),
  });
});

// Nomenclador: código de facturación de cada estudio activo, para que un
// sistema externo (p. ej. InPatient) pueda ofrecer un desplegable en vez de
// que alguien lo tipee a mano. Mismo permiso que /equipment (schedule:read)
// porque es catálogo, no dato clínico de un paciente puntual. Solo estudios
// activos y con código cargado — uno sin código no sirve para este fin.
integration.get('/studies', requireScope('schedule:read'), async (c) => {
  const { results } = await c.env.DB.prepare("SELECT code, name FROM studies WHERE active = 1 AND code IS NOT NULL AND code != '' ORDER BY name")
    .all();
  return c.json({ studies: results.map((s) => ({ code: s.code, name: s.name })) });
});

// Turnero del día para sistemas externos (p. ej. InPatient): un turno por
// elemento con paciente, estudio, cobertura, horarios y estado.
// Query (todos opcionales):
//   date      AAAA-MM-DD (por defecto hoy, hora Argentina). Inválida → 400.
//   equipment nombre del equipo, sin distinguir mayúsculas ("Resonador 1").
//   ae_title  AE Title DICOM del equipo ("RM15T").
//   modality  MR | CT | US | DX | MG ...
// equipment/ae_title que no existen → 404. Si la key además tiene
// clinical:read, cada turno trae "clinical".
integration.get('/schedule', requireScope('schedule:read'), async (c) => {
  const db = c.env.DB;
  const qDate = c.req.query('date');
  if (qDate !== undefined && !isDate(qDate)) return c.json({ error: 'date inválida: usar AAAA-MM-DD' }, 400);
  const date = qDate || nowLocal().date;
  const params = [date];
  let where = 'a.date = ?';
  if (c.req.query('modality')) {
    where += ' AND e.modality = ?';
    params.push(c.req.query('modality').toUpperCase());
  }
  const byName = (c.req.query('equipment') || '').trim();
  if (byName) {
    const eq = await db.prepare('SELECT id FROM equipment WHERE lower(name) = lower(?)').bind(byName).first();
    if (!eq) return c.json({ error: `No existe el equipo "${byName}"` }, 404);
    where += ' AND a.equipment_id = ?';
    params.push(eq.id);
  }
  const aeTitle = (c.req.query('ae_title') || '').trim();
  if (aeTitle) {
    const eq = await db.prepare('SELECT id FROM equipment WHERE ae_title = ?').bind(aeTitle).first();
    if (!eq) return c.json({ error: `No existe un equipo con AE Title "${aeTitle}"` }, 404);
    where += ' AND e.ae_title = ?';
    params.push(aeTitle);
  }
  const { results } = await c.env.DB.prepare(`${APPOINTMENT_SELECT} WHERE ${where} ORDER BY a.start_time, e.name`).bind(...params).all();
  const clinical = c.get('apiScopes').includes('clinical:read');
  const reports = clinical ? await signedReports(c.env.DB, 'a.date = ?', [date]) : null;
  return c.json({
    date,
    appointments: results.map((a) => ({
      ...(clinical ? { clinical: clinicalOf(a, reports) } : {}),
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
      medical_order: medicalOrderOf(a),
      arrived_at: a.arrived_at,
      started_at: a.started_at,
      completed_at: a.completed_at,
      pacs_status: a.pacs_status,
      report_status: a.report_status,
    })),
  });
});

// Foto (PNG) del pedido médico de UN turno puntual, para que un sistema
// externo (p. ej. InPatient) pueda probar su lectura por IA sin que nadie
// suba una foto a mano. Mismo permiso que /equipment y /studies
// (schedule:read, es consulta/catálogo, no dato clínico nuevo). Busca la
// cita exacta por fecha + equipo + hora + DNI (mismos filtros que
// /schedule, más start_time y dni) y arma una imagen "manuscrita
// ficticia" a partir de los datos que ya tiene cargados — ver
// utils/orderImageSvg.js, a propósito MÁS SIMPLE que la vista
// "Ver pedido escaneado" del staff (sin filtros SVG, que resvg —el motor
// de rasterizado que corre acá, @cf-wasm/resvg— no tiene garantizado
// soportar). Sin match exacto, 404 claro: no inventa una imagen de un
// turno que no existe.
integration.get('/order-image', requireScope('schedule:read'), async (c) => {
  const db = c.env.DB;
  const date = c.req.query('date');
  const time = c.req.query('time');
  const dni = (c.req.query('dni') || '').replace(/\D/g, '');
  if (!date || !isDate(date)) return c.json({ error: 'date inválida: usar AAAA-MM-DD' }, 400);
  if (!time) return c.json({ error: 'time es requerido (HH:MM)' }, 400);
  if (!dni) return c.json({ error: 'dni es requerido' }, 400);

  const params = [date, time, dni];
  let where = 'a.date = ? AND a.start_time = ? AND p.dni = ?';
  const byName = (c.req.query('equipment') || '').trim();
  if (byName) {
    const eq = await db.prepare('SELECT id FROM equipment WHERE lower(name) = lower(?)').bind(byName).first();
    if (!eq) return c.json({ error: `No existe el equipo "${byName}"` }, 404);
    where += ' AND a.equipment_id = ?';
    params.push(eq.id);
  }

  const appointment = await db.prepare(`${APPOINTMENT_SELECT} WHERE ${where} LIMIT 1`).bind(...params).first();
  if (!appointment) return c.json({ error: 'No se encontró ningún turno con esos datos' }, 404);

  const svg = buildOrderImageSvg(appointment);
  const png = (
    await Resvg.async(svg, { background: '#fbf8ef', font: { fontBuffers: [new Uint8Array(caveatFont)], defaultFontFamily: 'Caveat' } })
  )
    .render()
    .asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
});

// Paciente por DNI con sus observaciones y el historial de estudios
// (indicación, notas del turno, observaciones del técnico e informe).
integration.get('/patients/:dni', requireScope('clinical:read'), async (c) => {
  const db = c.env.DB;
  const dni = c.req.param('dni').replace(/\D/g, '');
  const patient = await db
    .prepare('SELECT p.*, i.name AS insurance_name, i.code AS insurance_code FROM patients p LEFT JOIN insurances i ON i.id = p.insurance_id WHERE p.dni = ?')
    .bind(dni)
    .first();
  if (!patient) return c.json({ error: 'Paciente no encontrado' }, 404);
  const { results } = await db
    .prepare(`${APPOINTMENT_SELECT} WHERE a.patient_id = ? ORDER BY a.date DESC, a.start_time DESC LIMIT 100`)
    .bind(patient.id)
    .all();
  const reports = await signedReports(db, 'a.patient_id = ?', [patient.id]);
  return c.json({
    patient: {
      dni: patient.dni,
      last_name: patient.last_name,
      first_name: patient.first_name,
      birth_date: patient.birth_date,
      sex: patient.sex,
      phone: patient.phone,
      weight_kg: patient.weight_kg,
      notes: patient.notes,
      insurance: patient.insurance_name ? { name: patient.insurance_name, code: patient.insurance_code, plan: patient.insurance_plan, affiliate_number: patient.affiliate_number } : null,
    },
    appointments: results.map((a) => ({
      appointment_id: a.id,
      date: a.date,
      start_time: a.start_time,
      status: a.status,
      accession_number: a.accession_number,
      study_instance_uid: a.study_instance_uid,
      study: { code: a.study_code, name: a.study_name, modality: a.modality, contrast: !!a.study_contrast },
      equipment: a.equipment_name,
      referring_physician: a.referring_physician,
      clinical_indication: a.clinical_indication,
      medical_order: medicalOrderOf(a),
      appointment_notes: a.notes,
      technician_notes: a.technician_notes,
      report: clinicalOf(a, reports).report,
    })),
  });
});

export default integration;
