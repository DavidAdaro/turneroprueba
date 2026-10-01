import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useData } from '../components/useData';
import WorkList from '../components/WorkList';
import AppointmentModal from '../components/AppointmentModal';
import { ErrorMsg, Field, PageHeader } from '../components/ui';
import { addDays, today } from '../utils';

// Entrega de resultados: informes firmados listos para retirar.
export default function Delivery() {
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [showDelivered, setShowDelivered] = useState(false);
  const [open, setOpen] = useState(null);
  const setOpenId = (id) => setOpen({ id });
  const status = showDelivered ? 'delivered' : 'reported,completed';
  const { data, error, reload } = useData(() => api.listAppointments({ from, to, status }), [from, to, status]);

  return (
    <div>
      <PageHeader title="Entrega de resultados" subtitle="Estudios informados para entregar al paciente">
        <Field label="Desde"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} /> Ver entregados
        </label>
      </PageHeader>
      <ErrorMsg error={error} />
      <div className="card">
        <WorkList
          rows={data}
          onOpen={setOpenId}
          showDate
          actions={(a) =>
            a.status === 'completed' ? (
              <span className="text-xs text-slate-400">Sin informe aún</span>
            ) : (
              <div className="flex justify-end gap-1">
                <Link to={`/informe/${a.id}/imprimir`} target="_blank" className="btn-secondary px-2 py-1 text-xs"><Printer size={13} /> Imprimir</Link>
                {a.status === 'reported' && (
                  <button className="btn-success px-2 py-1 text-xs" onClick={() => setOpen({ id: a.id, mode: 'deliver' })}>Entregar</button>
                )}
              </div>
            )
          }
        />
      </div>
      {open && <AppointmentModal id={open.id} initialMode={open.mode} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
