import { Hono } from 'hono';
import { requireAuth, requireRole, userOf } from '../middleware/auth';
import { clean, readJson, toBool, toInt } from '../utils/http';
import { addDays, fromMinutes, isDate, isTime, nowLocal, toMinutes } from '../utils/time';
import { normText, sqlNorm } from '../utils/search';
import { buildDaySlots, findFreeSlots, schedulesForDate, validateBooking } from '../utils/slots';
import { APPOINTMENT_SELECT, PENDING_STATUSES, loadAgendaData, logEvent } from '../utils/agenda';
import { newDicomUid, nextAccessionNumber, pacsMode, simulatePacsReception } from '../utils/pacs';

const appointments = new Hono();
appointments.use('*', requireAuth);

const CARE_TYPES = ['AMB', 'INT', 'GUA'];

const getAppointment = (db, id) => db.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).bind(id).first();

// GET /day?date=&equipment_id= → grilla de cada equipo del día.
appointments.get('/day', async (c) => {
  const date = c.req.query('date');
  if (!isDate(date)) return c.json({ error: 'Fecha inválida' }, 400);
  const equipmentId = toInt(c.req.query('equipment_id'));
  const db = c.env.DB;
  const eqFilter = equipmentId ? ' AND id = ?' : '';
  const eqParams = equipmentId ? [equipmentId] : [];

  const { results: equipment } = await db
    .prepare(`SELECT * FROM equipment WHERE active = 1${eqFilter} ORDER BY modality, name`)
    .bind(...eqParams)
    .all();
  const data = await loadAgendaData(db, { equipmentId, from: date, to: date });
  const { results: rows } = await db
    .prepare(`${APPOINTMENT_SELECT} WHERE a.date = ?${equipmentId ? ' AND a.equipment_id = ?' : ''} ORDER BY a.start_time, a.overbook`)
    .bind(date, ...eqParams)
    .all();
  const now = nowLocal();

  const agendas = equipment.map((e) => {
    const grid = buildDaySlots({ equipmentId: e.id, date, ...data, now });
    return {
      equipment: e,
      working: schedulesForDate(data.schedules, e.id, date).length > 0,
      slots: grid.slots,
      blocks: grid.blocks,
      appointments: rows.filter((a) => a.equipment_id === e.id),
    };
  });
  return c.json({ date, agendas });
});

