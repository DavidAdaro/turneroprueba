import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDaySlots, validateBooking, findFreeSlots } from '../src/utils/slots.js';
import { weekdayOf, addDays } from '../src/utils/time.js';

const MONDAY = '2026-10-05';
const schedules = [{ equipment_id: 1, weekday: 1, start_time: '09:00', end_time: '10:00', slot_minutes: 20 }];

test('weekdayOf y addDays', () => {
  assert.equal(weekdayOf(MONDAY), 1);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('arma la grilla y marca ocupados, bloqueados y sobreturnos', () => {
  const appointments = [
    { id: 1, equipment_id: 1, date: MONDAY, start_time: '09:20', end_time: '09:40', status: 'given', overbook: 0 },
    { id: 2, equipment_id: 1, date: MONDAY, start_time: '09:20', end_time: '09:40', status: 'given', overbook: 1 },
    { id: 3, equipment_id: 1, date: MONDAY, start_time: '09:00', end_time: '09:20', status: 'cancelled', overbook: 0 },
  ];
  const blocks = [{ equipment_id: null, start_date: MONDAY, end_date: MONDAY, start_time: '09:40', end_time: '10:00', reason: 'Reunión' }];
  const { slots, extra_appointment_ids } = buildDaySlots({ equipmentId: 1, date: MONDAY, schedules, blocks, appointments });
  assert.deepEqual(slots.map((s) => s.status), ['free', 'taken', 'blocked']);
  assert.deepEqual(extra_appointment_ids, [2]);
  assert.equal(slots[2].block_reason, 'Reunión');
});

test('marca como pasados los horarios anteriores a ahora', () => {
  const { slots } = buildDaySlots({ equipmentId: 1, date: MONDAY, schedules, blocks: [], appointments: [], now: { date: MONDAY, time: '09:30' } });
  assert.deepEqual(slots.map((s) => s.status), ['past', 'past', 'free']);
});

test('valida superposición, horario y bloqueos', () => {
  const base = { equipmentId: 1, date: MONDAY, schedules, blocks: [], appointments: [{ id: 9, equipment_id: 1, date: MONDAY, start_time: '09:00', end_time: '09:20', status: 'confirmed', overbook: 0 }] };
  assert.match(validateBooking({ ...base, start_time: '09:00', end_time: '09:20' }), /Ya hay un turno/);
  assert.equal(validateBooking({ ...base, start_time: '09:00', end_time: '09:20', overbook: true }), null);
  assert.equal(validateBooking({ ...base, start_time: '09:00', end_time: '09:20', ignoreId: 9 }), null);
  assert.match(validateBooking({ ...base, start_time: '11:00', end_time: '11:20' }), /fuera de la agenda/);
  assert.equal(validateBooking({ ...base, start_time: '09:20', end_time: '09:40' }), null);
  const blocks = [{ equipment_id: 1, start_date: MONDAY, end_date: addDays(MONDAY, 3), reason: 'Vacaciones' }];
  assert.match(validateBooking({ ...base, blocks, start_time: '09:20', end_time: '09:40', overbook: true }), /Vacaciones/);
});

test('busca turnos libres en los próximos días', () => {
  const free = findFreeSlots({ equipmentId: 1, from: '2026-10-03', days: 14, schedules, blocks: [], appointments: [], limit: 4 });
  assert.equal(free.length, 4);
  assert.deepEqual(free[0], { date: MONDAY, start_time: '09:00', end_time: '09:20' });
  assert.equal(free[3].date, addDays(MONDAY, 7));
});
