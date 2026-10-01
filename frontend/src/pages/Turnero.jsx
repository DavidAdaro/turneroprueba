import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowRightCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  Flag,
  List,
  MessageSquare,
  Monitor,
  PauseCircle,
  Pill,
  Plus,
  RefreshCw,
  Table2,
  Undo2,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import AppointmentModal from '../components/AppointmentModal';
import { STATUS, addDays, age, longDate, today, viewerUrl, whatsappLink } from '../utils';

// Color de fondo de cada fila según el estado del turno (estilo planilla).
export const ROW_COLORS = {
  given: '#2b3350',
  confirmed: '#2f4470',
  arrived: '#8a6418',
  in_progress: '#5d3d91',
  completed: '#a5385a',
  reported: '#8c2f5e',
  delivered: '#6e2a4c',
  absent: '#4a4a4f',
  cancelled: '#2a2a2e',
};

const CARE_COLORS = { AMB: '#6aa84f', INT: '#3d85c6', GUA: '#cc4125' };
const CARE_LABELS = { AMB: 'Ambulatorio', INT: 'Internado', GUA: 'Guardia' };

// Hora local 'HH:MM' de un timestamp UTC de SQLite.
const hhmm = (ts) =>
  ts ? new Date(`${ts.replace(' ', 'T')}Z`).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const userCode = (email) => (email ? email.split('@')[0].toUpperCase().slice(0, 9) : '');
const dmy = (d) => (d ? d.split('-').reverse().join('/') : '');

// Siguiente paso del flujo para el botón "→".
function nextStep(a, role) {
  const can = (...r) => r.includes(role);
  if (['given', 'confirmed'].includes(a.status) && can('admin', 'reception')) return { label: 'Admitir', mode: 'admit' };
  if (a.status === 'arrived' && can('admin', 'technician')) return { label: 'Ingresar a sala', action: 'start' };
  if (a.status === 'in_progress' && can('admin', 'technician')) return { label: 'Finalizar estudio', mode: 'complete' };
  if (a.status === 'completed' && can('admin', 'radiologist')) return { label: 'Informar', link: `/informes/${a.id}` };
  if (a.status === 'reported' && can('admin', 'reception')) return { label: 'Entregar', mode: 'deliver' };
  return null;
}