// GET /list?from=&to=&status=a,b&equipment_id=&modality= → listados de
// trabajo (admisión, técnicos, entrega).
appointments.get('/list', async (c) => {
  const today = nowLocal().date;
  const from = isDate(c.req.query('from')) ? c.req.query('from') : today;
  const to = isDate(c.req.query('to')) ? c.req.query('to') : from;
  const where = ['a.date BETWEEN ? AND ?'];
  const params = [from, to];
  const statuses = (c.req.query('status') || '').split(',').filter(Boolean);
  if (statuses.length) {
    where.push(`a.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  const equipmentId = toInt(c.req.query('equipment_id'));
  if (equipmentId) {
    where.push('a.equipment_id = ?');
    params.push(equipmentId);
  }
  if (c.req.query('modality')) {
    where.push('e.modality = ?');
    params.push(c.req.query('modality'));
  }
  const { results } = await c.env.DB.prepare(`${APPOINTMENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.date, a.start_time LIMIT 500`)
    .bind(...params)
    .all();
  return c.json(results);
});

// Búsqueda por N° de acceso, DNI o apellido (cualquier fecha).
appointments.get('/search', async (c) => {
  const q = (c.req.query('q') || '').trim();
  if (q.length < 2) return c.json([]);
  const like = `%${normText(q)}%`;
  const { results } = await c.env.DB.prepare(
    `${APPOINTMENT_SELECT} WHERE a.accession_number = ? OR p.dni = ? OR ${sqlNorm("p.last_name || ' ' || p.first_name")} LIKE ?
     ORDER BY a.date DESC, a.start_time DESC LIMIT 50`
  )
    .bind(q, q.replace(/\D/g, ''), like)
    .all();
  return c.json(results);
});

// GET /next-free?equipment_id=&from= → próximos turnos libres.
appointments.get('/next-free', async (c) => {
  const equipmentId = toInt(c.req.query('equipment_id'));
  if (!equipmentId) return c.json({ error: 'Elegí un equipo' }, 400);
  const now = nowLocal();
  const from = isDate(c.req.query('from')) && c.req.query('from') > now.date ? c.req.query('from') : now.date;
  const data = await loadAgendaData(c.env.DB, { equipmentId, from, to: addDays(from, 60) });
  return c.json(findFreeSlots({ equipmentId, from, days: 61, ...data, now, limit: toInt(c.req.query('limit')) || 10 }));
});

appointments.get('/:id', async (c) => {
  const row = await getAppointment(c.env.DB, c.req.param('id'));
  if (!row) return c.json({ error: 'Turno no encontrado' }, 404);
  const { results: events } = await c.env.DB.prepare(
    `SELECT ev.*, u.name AS user_name FROM appointment_events ev LEFT JOIN users u ON u.id = ev.user_id
     WHERE ev.appointment_id = ? ORDER BY ev.created_at, ev.id`
  )
    .bind(row.id)
    .all();
  return c.json({ ...row, events });
});

// Dar turno.
appointments.post('/', requireRole('admin', 'reception'), async (c) => {
  const body = await readJson(c);
  const db = c.env.DB;
  const user = userOf(c);
  const equipmentId = toInt(body.equipment_id);
  const patientId = toInt(body.patient_id);
  const studyId = toInt(body.study_id);
  const { date, start_time } = body;
  if (!equipmentId || !patientId || !studyId) return c.json({ error: 'Equipo, paciente y estudio son obligatorios' }, 400);
  if (!isDate(date) || !isTime(start_time)) return c.json({ error: 'Fecha u hora inválida' }, 400);

  const [patient, equipment, study] = await Promise.all([
    db.prepare('SELECT * FROM patients WHERE id = ?').bind(patientId).first(),
    db.prepare('SELECT * FROM equipment WHERE id = ? AND active = 1').bind(equipmentId).first(),
    db.prepare('SELECT * FROM studies WHERE id = ? AND active = 1').bind(studyId).first(),
  ]);
  if (!patient) return c.json({ error: 'Paciente no encontrado' }, 404);
  if (!equipment) return c.json({ error: 'Equipo no encontrado' }, 404);
  if (!study) return c.json({ error: 'Estudio no encontrado' }, 404);
  if (study.modality !== equipment.modality) {
    return c.json({ error: `El estudio es de ${study.modality} y el equipo es de ${equipment.modality}` }, 400);
  }

  const end_time = fromMinutes(toMinutes(start_time) + study.duration_minutes);
  const overbook = toBool(body.overbook);
  const data = await loadAgendaData(db, { equipmentId, from: date, to: date });
  const error = validateBooking({ equipmentId, date, start_time, end_time, overbook, ...data });
  if (error) return c.json({ error }, 409);

  const patientClash = await db
    .prepare(`SELECT start_time FROM appointments WHERE patient_id = ? AND date = ? AND status NOT IN ('cancelled','absent') AND start_time < ? AND end_time > ?`)
    .bind(patientId, date, end_time, start_time)
    .first();
  if (patientClash) return c.json({ error: `El paciente ya tiene un turno a las ${patientClash.start_time} ese día` }, 409);

  const row = await db
    .prepare(
      `INSERT INTO appointments (equipment_id, patient_id, study_id, date, start_time, end_time, overbook, insurance_id,
        authorization_number, referring_physician, clinical_indication, order_received, notes, care_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .bind(
      equipmentId,
      patientId,
      studyId,
      date,
      start_time,
      end_time,
      overbook,
      'insurance_id' in body ? toInt(body.insurance_id) : patient.insurance_id,
      clean(body.authorization_number),
      clean(body.referring_physician),
      clean(body.clinical_indication),
      toBool(body.order_received),
      clean(body.notes),
      CARE_TYPES.includes(body.care_type) ? body.care_type : 'AMB',
      user.id
    )
    .first();
  await logEvent(db, row.id, user.id, 'created', overbook ? 'Sobreturno' : null).run();
  return c.json(await getAppointment(db, row.id), 201);
});

// Datos administrativos del turno (orden, autorización, derivante, notas).
const EDITABLE = {
  insurance_id: toInt,
  authorization_number: clean,
  referring_physician: clean,
  clinical_indication: clean,
  order_received: toBool,
  notes: clean,
  technician_notes: clean,
  care_type: (v) => (CARE_TYPES.includes(v) ? v : 'AMB'),
};

appointments.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = userOf(c);
  const current = await getAppointment(db, c.req.param('id'));
  if (!current) return c.json({ error: 'Turno no encontrado' }, 404);
  const body = await readJson(c);
  // El técnico solo puede cargar sus observaciones; recepción/admin el resto.
  const allowed = user.role === 'technician' ? ['technician_notes'] : user.role === 'radiologist' ? [] : Object.keys(EDITABLE);
  const fields = allowed.filter((f) => f in body);
  if (!fields.length) return c.json(current);
  await db.batch([
    db
      .prepare(`UPDATE appointments SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...fields.map((f) => EDITABLE[f](body[f])), current.id),
    logEvent(db, current.id, user.id, 'updated', fields.join(', ')),
  ]);
  return c.json(await getAppointment(db, current.id));
});

// ---- Flujo de trabajo ----
// Cada acción: roles que la pueden hacer, estados de origen y qué cambia.
const ACTIONS = {
  confirm: { roles: ['admin', 'reception'], from: ['given'], label: 'Confirmado' },
  admit: { roles: ['admin', 'reception'], from: ['given', 'confirmed'], label: 'Admitido' },
  absent: { roles: ['admin', 'reception'], from: ['given', 'confirmed'], label: 'Ausente' },
  cancel: { roles: ['admin', 'reception'], from: ['given', 'confirmed', 'arrived'], label: 'Cancelado' },
  undo_admit: { roles: ['admin', 'reception'], from: ['arrived'], label: 'Admisión anulada' },
  start: { roles: ['admin', 'technician'], from: ['arrived'], label: 'En sala' },
  complete: { roles: ['admin', 'technician'], from: ['in_progress'], label: 'Estudio realizado' },
  resend_pacs: { roles: ['admin', 'technician'], from: ['completed'], label: 'Reenvío a PACS' },
  deliver: { roles: ['admin', 'reception'], from: ['reported'], label: 'Entregado' },
};

appointments.post('/:id/actions/:action', async (c) => {
  const db = c.env.DB;
  const user = userOf(c);
  const action = ACTIONS[c.req.param('action')];
  if (!action) return c.json({ error: 'Acción inválida' }, 400);
  if (!action.roles.includes(user.role)) return c.json({ error: 'No tenés permisos para esta acción' }, 403);
  const current = await getAppointment(db, c.req.param('id'));
  if (!current) return c.json({ error: 'Turno no encontrado' }, 404);
  if (!action.from.includes(current.status)) return c.json({ error: `No se puede pasar a "${action.label}" desde el estado actual` }, 400);
  const body = await readJson(c);
  const name = c.req.param('action');

  const sets = [];
  const values = [];
  let detail = null;

  switch (name) {
    case 'confirm':
      sets.push("status = 'confirmed'");
      break;
    case 'absent':
      sets.push("status = 'absent'");
      break;
    case 'cancel':
      sets.push("status = 'cancelled'", 'cancel_reason = ?');
      values.push(clean(body.reason));
      detail = clean(body.reason);
      break;
    case 'admit': {
      // Recepción: sin orden médica no se admite; si la OS pide
      // autorización, tiene que estar cargada.
      const orderReceived = 'order_received' in body ? toBool(body.order_received) : current.order_received;
      const authorization = 'authorization_number' in body ? clean(body.authorization_number) : current.authorization_number;
      if (current.date !== nowLocal().date) return c.json({ error: 'Solo se admiten turnos del día' }, 400);
      if (!orderReceived) return c.json({ error: 'Falta la orden médica' }, 400);
      if (current.requires_authorization && !authorization) {
        return c.json({ error: `${current.insurance_name} requiere número de autorización` }, 400);
      }
      sets.push("status = 'arrived'", "arrived_at = datetime('now')", 'order_received = 1', 'authorization_number = ?');
      values.push(authorization);
      for (const f of ['referring_physician', 'clinical_indication']) {
        if (f in body) {
          sets.push(`${f} = ?`);
          values.push(clean(body[f]));
        }
      }
      if (!current.accession_number) {
        // El N° de acceso y el StudyInstanceUID se asignan acá y viajan a la
        // modalidad por la worklist, así el estudio llega al PACS ya vinculado.
        sets.push('accession_number = ?', 'study_instance_uid = ?');
        const accession = await nextAccessionNumber(db, nowLocal().date);
        values.push(accession, newDicomUid());
        detail = `N° de acceso ${accession}`;
      }
      break;
    }
    case 'undo_admit':
      sets.push("status = 'confirmed'", 'arrived_at = NULL');
      break;
    case 'start':
      sets.push("status = 'in_progress'", "started_at = datetime('now')", 'technician_id = ?');
      values.push(user.role === 'technician' ? user.id : toInt(body.technician_id) || user.id);
      break;
    case 'complete':
    case 'resend_pacs': {
      if (name === 'complete') {
        sets.push("status = 'completed'", "completed_at = datetime('now')");
        if ('technician_notes' in body) {
          sets.push('technician_notes = ?');
          values.push(clean(body.technician_notes));
        }
      }
      if (pacsMode(c.env) === 'simulated') {
        const sim = simulatePacsReception(current.modality);
        sets.push('pacs_status = ?', 'image_count = ?');
        values.push(sim.pacs_status, sim.image_count);
        detail = `PACS (simulado): ${sim.image_count} imágenes recibidas`;
      } else {
        detail = 'Esperando confirmación del PACS';
      }
      break;
    }
    case 'deliver':
      sets.push("status = 'delivered'", "delivered_at = datetime('now')", 'delivered_to = ?');
      values.push(clean(body.delivered_to) || 'Paciente');
      detail = `Retiró: ${clean(body.delivered_to) || 'Paciente'}`;
      break;
  }

  sets.push("updated_at = datetime('now')");
  try {
    await db.batch([
      db.prepare(`UPDATE appointments SET ${sets.join(', ')} WHERE id = ?`).bind(...values, current.id),
      logEvent(db, current.id, user.id, name, detail),
    ]);
  } catch (err) {
    if (String(err).includes('UNIQUE')) return c.json({ error: 'Se generó un N° de acceso repetido; reintentá' }, 409);
    throw err;
  }
  return c.json(await getAppointment(db, current.id));
});

// Reprogramar: mover a otra fecha/hora (y opcionalmente a otro equipo de
// la misma modalidad).
appointments.post('/:id/reschedule', requireRole('admin', 'reception'), async (c) => {
  const db = c.env.DB;
  const user = userOf(c);
  const current = await getAppointment(db, c.req.param('id'));
  if (!current) return c.json({ error: 'Turno no encontrado' }, 404);
  if (!PENDING_STATUSES.includes(current.status)) return c.json({ error: 'Solo se pueden mover turnos pendientes' }, 400);
  const body = await readJson(c);
  const equipmentId = toInt(body.equipment_id) || current.equipment_id;
  const { date, start_time } = body;
  if (!isDate(date) || !isTime(start_time)) return c.json({ error: 'Fecha u hora inválida' }, 400);
  if (equipmentId !== current.equipment_id) {
    const eq = await db.prepare('SELECT modality FROM equipment WHERE id = ? AND active = 1').bind(equipmentId).first();
    if (!eq || eq.modality !== current.modality) return c.json({ error: 'El equipo destino tiene que ser de la misma modalidad' }, 400);
  }

  const data = await loadAgendaData(db, { equipmentId, from: date, to: date });
  const end_time = fromMinutes(toMinutes(start_time) + toMinutes(current.end_time) - toMinutes(current.start_time));
  const overbook = toBool(body.overbook);
  const error = validateBooking({ equipmentId, date, start_time, end_time, overbook, ...data, ignoreId: current.id });
  if (error) return c.json({ error }, 409);

  await db.batch([
    db
      .prepare(
        `UPDATE appointments SET equipment_id = ?, date = ?, start_time = ?, end_time = ?, overbook = ?, status = 'given',
         reminder_sent_at = NULL, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(equipmentId, date, start_time, end_time, overbook, current.id),
    logEvent(db, current.id, user.id, 'rescheduled', `${current.date} ${current.start_time} → ${date} ${start_time}`),
  ]);
  return c.json(await getAppointment(db, current.id));
});

// Marca que se envió el recordatorio (lo envía el usuario por WhatsApp).
appointments.post('/:id/reminder-sent', requireRole('admin', 'reception'), async (c) => {
  const db = c.env.DB;
  const current = await getAppointment(db, c.req.param('id'));
  if (!current) return c.json({ error: 'Turno no encontrado' }, 404);
  await db.batch([
    db.prepare("UPDATE appointments SET reminder_sent_at = datetime('now') WHERE id = ?").bind(current.id),
    logEvent(db, current.id, userOf(c).id, 'reminder', 'Recordatorio enviado'),
  ]);
  return c.json(await getAppointment(db, current.id));
});

export default appointments;
