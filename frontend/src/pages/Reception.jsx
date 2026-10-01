import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import WorkList from '../components/WorkList';
import AppointmentModal from '../components/AppointmentModal';
import { ErrorMsg, PageHeader } from '../components/ui';
import { longDate, today } from '../utils';

const TABS = [
  { key: 'pending', label: 'Por llegar', status: 'given,confirmed' },
  { key: 'arrived', label: 'Admitidos / en espera', status: 'arrived,in_progress' },
  { key: 'done', label: 'Realizados', status: 'completed,reported,delivered' },
  { key: 'other', label: 'Ausentes / cancelados', status: 'absent,cancelled' },
];

// Recepción / admisión del día: verifica orden y autorización, admite al
// paciente (genera N° de acceso) y lo deja en la worklist del técnico.
export default function Reception() {
  const [tab, setTab] = useState('pending');
  const [open, setOpen] = useState(null);
  const setOpenId = (id) => setOpen({ id });
  const date = today();
  const { data, error, reload } = useData(() => api.listAppointments({ from: date, to: date }), [date]);

  useEffect(() => {
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const current = TABS.find((t) => t.key === tab);
  const rows = (data || []).filter((a) => current.status.split(',').includes(a.status));
  const count = (t) => (data || []).filter((a) => t.status.split(',').includes(a.status)).length;

  return (
    <div>
      <PageHeader title="Recepción" subtitle={`${longDate(date)} · admisión de pacientes`}>
        <button className="btn-secondary" onClick={reload}><RefreshCw size={15} /> Actualizar</button>
      </PageHeader>
      <ErrorMsg error={error} />
      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            {t.label} <span className="opacity-70">({count(t)})</span>
          </button>
        ))}
      </div>
      <div className="card">
        <WorkList
          rows={rows}
          onOpen={setOpenId}
          showWait
          actions={(a) =>
            ['given', 'confirmed'].includes(a.status) ? (
              <button className="btn-success px-2 py-1 text-xs" onClick={() => setOpen({ id: a.id, mode: 'admit' })}>Admitir</button>
            ) : null
          }
        />
      </div>
      {open && <AppointmentModal id={open.id} initialMode={open.mode} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