export default function Turnero() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const settings = useCatalog('settings');
  const equipment = useCatalog('equipment') || [];
  const [date, setDate] = useState(today());
  const [modality, setModality] = useState('');
  const [hideCancelled, setHideCancelled] = useState(true);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const { data, reload } = useData(() => api.listAppointments({ from: date, to: date, modality: modality || undefined }), [date, modality]);

  useEffect(() => {
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const rows = useMemo(() => (data || []).filter((a) => !hideCancelled || a.status !== 'cancelled'), [data, hideCancelled]);
  const counts = useMemo(() => (data || []).reduce((c, a) => ({ ...c, [a.status]: (c[a.status] || 0) + 1 }), {}), [data]);
  const modalities = [...new Set(equipment.map((e) => e.modality))];
  const clinic = (settings?.clinic_name || 'CENTRO').split(' ')[0].toUpperCase().slice(0, 9);

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e.message);
    }
  };
  const can = (...r) => r.includes(user.role);

  return (
    <div className="-m-6 min-h-screen bg-[#1c1c22] p-4 text-white">
      {/* Barra superior */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <h1 className="mr-2 text-lg font-semibold">Turnero</h1>
        <button className="rounded bg-white/10 p-1.5 hover:bg-white/20" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior"><ChevronLeft size={16} /></button>
        <input type="date" className="rounded bg-white/10 px-2 py-1 text-white [color-scheme:dark]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="rounded bg-white/10 p-1.5 hover:bg-white/20" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente"><ChevronRight size={16} /></button>
        <button className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setDate(today())}>Hoy</button>
        <span className="text-white/70">{longDate(date)}</span>
        <select className="ml-2 rounded bg-white/10 px-2 py-1 text-white [&>option]:text-black" value={modality} onChange={(e) => setModality(e.target.value)}>
          <option value="">Todas las modalidades</option>
          {modalities.map((m) => <option key={m}>{m}</option>)}
        </select>
        <label className="flex items-center gap-1 text-white/70">
          <input type="checkbox" checked={hideCancelled} onChange={(e) => setHideCancelled(e.target.checked)} /> Ocultar cancelados
        </label>
        <div className="ml-auto flex gap-2">
          <button className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={reload}><RefreshCw size={14} /> Actualizar</button>
          {can('admin', 'reception') && (
            <button className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 hover:bg-emerald-500" onClick={() => navigate('/turnos')}><Plus size={14} /> Nuevo turno</button>
          )}
        </div>
      </div>

      {/* Referencias de color con cantidades */}
      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        {Object.entries(ROW_COLORS).map(([k, c]) => (
          <span key={k} className="rounded px-2 py-0.5" style={{ background: c }}>
            {STATUS[k].label} <b>{counts[k] || 0}</b>
          </span>
        ))}
      </div>
      {error && <div className="mb-2 rounded bg-red-600 px-3 py-1.5 text-sm">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] border-separate border-spacing-y-[3px] text-[12px] leading-tight">
          <thead>
            <tr className="text-left text-[13px] font-normal text-white/90">
              <th className="px-1 py-1" colSpan={3} />
              <th className="px-1">Centro</th>
              <th className="px-1">N° Turno</th>
              <th className="px-1" colSpan={2}>N° Ficha</th>
              <th className="px-1">Paciente</th>
              <th className="px-1">Documento</th>
              <th className="px-1">F/ Nac.</th>
              <th className="px-1">Edad</th>
              <th className="px-1" colSpan={3}>Estudio</th>
              <th className="px-1">Mod.</th>
              <th className="px-1" colSpan={2}>Aseguradora</th>
              <th className="px-1">Hora Turno</th>
              <th className="px-1">Arribo</th>
              <th className="px-1">Inicio</th>
              <th className="px-1">Usuario</th>
              <th className="px-1">Fin</th>
              <th className="px-1">Usuario</th>
              <th className="px-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const bg = ROW_COLORS[a.status];
              const pending = ['given', 'confirmed'].includes(a.status);
              const next = nextStep(a, user.role);
              const viewer = a.pacs_status === 'received' ? viewerUrl(settings?.viewer_url_template, a) : null;
              const wa = whatsappLink(settings?.reminder_template, a, settings);
              const cancelled = a.status === 'cancelled';
              const td = 'px-1 py-0.5 align-middle';
              return (
                <tr key={a.id} style={{ background: bg }} className={`${cancelled ? 'line-through opacity-60' : ''} hover:brightness-110`}>
                  {/* Cancelar / admitir / confirmación */}
                  <td className={`${td} rounded-l`}>
                    <Icon
                      title="Cancelar turno"
                      disabled={!can('admin', 'reception') || !['given', 'confirmed', 'arrived'].includes(a.status)}
                      className="text-red-300"
                      onClick={() => {
                        const reason = prompt('Motivo de la cancelación');
                        if (reason !== null) act(() => api.appointmentAction(a.id, 'cancel', { reason }));
                      }}
                    >
                      <XCircle size={22} />
                    </Icon>
                  </td>
                  <td className={td}>
                    <Icon
                      title={pending ? 'Admitir (recepción)' : 'Admitido'}
                      disabled={!pending || !can('admin', 'reception') || a.date !== today()}
                      className={pending && a.date === today() ? 'text-lime-400' : 'text-white/70'}
                      onClick={() => setOpen({ id: a.id, mode: 'admit' })}
                    >
                      <ArrowDownCircle size={22} />
                    </Icon>
                  </td>
                  <td className={td}>
                    <Icon
                      title={a.status === 'given' ? 'Sin confirmar · click para confirmar' : 'Confirmado'}
                      disabled={a.status !== 'given' || !can('admin', 'reception')}
                      className={a.status === 'given' ? 'text-red-400' : 'text-lime-400'}
                      onClick={() => act(() => api.appointmentAction(a.id, 'confirm'))}
                    >
                      <Flag size={20} fill="currentColor" />
                    </Icon>
                  </td>
                  {/* Centro + tipo de atención */}
                  <td className={td}>
                    <span className="flex items-center gap-1">
                      <span className="rounded px-1 py-1 text-[13px] font-bold italic" style={{ background: CARE_COLORS[a.care_type] }} title={CARE_LABELS[a.care_type]}>
                        {a.care_type}
                      </span>
                      {clinic}
                    </span>
                  </td>
                  <td className={td}>{String(a.id).padStart(7, '0')}</td>
                  {/* N° Ficha = N° de acceso, rojo si no fue admitido */}
                  <td className={`${td} text-[11px] italic text-sky-300`}>{a.modality}</td>
                  <td className={td}>
                    {a.accession_number ? (
                      <span className="font-medium whitespace-nowrap">{a.accession_number}</span>
                    ) : (
                      <span className="block w-full bg-red-600 px-1 py-2">0</span>
                    )}
                  </td>
                  <td className={td}>
                    <span className="flex items-center gap-1">
                      <Icon title={viewer ? 'Ver imágenes' : 'Ficha del paciente'} onClick={() => (viewer ? window.open(viewer, '_blank') : navigate(`/pacientes/${a.patient_id}`))}>
                        <Monitor size={22} className="text-white/80" />
                      </Icon>
                      <Link to={`/pacientes/${a.patient_id}`} className="uppercase hover:underline">
                        {a.patient_last_name},<br />
                        {a.patient_first_name}
                      </Link>
                    </span>
                  </td>
                  <td className={td}>{a.dni}</td>
                  <td className={td}>{dmy(a.patient_birth_date)}</td>
                  <td className={td}>{a.patient_birth_date ? `${age(a.patient_birth_date)}a` : ''}</td>
                  {/* Estudio: informe, nombre (naranja si lleva contraste), contraste */}
                  <td className={td}>
                    <Icon
                      title={a.report_status === 'signed' ? 'Ver informe firmado' : a.report_status === 'draft' ? 'Informe en borrador' : 'Sin informe'}
                      disabled={!a.report_status && !(a.status === 'completed' && can('admin', 'radiologist'))}
                      onClick={() => (a.report_status === 'signed' ? window.open(`/informe/${a.id}/imprimir`, '_blank') : navigate(`/informes/${a.id}`))}
                    >
                      <FileCheck2 size={24} className={a.report_status === 'signed' ? 'text-lime-300' : 'text-white/60'} />
                    </Icon>
                  </td>
                  <td className={td}>
                    <span className={`block px-1 py-0.5 uppercase ${a.study_contrast ? 'bg-amber-500' : ''}`}>{a.study_name}</span>
                  </td>
                  <td className={td}>
                    <span title={a.study_contrast ? 'Lleva contraste' : 'Sin contraste'}>
                      <Pill size={22} className={a.study_contrast ? 'text-red-400' : 'text-white/25'} />
                    </span>
                  </td>
                  <td className={td}>{a.modality}</td>
                  {/* Aseguradora + orden médica */}
                  <td className={td}>
                    <span title={a.order_received ? 'Orden médica recibida' : 'Falta orden médica'} className="relative inline-block">
                      <FileText size={22} className="text-white/80" />
                      {!a.order_received && <span className="absolute top-0 right-0 h-2 w-2 bg-red-500" />}
                    </span>
                  </td>
                  <td className={`${td} uppercase`} title={a.insurance_name || 'Sin cobertura'}>
                    {(a.insurance_code || a.insurance_name || 'S/C').slice(0, 7)}
                    {a.requires_authorization && !a.authorization_number && pending ? <span className="block text-[10px] text-amber-300 no-underline">sin autoriz.</span> : null}
                  </td>
                  <td className={`${td} border-l-2 border-white/20 font-medium`}>
                    {a.start_time}
                    {a.overbook ? <span className="ml-1 text-[10px] text-orange-300">ST</span> : null}
                  </td>
                  <td className={td}>{hhmm(a.arrived_at) || (a.status === 'absent' ? 'AUS' : ':')}</td>
                  <td className={td}>{hhmm(a.started_at) || ':'}</td>
                  <td className={td}>{a.started_at ? userCode(a.technician_email) : ''}</td>
                  <td className={td}>{hhmm(a.completed_at) || ':'}</td>
                  <td className={td}>{a.completed_at ? userCode(a.technician_email) : ''}</td>
                  {/* Acciones */}
                  <td className={`${td} rounded-r`}>
                    <span className="flex items-center gap-1">
                      <Icon
                        title={wa ? (a.reminder_sent_at ? 'Recordatorio enviado · reenviar' : 'Enviar recordatorio por WhatsApp') : 'Sin celular'}
                        disabled={!wa || !pending || !can('admin', 'reception')}
                        onClick={() => {
                          window.open(wa, '_blank', 'noopener');
                          act(() => api.reminderSent(a.id));
                        }}
                      >
                        <MessageSquare size={22} fill="currentColor" className={a.reminder_sent_at || !pending ? 'text-lime-400' : 'text-red-400'} />
                      </Icon>
                      <Icon
                        title={next ? next.label : 'Sin acciones pendientes'}
                        disabled={!next}
                        onClick={() => {
                          if (next.link) navigate(next.link);
                          else if (next.mode) setOpen({ id: a.id, mode: next.mode });
                          else act(() => api.appointmentAction(a.id, next.action));
                        }}
                      >
                        <ArrowRightCircle size={24} />
                      </Icon>
                      <Icon
                        title={a.pacs_status === 'received' ? `En PACS (${a.image_count} imágenes)` : 'Enviar a PACS'}
                        disabled={!(a.status === 'completed' && a.pacs_status !== 'received' && can('admin', 'technician'))}
                        className={a.pacs_status === 'received' ? 'text-lime-300' : ''}
                        onClick={() => act(() => api.appointmentAction(a.id, 'resend_pacs'))}
                      >
                        <ArrowUpCircle size={24} />
                      </Icon>
                      <Icon title="Detalle del turno" onClick={() => setOpen({ id: a.id })}>
                        <Table2 size={22} />
                      </Icon>
                      <Icon
                        title="Marcar ausente"
                        disabled={!pending || !can('admin', 'reception')}
                        onClick={() => confirm('¿Marcar como ausente?') && act(() => api.appointmentAction(a.id, 'absent'))}
                      >
                        <PauseCircle size={24} />
                      </Icon>
                      <Icon
                        title="Anular admisión"
                        disabled={a.status !== 'arrived' || !can('admin', 'reception')}
                        className="text-lime-400"
                        onClick={() => act(() => api.appointmentAction(a.id, 'undo_admit'))}
                      >
                        <Undo2 size={24} />
                      </Icon>
                      <Icon title="Historial del turno" onClick={() => setOpen({ id: a.id })}>
                        <List size={22} />
                      </Icon>
                      {viewer ? (
                        <a href={viewer} target="_blank" rel="noreferrer" title="Abrir visor" className="bg-black px-1.5 py-1 text-[13px] font-black italic text-white">VM</a>
                      ) : a.pacs_status === 'received' ? (
                        <span title={`En PACS: ${a.image_count} imágenes (configurá el visor en Configuración → Centro)`} className="bg-black px-1.5 py-1 text-[13px] font-black italic text-white/70">VM</span>
                      ) : (
                        <span className="w-8" />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && rows.length === 0 && <p className="py-10 text-center text-white/50">No hay turnos este día</p>}
      </div>

      {open && <AppointmentModal id={open.id} initialMode={open.mode} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}

function Icon({ children, title, onClick, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-full transition hover:scale-110 disabled:cursor-default disabled:opacity-35 disabled:hover:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}
