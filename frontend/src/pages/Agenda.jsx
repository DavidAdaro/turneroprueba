import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import AppointmentModal from '../components/AppointmentModal';
import BookModal from '../components/BookModal';
import { Empty, ErrorMsg, ModalityTag, PageHeader, StatusBadge } from '../components/ui';
import { STATUS, addDays, longDate, patientName, today } from '../utils';

const savedEquipment = () => {
  try {
    return localStorage.getItem('agenda.equipment') || '';
  } catch {
    return '';
  }
};

export default function Agenda() {
  const [date, setDate] = useState(today());
  const [equipmentId, setEquipmentId] = useState(savedEquipment);
  const [book, setBook] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const { data, error, loading, reload } = useData(() => api.getDay(date, equipmentId || undefined), [date, equipmentId]);
  const { data: allEquipment } = useData(() => api.getEquipment(), []);

  useEffect(() => {
    try {
      localStorage.setItem('agenda.equipment', equipmentId);
    } catch {
      /* sin storage */
    }
  }, [equipmentId]);

  const search = async (e) => {
    e.preventDefault();
    setFound(q.trim().length >= 2 ? await api.searchAppointments(q).catch(() => []) : null);
  };

  return (
    <div>
      <PageHeader title="Turnos" subtitle="Agenda por equipo. Click en un horario libre para dar turno.">
        <form onSubmit={search} className="relative">
          <Search size={15} className="absolute top-2 left-2.5 text-slate-400" />
          <input className="input w-64 pl-8" placeholder="Buscar turno: DNI, apellido, N° acceso" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </PageHeader>

      {found && (
        <div className="card mb-4 p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            Resultados ({found.length})
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setFound(null)}>cerrar</button>
          </div>
          {found.length === 0 && <Empty>Sin turnos que coincidan</Empty>}
          <ul className="divide-y divide-slate-100">
            {found.map((a) => (
              <li key={a.id}>
                <button className="flex w-full items-center gap-3 px-1 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => setOpenId(a.id)}>
                  <span className="w-24 text-slate-500">{a.date.split('-').reverse().join('/')}</span>
                  <span className="w-12">{a.start_time}</span>
                  <ModalityTag modality={a.modality} />
                  <span className="flex-1">{patientName(a)} · {a.study_name}</span>
                  <StatusBadge status={a.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-secondary px-2" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior"><ChevronLeft size={16} /></button>
        <input type="date" className="input w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn-secondary px-2" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente"><ChevronRight size={16} /></button>
        <button className="btn-secondary" onClick={() => setDate(today())}>Hoy</button>
        <span className="ml-1 text-sm font-medium text-slate-700">{longDate(date)}</span>
        <select className="input ml-auto w-60" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          <option value="">Todos los equipos</option>
          {allEquipment?.filter((e) => e.active).map((e) => (
            <option key={e.id} value={e.id}>{e.modality} · {e.name}</option>
          ))}
        </select>
      </div>

      <ErrorMsg error={error} />
      {loading && !data && <p className="text-sm text-slate-500">Cargando…</p>}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {data?.agendas.map((ag) => (
          <EquipmentColumn
            key={ag.equipment.id}
            agenda={ag}
            single={data.agendas.length === 1}
            onFree={(slot) => setBook({ equipment: ag.equipment, startTime: slot.start_time })}
            onOverbook={() => setBook({ equipment: ag.equipment, startTime: ag.slots[0]?.start_time || '08:00', overbook: true })}
            onOpen={setOpenId}
          />
        ))}
        {data?.agendas.length === 0 && <Empty>No hay equipos activos</Empty>}
      </div>

      <Legend />

      {book && (
        <BookModal
          equipment={book.equipment}
          date={date}
          startTime={book.startTime}
          overbook={book.overbook}
          onClose={() => setBook(null)}
          onBooked={(a) => {
            setBook(null);
            reload();
            setOpenId(a.id);
          }}
        />
      )}
      {openId && <AppointmentModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}

function EquipmentColumn({ agenda, single, onFree, onOverbook, onOpen }) {
  const { equipment, slots, appointments, working, blocks } = agenda;
  const byId = Object.fromEntries(appointments.map((a) => [a.id, a]));
  const slotIds = new Set(slots.flatMap((s) => s.appointment_ids));
  // Sobreturnos y turnos fuera de la grilla.
  const extra = appointments.filter((a) => a.status !== 'cancelled' && !slotIds.has(a.id));
  const cancelled = appointments.filter((a) => a.status === 'cancelled');
  const active = appointments.filter((a) => a.status !== 'cancelled').length;

  return (
    <div className={`card shrink-0 ${single ? 'w-full max-w-3xl' : 'w-80'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2" style={{ borderTop: `4px solid ${equipment.color}` }}>
        <div>
          <div className="flex items-center gap-2 font-medium">
            <ModalityTag modality={equipment.modality} /> {equipment.name}
          </div>
          <div className="text-xs text-slate-500">
            {equipment.location} · {active} turno{active === 1 ? '' : 's'} · {slots.filter((s) => s.status === 'free').length} libres
          </div>
        </div>
        <button className="btn-secondary px-2 py-1 text-xs" onClick={onOverbook} title="Sobreturno">
          <Plus size={14} /> ST
        </button>
      </div>
      {!working && <Empty>Sin atención este día</Empty>}
      {blocks.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
          Bloqueos: {blocks.map((b) => `${b.start_time ? `${b.start_time}–${b.end_time}` : 'todo el día'} ${b.reason || ''}`).join(' · ')}
        </div>
      )}
      <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
        {slots.map((s) => (
          <li key={s.start_time} className="flex min-h-9 items-stretch text-sm">
            <span className="w-14 shrink-0 px-2 py-1.5 font-mono text-xs text-slate-500">{s.start_time}</span>
            <div className="flex-1 py-0.5 pr-1">
              {s.status === 'free' && (
                <button className="h-full w-full rounded px-2 text-left text-xs text-slate-400 hover:bg-blue-50 hover:text-blue-700" onClick={() => onFree(s)}>
                  Libre
                </button>
              )}
              {s.status === 'past' && <div className="px-2 py-1 text-xs text-slate-300">—</div>}
              {s.status === 'blocked' && <div className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">{s.block_reason}</div>}
              {s.appointment_ids
                .filter((id, i, arr) => arr.indexOf(id) === i)
                .map((id) => byId[id] && <AppointmentChip key={id} a={byId[id]} continued={byId[id].start_time !== s.start_time} onOpen={onOpen} />)}
            </div>
          </li>
        ))}
      </ul>
      {extra.length > 0 && (
        <div className="border-t border-orange-200 bg-orange-50/50 p-2">
          <div className="mb-1 text-xs font-medium text-orange-700">Sobreturnos / fuera de grilla</div>
          {extra.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="w-12 font-mono text-xs text-slate-500">{a.start_time}</span>
              <div className="flex-1"><AppointmentChip a={a} onOpen={onOpen} /></div>
            </div>
          ))}
        </div>
      )}
      {cancelled.length > 0 && (
        <details className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          <summary className="cursor-pointer">Cancelados ({cancelled.length})</summary>
          {cancelled.map((a) => (
            <button key={a.id} className="block w-full text-left hover:underline" onClick={() => onOpen(a.id)}>
              {a.start_time} {patientName(a)}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}

function AppointmentChip({ a, continued, onOpen }) {
  const s = STATUS[a.status];
  return (
    <button
      onClick={() => onOpen(a.id)}
      className={`my-0.5 block w-full rounded border px-2 py-1 text-left text-xs ${s.cls} ${continued ? 'opacity-50' : ''}`}
    >
      <div className="truncate font-medium">
        {continued ? '↳ ' : ''}
        {patientName(a)}
      </div>
      {!continued && (
        <div className="truncate opacity-80">
          {a.study_name} · {a.insurance_name || 'Sin cobertura'}
          {a.study_contrast ? ' · 💉' : ''}
          {a.reminder_sent_at ? ' · ✉' : ''}
        </div>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {Object.entries(STATUS).map(([k, s]) => (
        <span key={k} className={`rounded-full border px-2 py-0.5 ${s.cls}`}>{s.label}</span>
      ))}
    </div>
  );
}
