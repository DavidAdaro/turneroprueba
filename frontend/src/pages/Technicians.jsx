import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useData } from '../components/useData';
import { useCatalog } from '../components/useCatalogs';
import WorkList from '../components/WorkList';
import AppointmentModal from '../components/AppointmentModal';
import { ErrorMsg, PageHeader } from '../components/ui';
import { longDate, today } from '../utils';

// Worklist del técnico: pacientes admitidos de su equipo. Ingresa a sala,
// adquiere y finaliza (las imágenes van al PACS).
export default function Technicians() {
  const equipment = useCatalog('equipment') || [];
  const [equipmentId, setEquipmentId] = useState(() => {
    try {
      return localStorage.getItem('tech.equipment') || '';
    } catch {
      return '';
    }
  });
  const [open, setOpen] = useState(null);
  const setOpenId = (id) => setOpen({ id });
  const date = today();
  const { data, error, reload } = useData(
    () => api.listAppointments({ from: date, to: date, status: 'arrived,in_progress,completed', equipment_id: equipmentId || undefined }),
    [date, equipmentId]
  );

  useEffect(() => {
    try {
      localStorage.setItem('tech.equipment', equipmentId);
    } catch {
      /* sin storage */
    }
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [equipmentId, reload]);

  const waiting = (data || []).filter((a) => a.status === 'arrived');
  const inRoom = (data || []).filter((a) => a.status === 'in_progress');
  const done = (data || []).filter((a) => a.status === 'completed');

  const quick = async (a, action) => {
    if (action === 'complete') return setOpen({ id: a.id, mode: 'complete' });
    await api.appointmentAction(a.id, action).catch((e) => alert(e.message));
    reload();
  };

  return (
    <div>
      <PageHeader title="Técnicos" subtitle={`Worklist · ${longDate(date)}`}>
        <select className="input w-60" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          <option value="">Todos los equipos</option>
          {equipment.filter((e) => e.active).map((e) => (
            <option key={e.id} value={e.id}>{e.modality} · {e.name}</option>
          ))}
        </select>
        <button className="btn-secondary" onClick={reload}><RefreshCw size={15} /> Actualizar</button>
      </PageHeader>
      <ErrorMsg error={error} />

      <Section title="En sala" count={inRoom.length} tone="violet">
        <WorkList rows={inRoom} onOpen={setOpenId} actions={(a) => (
          <button className="btn-success px-2 py-1 text-xs" onClick={() => quick(a, 'complete')}>Finalizar</button>
        )} />
      </Section>
      <Section title="Esperando (admitidos)" count={waiting.length} tone="amber">
        <WorkList rows={waiting} onOpen={setOpenId} showWait actions={(a) => (
          <button className="btn-primary px-2 py-1 text-xs" onClick={() => quick(a, 'start')}>Ingresar a sala</button>
        )} />
      </Section>
      <Section title="Realizados hoy (pendientes de informe)" count={done.length} tone="teal">
        <WorkList rows={done} onOpen={setOpenId} />
      </Section>

      {open && <AppointmentModal id={open.id} initialMode={open.mode} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}

const TONES = { violet: 'border-l-violet-500', amber: 'border-l-amber-500', teal: 'border-l-teal-500' };

function Section({ title, count, tone, children }) {
  return (
    <div className={`card mb-4 border-l-4 ${TONES[tone]}`}>
      <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
        {title} <span className="font-normal text-slate-500">({count})</span>
      </div>
      {children}
    </div>
  );
}
