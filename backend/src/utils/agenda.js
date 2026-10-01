// Carga lo necesario para calcular disponibilidad en un rango de fechas.
export async function loadAgendaData(db, { equipmentId, from, to }) {
  const eqFilter = equipmentId ? ' AND equipment_id = ?' : '';
  const eqParams = equipmentId ? [equipmentId] : [];
  const [{ results: schedules }, { results: blocks }, { results: appointments }] = await Promise.all([
    db.prepare(`SELECT * FROM schedules WHERE 1 = 1${eqFilter}`).bind(...eqParams).all(),
    db
      .prepare(
        `SELECT * FROM schedule_blocks WHERE start_date <= ? AND end_date >= ?${equipmentId ? ' AND (equipment_id IS NULL OR equipment_id = ?)' : ''}`
      )
      .bind(to, from, ...eqParams)
      .all(),
    db
      .prepare(`SELECT id, equipment_id, date, start_time, end_time, status, overbook FROM appointments WHERE date BETWEEN ? AND ?${eqFilter}`)
      .bind(from, to, ...eqParams)
      .all(),
  ]);
  return { schedules, blocks, appointments };
}

export const APPOINTMENT_SELECT = `
  SELECT a.*,
    p.dni, p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
    p.email AS patient_email, p.birth_date AS patient_birth_date, p.sex AS patient_sex, p.weight_kg AS patient_weight_kg,
    p.notes AS patient_notes, p.affiliate_number, p.insurance_plan,
    e.name AS equipment_name, e.modality, e.color AS equipment_color, e.ae_title,
    s.name AS study_name, s.code AS study_code, s.contrast AS study_contrast, s.preparation AS study_preparation,
    i.name AS insurance_name, i.code AS insurance_code, i.requires_authorization,
    t.name AS technician_name, t.email AS technician_email,
    r.status AS report_status
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN equipment e ON e.id = a.equipment_id
  JOIN studies s ON s.id = a.study_id
  LEFT JOIN insurances i ON i.id = a.insurance_id
  LEFT JOIN users t ON t.id = a.technician_id
  LEFT JOIN reports r ON r.appointment_id = a.id`;

export function logEvent(db, appointmentId, userId, action, detail = null) {
  return db
    .prepare('INSERT INTO appointment_events (appointment_id, user_id, action, detail) VALUES (?, ?, ?, ?)')
    .bind(appointmentId, userId, action, detail);
}

// Estados en los que el turno todavía no se realizó.
export const PENDING_STATUSES = ['given', 'confirmed'];
// Estados con el estudio ya adquirido.
export const DONE_STATUSES = ['completed', 'reported', 'delivered'];
