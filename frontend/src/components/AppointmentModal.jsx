import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ExternalLink, MessageCircle, Printer } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useData } from './useData';
import { useCatalog } from './useCatalogs';
import { Alert, ErrorMsg, Field, Modal, ModalityTag, StatusBadge } from './ui';
import { EVENT_LABELS, age, formatDateTime, longDate, patientName, today, viewerUrl, whatsappLink } from '../utils';

// Detalle de un turno con las acciones que corresponden al rol y al estado.
export default function AppointmentModal({ id, initialMode = null, onClose, onChanged }) {
  const { user } = useAuth();
  const settings = useCatalog('settings');
  const equipment = useCatalog('equipment') || [];
  const { data: a, error: loadError, setData } = useData(() => api.getAppointment(id), [id]);
  const [mode, setMode] = useState(null); // admit | cancel | reschedule | complete | deliver
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [free, setFree] = useState(null);

  const can = (...roles) => roles.includes(user.role);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const updated = await fn();
      const full = await api.getAppointment(id);
      setData(full);
      setMode(null);
      onChanged?.(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const action = (name, body) => run(() => api.appointmentAction(id, name, body));

  const openMode = (m) => {
    setError('');
    setMode(m);
    if (m === 'admit') {
      setForm({
        order_received: !!a.order_received,
        authorization_number: a.authorization_number || '',
        referring_physician: a.referring_physician || '',
        clinical_indication: a.clinical_indication || '',
      });
    } else if (m === 'reschedule') {
      setForm({ date: a.date, start_time: a.start_time, equipment_id: a.equipment_id, overbook: false });
      setFree(null);
      api.nextFree(a.equipment_id, a.date).then(setFree).catch(() => setFree([]));
    } else if (m === 'complete') {
      setForm({ technician_notes: a.technician_notes || '' });
    } else setForm({});
  };

  // Abrir directo en una acción (botones rápidos de las listas de trabajo).
  const opened = useRef(false);
  useEffect(() => {
    if (a && initialMode && !opened.current) {
      opened.current = true;
      openMode(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, initialMode]);

  if (loadError) return <Modal title="Turno" onClose={onClose}><ErrorMsg error={loadError} /></Modal>;
  if (!a) return <Modal title="Turno" onClose={onClose}><p className="text-sm text-slate-500">Cargando…</p></Modal>;

  const wa = whatsappLink(settings?.reminder_template, a, settings);
  const viewer = viewerUrl(settings?.viewer_url_template, a);
  const pending = ['given', 'confirmed'].includes(a.status);
  const sameModality = equipment.filter((e) => e.modality === a.modality && e.active);

  return (
    <Modal title={`Turno · ${a.study_name}`} onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={a.status} />
            {a.overbook ? <span className="text-xs font-medium text-orange-600">SOBRETURNO</span> : null}
          </div>
          <div className="pt-1 text-base font-semibold">
            <Link to={`/pacientes/${a.patient_id}`} className="hover:underline">
              {patientName(a)}
            </Link>
          </div>
          <div className="text-slate-600">
            DNI {a.dni}
            {a.patient_birth_date && ` · ${age(a.patient_birth_date)} años`}
            {a.patient_weight_kg && ` · ${a.patient_weight_kg} kg`}
          </div>
          <div className="text-slate-600">
            {a.insurance_name || 'Sin cobertura'}
            {a.affiliate_number && ` · Afiliado ${a.affiliate_number}`}
          </div>
          {a.patient_phone && <div className="text-slate-600">Tel. {a.patient_phone}</div>}
          {a.patient_notes && <Alert>⚠ {a.patient_notes}</Alert>}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <ModalityTag modality={a.modality} /> <span className="font-medium">{a.equipment_name}</span>
          </div>
          <div>
            {longDate(a.date)} · {a.start_time}–{a.end_time}
          </div>
          {a.study_contrast ? <div className="text-xs font-medium text-purple-700">Estudio con contraste</div> : null}
          {a.study_preparation && <div className="text-xs text-slate-600">Preparación: {a.study_preparation}</div>}
          <div className="text-slate-600">Derivante: {a.referring_physician || '—'}</div>
          <div className="text-slate-600">Indicación: {a.clinical_indication || '—'}</div>
          <div className="text-slate-600">
            Orden médica: {a.order_received ? 'recibida' : 'pendiente'}
            {a.requires_authorization ? ` · Autorización: ${a.authorization_number || 'pendiente'}` : ''}
          </div>
          {a.accession_number && (
            <div className="font-mono text-xs">
              N° acceso <b>{a.accession_number}</b>
            </div>
          )}
          {a.status !== 'given' && a.study_instance_uid && (
            <div className="text-xs text-slate-600">
              PACS:{' '}
              {a.pacs_status === 'received' ? (
                <span className="font-medium text-emerald-700">recibido ({a.image_count} imágenes)</span>
              ) : (
                <span className="text-amber-700">{a.pacs_status === 'error' ? 'error' : 'pendiente'}</span>
              )}
              {viewer && a.pacs_status === 'received' && (
                <a href={viewer} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-blue-700 hover:underline">
                  Ver imágenes <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
          {a.technician_name && <div className="text-slate-600">Técnico: {a.technician_name}</div>}
          {a.technician_notes && <div className="text-slate-600">Obs. técnica: {a.technician_notes}</div>}
          {a.notes && <div className="text-slate-600">Notas: {a.notes}</div>}
          {a.cancel_reason && <div className="text-red-600">Motivo cancelación: {a.cancel_reason}</div>}
          {a.delivered_to && <div className="text-slate-600">Retiró: {a.delivered_to}</div>}
        </div>
      </div>

      <ErrorMsg error={error} />

      {/* Formularios de cada acción */}
      {mode === 'admit' && (
        <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
          <div className="text-sm font-medium">Admisión del paciente</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.order_received} onChange={set('order_received')} /> Orden médica recibida
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`N° de autorización${a.requires_authorization ? ' *' : ''}`}>
              <input className="input" value={form.authorization_number} onChange={set('authorization_number')} />
            </Field>
            <Field label="Médico derivante">
              <input className="input" value={form.referring_physician} onChange={set('referring_physician')} />
            </Field>
            <Field label="Indicación / diagnóstico presuntivo" className="sm:col-span-2">
              <input className="input" value={form.clinical_indication} onChange={set('clinical_indication')} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMode(null)}>Volver</button>
            <button className="btn-success" disabled={busy} onClick={() => action('admit', form)}>
              Admitir y generar N° de acceso
            </button>
          </div>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="mt-4 space-y-3 rounded-md border border-red-200 bg-red-50/50 p-3">
          <Field label="Motivo de la cancelación">
            <input className="input" value={form.reason || ''} onChange={set('reason')} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMode(null)}>Volver</button>
            <button className="btn-danger" disabled={busy} onClick={() => action('cancel', form)}>
              Cancelar turno
            </button>
          </div>
        </div>
      )}

      {mode === 'complete' && (
        <div className="mt-4 space-y-3 rounded-md border border-teal-200 bg-teal-50/50 p-3">
          <Field label="Observaciones técnicas (contraste, dosis, incidencias)">
            <textarea className="input" rows={2} value={form.technician_notes} onChange={set('technician_notes')} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMode(null)}>Volver</button>
            <button className="btn-success" disabled={busy} onClick={() => action('complete', form)}>
              Finalizar y enviar a PACS
            </button>
          </div>
        </div>
      )}

      {mode === 'deliver' && (
        <div className="mt-4 space-y-3 rounded-md border border-green-200 bg-green-50/50 p-3">
          <Field label="¿Quién retira? (nombre y DNI si no es el paciente)">
            <input className="input" value={form.delivered_to || ''} onChange={set('delivered_to')} placeholder="Paciente" autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMode(null)}>Volver</button>
            <button className="btn-success" disabled={busy} onClick={() => action('deliver', form)}>
              Registrar entrega
            </button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className="mt-4 space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Equipo">
              <select className="input" value={form.equipment_id} onChange={(e) => {
                set('equipment_id')(e);
                setFree(null);
                api.nextFree(e.target.value, form.date).then(setFree).catch(() => setFree([]));
              }}>
                {sameModality.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" className="input" value={form.date} min={today()} onChange={set('date')} />
            </Field>
            <Field label="Hora">
              <input type="time" className="input" value={form.start_time} onChange={set('start_time')} />
            </Field>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Próximos libres</div>
            <div className="flex flex-wrap gap-1">
              {free === null && <span className="text-xs text-slate-400">Buscando…</span>}
              {free?.length === 0 && <span className="text-xs text-slate-400">Sin turnos libres en 60 días</span>}
              {free?.map((s) => (
                <button
                  key={s.date + s.start_time}
                  className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs hover:bg-blue-100"
                  onClick={() => setForm((f) => ({ ...f, date: s.date, start_time: s.start_time }))}
                >
                  {s.date.slice(8)}/{s.date.slice(5, 7)} {s.start_time}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.overbook} onChange={set('overbook')} /> Como sobreturno
          </label>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setMode(null)}>Volver</button>
            <button className="btn-primary" disabled={busy} onClick={() => run(() => api.reschedule(id, form))}>
              Mover turno
            </button>
          </div>
        </div>
      )}

      {/* Botonera según rol y estado */}
      {!mode && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          {can('admin', 'reception') && a.status === 'given' && (
            <button className="btn-secondary" disabled={busy} onClick={() => action('confirm')}>Confirmar asistencia</button>
          )}
          {can('admin', 'reception') && pending && (
            <>
              <button className="btn-success" disabled={a.date !== today()} title={a.date !== today() ? 'Solo se admiten turnos del día' : ''} onClick={() => openMode('admit')}>
                Admitir
              </button>
              <button className="btn-secondary" onClick={() => openMode('reschedule')}>
                <CalendarClock size={15} /> Reprogramar
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => action('absent')}>Ausente</button>
              <button className="btn-secondary text-red-600" onClick={() => openMode('cancel')}>Cancelar</button>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-green-700"
                  onClick={() => api.reminderSent(id).then(() => api.getAppointment(id)).then(setData).catch(() => {})}
                >
                  <MessageCircle size={15} /> WhatsApp{a.reminder_sent_at ? ' (enviado)' : ''}
                </a>
              )}
            </>
          )}
          {can('admin', 'reception') && a.status === 'arrived' && (
            <>
              <button className="btn-secondary" disabled={busy} onClick={() => action('undo_admit')}>Anular admisión</button>
              <button className="btn-secondary text-red-600" onClick={() => openMode('cancel')}>Cancelar</button>
            </>
          )}
          {can('admin', 'technician') && a.status === 'arrived' && (
            <button className="btn-primary" disabled={busy} onClick={() => action('start')}>Ingresar a sala</button>
          )}
          {can('admin', 'technician') && a.status === 'in_progress' && (
            <button className="btn-success" onClick={() => openMode('complete')}>Finalizar estudio</button>
          )}
          {can('admin', 'technician') && a.status === 'completed' && a.pacs_status !== 'received' && (
            <button className="btn-secondary" disabled={busy} onClick={() => action('resend_pacs')}>Reenviar a PACS</button>
          )}
          {can('admin', 'radiologist') && a.status === 'completed' && (
            <Link className="btn-primary" to={`/informes/${a.id}`}>Informar</Link>
          )}
          {['reported', 'delivered'].includes(a.status) && (
            <Link className="btn-secondary" to={`/informe/${a.id}/imprimir`} target="_blank">
              <Printer size={15} /> Imprimir informe
            </Link>
          )}
          {can('admin', 'reception') && a.status === 'reported' && (
            <button className="btn-success" onClick={() => openMode('deliver')}>Entregar</button>
          )}
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-500">Historial del turno ({a.events.length})</summary>
        <ul className="mt-2 space-y-1">
          {a.events.map((e) => (
            <li key={e.id} className="text-xs text-slate-600">
              <span className="text-slate-400">{formatDateTime(e.created_at)}</span> · <b>{EVENT_LABELS[e.action] || e.action}</b>
              {e.detail && ` — ${e.detail}`} {e.user_name && <span className="text-slate-400">({e.user_name})</span>}
            </li>
          ))}
        </ul>
      </details>
    </Modal>
  );
}
