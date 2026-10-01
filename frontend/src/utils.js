// Fecha local 'YYYY-MM-DD' (no UTC).
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(date, opts = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!date) return '';
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', opts);
}

export const longDate = (date) => {
  const s = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Timestamps de SQLite (UTC, 'YYYY-MM-DD HH:MM:SS') a hora local.
export function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(`${ts.replace(' ', 'T')}Z`).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export function minutesSince(ts) {
  if (!ts) return null;
  return Math.max(0, Math.round((Date.now() - new Date(`${ts.replace(' ', 'T')}Z`).getTime()) / 60000));
}

export function age(birthDate) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T12:00:00`);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export const money = (n) => (Number(n) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export const patientName = (a) => `${a.patient_last_name}, ${a.patient_first_name}`;

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const ROLE_LABELS = {
  admin: 'Administrador',
  reception: 'Recepción',
  technician: 'Técnico',
  radiologist: 'Médico informante',
};

export const STATUS = {
  given: { label: 'Dado', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  confirmed: { label: 'Confirmado', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  arrived: { label: 'Admitido', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  in_progress: { label: 'En sala', cls: 'bg-violet-100 text-violet-800 border-violet-300' },
  completed: { label: 'Realizado', cls: 'bg-teal-100 text-teal-800 border-teal-300' },
  reported: { label: 'Informado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  delivered: { label: 'Entregado', cls: 'bg-green-200 text-green-900 border-green-400' },
  absent: { label: 'Ausente', cls: 'bg-red-100 text-red-700 border-red-300' },
  cancelled: { label: 'Cancelado', cls: 'bg-zinc-100 text-zinc-500 border-zinc-300 line-through' },
};

export const EVENT_LABELS = {
  created: 'Turno dado',
  updated: 'Datos modificados',
  confirm: 'Confirmado',
  admit: 'Admitido en recepción',
  undo_admit: 'Admisión anulada',
  absent: 'Ausente',
  cancel: 'Cancelado',
  start: 'Ingresó a sala',
  complete: 'Estudio realizado',
  resend_pacs: 'Reenvío a PACS',
  pacs: 'PACS',
  signed: 'Informe firmado',
  deliver: 'Entregado',
  rescheduled: 'Reprogramado',
  reminder: 'Recordatorio',
};

export function viewerUrl(template, appointment) {
  if (!template || !appointment?.study_instance_uid) return null;
  return template
    .replaceAll('{uid}', encodeURIComponent(appointment.study_instance_uid))
    .replaceAll('{accession}', encodeURIComponent(appointment.accession_number || ''));
}

// Arma el mensaje de recordatorio y el link de WhatsApp.
export function whatsappLink(template, appointment, settings) {
  const text = (template || '')
    .replaceAll('{paciente}', `${appointment.patient_first_name} ${appointment.patient_last_name}`)
    .replaceAll('{estudio}', appointment.study_name)
    .replaceAll('{fecha}', longDate(appointment.date))
    .replaceAll('{hora}', appointment.start_time)
    .replaceAll('{centro}', [settings?.clinic_name, settings?.clinic_address].filter(Boolean).join(', '))
    .replaceAll('{preparacion}', appointment.study_preparation ? `Preparación: ${appointment.study_preparation}` : '')
    .replace(/\s+/g, ' ')
    .trim();
  const phone = (appointment.patient_phone || '').replace(/\D/g, '');
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
}
