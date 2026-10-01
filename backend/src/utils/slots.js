import { addDays, fromMinutes, overlaps, toMinutes, weekdayOf } from './time.js';

// Estados que ya no ocupan el horario.
export const FREEING_STATUSES = ['cancelled'];

// Horarios de atención vigentes para un equipo en una fecha.
export function schedulesForDate(schedules, equipmentId, date) {
  const weekday = weekdayOf(date);
  return schedules.filter(
    (s) =>
      s.equipment_id === equipmentId &&
      s.weekday === weekday &&
      (!s.valid_from || s.valid_from <= date) &&
      (!s.valid_to || s.valid_to >= date)
  );
}

// Bloqueos que afectan a un profesional en una fecha (los generales,
// equipment_id NULL, aplican a todos).
export function blocksForDate(blocks, equipmentId, date) {
  return blocks.filter(
    (b) =>
      (b.equipment_id == null || b.equipment_id === equipmentId) &&
      b.start_date <= date &&
      b.end_date >= date
  );
}

// Devuelve el bloqueo que cubre [start, end) si hay alguno.
export function findBlock(blocks, start, end) {
  return (
    blocks.find((b) => {
      if (!b.start_time || !b.end_time) return true; // día entero
      return overlaps(start, end, toMinutes(b.start_time), toMinutes(b.end_time));
    }) || null
  );
}

// Arma la grilla del día para un equipo: cada slot del horario de
// atención con su estado (free / taken / blocked / past), más los turnos que
// quedan fuera de la grilla (sobreturnos o turnos dados fuera de horario).
export function buildDaySlots({ equipmentId, date, schedules, blocks, appointments, now }) {
  const daySchedules = schedulesForDate(schedules, equipmentId, date).sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );
  const dayBlocks = blocksForDate(blocks, equipmentId, date);
  const active = appointments.filter(
    (a) => a.equipment_id === equipmentId && a.date === date && !FREEING_STATUSES.includes(a.status)
  );

  const slots = [];
  const placed = new Set();

  for (const s of daySchedules) {
    const step = Math.max(5, s.slot_minutes || 15);
    const end = toMinutes(s.end_time);
    for (let t = toMinutes(s.start_time); t + step <= end; t += step) {
      const slotEnd = t + step;
      const start_time = fromMinutes(t);
      const taken = active.filter(
        (a) => !a.overbook && overlaps(t, slotEnd, toMinutes(a.start_time), toMinutes(a.end_time))
      );
      taken.forEach((a) => placed.add(a.id));
      const block = findBlock(dayBlocks, t, slotEnd);
      let status = 'free';
      if (taken.length) status = 'taken';
      else if (block) status = 'blocked';
      else if (now && (date < now.date || (date === now.date && start_time < now.time))) status = 'past';
      slots.push({
        start_time,
        end_time: fromMinutes(slotEnd),
        status,
        appointment_ids: taken.map((a) => a.id),
        block_reason: block ? block.reason || 'Bloqueado' : null,
      });
    }
  }

  const extra = active.filter((a) => !placed.has(a.id)).map((a) => a.id);
  return { slots, extra_appointment_ids: extra, blocks: dayBlocks };
}

// Valida si se puede dar un turno en [start_time, end_time). Devuelve
// null si está OK o un mensaje de error.
export function validateBooking({ equipmentId, date, start_time, end_time, overbook, schedules, blocks, appointments, ignoreId }) {
  const start = toMinutes(start_time);
  const end = toMinutes(end_time);
  if (end <= start) return 'La hora de fin debe ser posterior a la de inicio';

  const block = findBlock(blocksForDate(blocks, equipmentId, date), start, end);
  if (block) return `La agenda está bloqueada en ese horario${block.reason ? ` (${block.reason})` : ''}`;

  if (overbook) return null; // el sobreturno se superpone a propósito

  const inSchedule = schedulesForDate(schedules, equipmentId, date).some(
    (s) => toMinutes(s.start_time) <= start && end <= toMinutes(s.end_time)
  );
  if (!inSchedule) return 'El horario está fuera de la agenda del equipo (dalo como sobreturno)';

  const clash = appointments.find(
    (a) =>
      a.id !== ignoreId &&
      a.equipment_id === equipmentId &&
      a.date === date &&
      !a.overbook &&
      !FREEING_STATUSES.includes(a.status) &&
      overlaps(start, end, toMinutes(a.start_time), toMinutes(a.end_time))
  );
  if (clash) return `Ya hay un turno a las ${clash.start_time} (dalo como sobreturno)`;
  return null;
}

// Primeros turnos libres desde una fecha (para "próximo turno disponible"
// y para la reserva online).
export function findFreeSlots({ equipmentId, from, days, schedules, blocks, appointments, now, limit = 200 }) {
  const result = [];
  for (let i = 0; i < days && result.length < limit; i++) {
    const date = addDays(from, i);
    const { slots } = buildDaySlots({ equipmentId, date, schedules, blocks, appointments, now });
    for (const s of slots) {
      if (s.status === 'free') result.push({ date, start_time: s.start_time, end_time: s.end_time });
      if (result.length >= limit) break;
    }
  }
  return result;
}
